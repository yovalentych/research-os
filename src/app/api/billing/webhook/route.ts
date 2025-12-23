import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { stripe } from "@/lib/stripe";

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
  [process.env.STRIPE_PRICE_LAB ?? ""]: "lab",
};

function resolvePlanFromSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return undefined;
  return PRICE_TO_PLAN[priceId];
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook secret" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await connectToDatabase();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string | null;
    const subscriptionId = session.subscription as string | null;
    const plan = session.metadata?.plan;
    const userId = session.metadata?.userId;

    const updates: Record<string, unknown> = {
      planStatus: "active",
    };
    if (plan) updates.plan = plan;
    if (customerId) updates.stripeCustomerId = customerId;
    if (subscriptionId) updates.stripeSubscriptionId = subscriptionId;

    if (userId) {
      await User.findByIdAndUpdate(userId, { $set: updates });
    } else if (customerId) {
      await User.findOneAndUpdate({ stripeCustomerId: customerId }, { $set: updates });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const resolvedPlan = resolvePlanFromSubscription(subscription);
    const renewalAt = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    const updates: Record<string, unknown> = {
      stripeSubscriptionId: subscription.id,
      planStatus: subscription.status,
      planRenewalAt: renewalAt,
    };

    if (event.type === "customer.subscription.deleted") {
      updates.plan = "free";
    } else if (resolvedPlan) {
      updates.plan = resolvedPlan;
    }

    await User.findOneAndUpdate({ stripeCustomerId: customerId }, { $set: updates });
  }

  return NextResponse.json({ received: true });
}
