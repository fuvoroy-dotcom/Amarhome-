'use server';
/**
 * @fileOverview A flow to generate house designs based on architectural preferences.
 */

import { ai } from '@/ai/genkit';
import { HouseDesignInputSchema } from '@/app/lib/schemas';

export async function generateHouseDesign(input: { style: string; floors: number; surroundings: string }) {
  const prompt = `A highly detailed, professional architectural visualization of a ${input.style} style house with ${input.floors} floors, located in a ${input.surroundings} environment. Cinematic lighting, photorealistic, 8k resolution, elegant design.`;
  
  const { media } = await ai.generate({
    model: 'googleai/imagen-4.0-fast-generate-001',
    prompt: prompt,
  });

  if (!media) {
    throw new Error('Image generation failed');
  }

  return { imageUrl: media.url };
}
