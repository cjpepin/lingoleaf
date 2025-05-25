
/**
 * Mock translation utility. Replace with edge function when ready!
 */
export async function translateText(text: string): Promise<string> {
  // TODO: Replace with real API
  if (!text) return "";
  await new Promise(r => setTimeout(r, 1000)); // fake delay
  return `(ES) ${text}`;
}
