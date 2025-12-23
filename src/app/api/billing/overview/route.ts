import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { Project } from "@/models/project";
import { Membership } from "@/models/membership";
import { FileItem } from "@/models/file-item";
import mongoose from "mongoose";
import { stripe } from "@/lib/stripe";

type InvoiceSummary = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  hostedInvoiceUrl?: string | null;
  created: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const memberships = await Membership.find({ userId: user._id })
    .select("projectId")
    .lean();
  const ownedProjects = await Project.find({
    ownerId: user._id,
    archivedAt: { $exists: false },
  })
    .select("_id")
    .lean();

  const projectIds = Array.from(
    new Set([
      ...ownedProjects.map((item) => item._id.toString()),
      ...memberships.map((item) => item.projectId.toString()),
    ])
  ).map((id) => id);

  const filesAgg =
    projectIds.length === 0
      ? []
      : await FileItem.aggregate<{ total: number }>([
          {
            $match: {
              projectId: {
                $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
              archivedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$size", 0] } },
            },
          },
        ]);

  const usage = {
    projects: projectIds.length,
    filesBytes: filesAgg[0]?.total ?? 0,
  };

  const overview = {
    plan: user.plan ?? "free",
    planStatus: user.planStatus ?? "active",
    planRenewalAt: user.planRenewalAt ?? null,
    usage,
    paymentMethod: null as null | {
      brand?: string;
      last4?: string;
      expMonth?: number;
      expYear?: number;
    },
    invoices: [] as InvoiceSummary[],
  };

  if (!process.env.STRIPE_SECRET_KEY || !user.stripeCustomerId) {
    return NextResponse.json(overview);
  }

  const [paymentMethods, invoices] = await Promise.all([
    stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
      limit: 1,
    }),
    stripe.invoices.list({ customer: user.stripeCustomerId, limit: 5 }),
  ]);

  const card = paymentMethods.data[0]?.card;
  if (card) {
    overview.paymentMethod = {
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    };
  }

  overview.invoices = invoices.data.map((invoice: Stripe.Invoice) => ({
    id: invoice.id,
    status: invoice.status ?? "unknown",
    amount:
      invoice.amount_paid && invoice.amount_paid > 0
        ? invoice.amount_paid
        : invoice.amount_due ?? 0,
    currency: invoice.currency ?? "eur",
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    created: invoice.created,
  }));

  return NextResponse.json(overview);
}
