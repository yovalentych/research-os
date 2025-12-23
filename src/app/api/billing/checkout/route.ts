import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { stripe } from "@/lib/stripe";

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  lab: process.env.STRIPE_PRICE_LAB,
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const body = await request.json();
  const planId = typeof body?.planId === "string" ? body.planId : "free";
  const returnUrl =
    typeof body?.returnUrl === "string" ? body.returnUrl : undefined;

  if (planId === "free") {
    await connectToDatabase();
    await User.findByIdAndUpdate(session.user.id, {
      $set: { plan: "free", planStatus: "active", planRenewalAt: null },
    });
    return NextResponse.json({ status: "free" });
  }

  const priceId = PLAN_PRICE_MAP[planId];
  if (!priceId) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const successUrl = `${returnUrl ?? `${origin}/uk/settings/billing`}?status=success`;
  const cancelUrl = `${returnUrl ?? `${origin}/uk/settings/billing`}?status=cancel`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user._id.toString(),
    metadata: {
      userId: user._id.toString(),
      plan: planId,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
