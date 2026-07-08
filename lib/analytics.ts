/**
 * lib/analytics.ts — Privacy-respecting analytics helpers
 * 
 * Placeholder for future analytics integration. When you're ready to add
 * analytics, uncomment and configure your preferred service (e.g., Plausible,
 * Fathom, or PostHog).
 */

type EventName = 
  | "circle_created"
  | "circle_joined"
  | "circle_completed"
  | "ai_chat_opened"
  | "demo_viewed";

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track a custom event. No-op in development to avoid polluting analytics.
 * 
 * @example
 * trackEvent("circle_created", { capacity: 3, contribution: "1" })
 */
export function trackEvent(eventName: EventName, properties?: EventProperties): void {
  // Only track in production
  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics - Dev]", eventName, properties);
    return;
  }

  // Uncomment and configure when ready:
  // if (typeof window !== "undefined" && window.plausible) {
  //   window.plausible(eventName, { props: properties });
  // }
}

/**
 * Track a page view. Called automatically by Next.js navigation.
 */
export function trackPageView(url: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics - Dev] Page view:", url);
    return;
  }

  // Uncomment when ready:
  // if (typeof window !== "undefined" && window.plausible) {
  //   window.plausible("pageview", { u: url });
  // }
}

/**
 * Initialize analytics on app mount
 */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  
  // Add initialization code here when ready
  console.log("[Analytics] Ready for configuration");
}
