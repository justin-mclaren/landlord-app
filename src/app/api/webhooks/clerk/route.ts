/**
 * Clerk Webhooks Endpoint
 * Handles subscription lifecycle events from Clerk Billing
 * 
 * Clerk automatically manages subscription state - we only need to:
 * - Log events for debugging
 * - Optionally reset usage quotas on renewal
 * 
 * Webhook events to handle:
 * - subscription.created
 * - subscription.updated
 * - subscription.canceled
 * - subscription.renewed
 * - payment.succeeded
 * - payment.failed
 * 
 * Docs: https://clerk.com/docs/guides/billing/overview#webhooks
 */

import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { resetUsage } from "@/lib/quotas";

// Get webhook secret from environment variables
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: Request) {
  // Verify webhook signature
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await request.json();

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(JSON.stringify(payload), {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;
  const data = evt.data;

  console.log(`Webhook event received: ${eventType}`, {
    userId: data.id || (data as any).user_id,
    eventType,
  });

  try {
    switch (eventType) {
      case "subscription.renewed": {
        // Reset monthly usage quota when subscription renews
        const subscriptionData = (data as any).subscription || data;
        const userId = subscriptionData.user_id || (data as any).user_id;
        
        if (userId) {
          // Reset usage for the new billing cycle
          await resetUsage(userId);
          console.log(`Reset usage quota for user ${userId} on subscription renewal`);
        }
        break;
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.canceled":
      case "payment.succeeded":
      case "payment.failed": {
        // Clerk handles subscription state automatically
        // Just log for debugging
        const subscriptionData = (data as any).subscription || data;
        const userId = subscriptionData.user_id || (data as any).user_id;
        const plan = subscriptionData.plan || subscriptionData.plan_name;
        const status = subscriptionData.status;
        
        console.log(`Subscription event: ${eventType}`, {
          userId,
          plan,
          status,
        });
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}

