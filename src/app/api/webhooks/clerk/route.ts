/**
 * Clerk Webhooks Endpoint
 * Handles subscription lifecycle events from Clerk Billing
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
import { kv } from "@vercel/kv";

// Get webhook secret from environment variables
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Update user metadata based on subscription status
 */
async function updateUserSubscriptionMetadata(
  userId: string,
  plan: string | null,
  subscriptionActive: boolean
) {
  try {
    // Update user metadata via Clerk API
    // Note: This requires Clerk Backend API - you'll need to use Clerk's API client
    // For now, we'll just log it. The actual update happens via Clerk's webhook system
    // or you can update it via Clerk Dashboard API
    
    console.log("Subscription metadata update:", {
      userId,
      plan,
      subscriptionActive,
    });

    // Store subscription status in KV for quick access (optional cache layer)
    await kv.set(
      `subscription:${userId}`,
      {
        plan,
        active: subscriptionActive,
        updatedAt: new Date().toISOString(),
      },
      { ex: 7 * 24 * 60 * 60 } // 7 days TTL
    );
  } catch (error) {
    console.error("Error updating subscription metadata:", error);
  }
}

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
      case "subscription.created":
      case "subscription.updated":
      case "subscription.renewed": {
        // Extract subscription data
        // Note: Actual structure depends on Clerk's webhook payload
        const subscriptionData = (data as any).subscription || data;
        const userId = subscriptionData.user_id || (data as any).user_id;
        const plan = subscriptionData.plan || subscriptionData.plan_name;
        const active = subscriptionData.status === "active";

        if (userId) {
          await updateUserSubscriptionMetadata(userId, plan, active);
        }
        break;
      }

      case "subscription.canceled": {
        const subscriptionData = (data as any).subscription || data;
        const userId = subscriptionData.user_id || (data as any).user_id;

        if (userId) {
          await updateUserSubscriptionMetadata(userId, null, false);
        }
        break;
      }

      case "payment.succeeded": {
        // Payment succeeded - subscription should be active
        const paymentData = (data as any).payment || data;
        const userId = paymentData.user_id || (data as any).user_id;
        const plan = paymentData.plan || paymentData.plan_name;

        if (userId && plan) {
          await updateUserSubscriptionMetadata(userId, plan, true);
        }
        break;
      }

      case "payment.failed": {
        // Payment failed - may need to handle grace period or suspend access
        const paymentData = (data as any).payment || data;
        const userId = paymentData.user_id || (data as any).user_id;

        console.warn(`Payment failed for user ${userId}`);
        // You might want to send notification or update user status
        // For now, we'll keep subscription active (grace period handling)
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

