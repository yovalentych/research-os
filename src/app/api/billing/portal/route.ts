import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const returnUrl =
    typeof body?.returnUrl === "string" ? body.returnUrl : undefined;

  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "Stripe customer not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl ?? `${origin}/uk/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
