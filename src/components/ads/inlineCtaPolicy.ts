interface InlineCtaDecisionInput {
  enabled: boolean;
  isPremium: boolean;
  hydrated: boolean;
  impressionCount: number;
  sessionShownCount: number;
  nextEligibleImpression: number;
}

export const INLINE_CTA_PROBABILITY = 0.1;
export const INLINE_CTA_MIN_IMPRESSIONS = 8;
export const INLINE_CTA_COOLDOWN_IMPRESSIONS = 30;
export const INLINE_CTA_MAX_PER_SESSION = 1;

export function shouldShowInlineCta(
  input: InlineCtaDecisionInput,
  randomValue: number
): boolean {
  if (!input.enabled) return false;
  if (input.isPremium) return false;
  if (!input.hydrated) return false;
  if (input.impressionCount < INLINE_CTA_MIN_IMPRESSIONS) return false;
  if (input.sessionShownCount >= INLINE_CTA_MAX_PER_SESSION) return false;
  if (input.impressionCount < input.nextEligibleImpression) return false;
  return randomValue < INLINE_CTA_PROBABILITY;
}
