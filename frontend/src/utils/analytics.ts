// Mock PostHog Integration
export const posthog = {
  init: (apiKey: string) => {
    console.log('[PostHog] Initialized with key:', apiKey);
  },
  capture: (eventName: string, properties?: Record<string, any>) => {
    console.log(`[PostHog] Event Captured: ${eventName}`, properties);
  },
  identify: (userId: string, properties?: Record<string, any>) => {
    console.log(`[PostHog] User Identified: ${userId}`, properties);
  }
};

export const trackEvent = (
  eventName: 'wallet_connected' | 'prompt_submitted' | 'tier_2_upgrade_clicked' | 'video_downloaded' | 'single_scene_regenerated' | 'new_media_generated' | 'master_storyboard_requested',
  properties?: Record<string, any>
) => {
  posthog.capture(eventName, properties);
};
