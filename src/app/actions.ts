'use server';

import { aiConstructionAdvisory, type AiConstructionAdvisoryInput } from "@/ai/flows/ai-construction-advisory-flow";

export async function getConstructionAdvice(input: AiConstructionAdvisoryInput): Promise<{advice: string} | {error: string}> {
  try {
    const result = await aiConstructionAdvisory(input);
    if (result && result.advice) {
        return { advice: result.advice };
    }
    return { error: "AI থেকে একটি অপ্রত্যাশিত প্রতিক্রিয়া এসেছে। অনুগ্রহ করে আবার চেষ্টা করুন।" };
  } catch (e) {
    console.error(e);
    // This could be a more user-friendly error message
    return { error: "পরামর্শ তৈরি করার সময় একটি ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।" };
  }
}
