'use server';
/**
 * @fileOverview An AI advisory tool that provides contextual insights and best practices about construction materials and structural elements.
 *
 * - aiConstructionAdvisory - A function that provides construction advice based on user inputs.
 * - AiConstructionAdvisoryInput - The input type for the aiConstructionAdvisory function.
 * - AiConstructionAdvisoryOutput - The return type for the aiConstructionAdvisory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Helper function to map rod factor to descriptive string for the prompt
function getRodDescription(factor: number): string {
  switch (factor) {
    case 0.48: return '16 mm (5 Suta)';
    case 0.30: return '12 mm (4 Suta)';
    case 0.75: return '20 mm (6 Suta)';
    default: return `${factor} (custom/unknown diameter)`;
  }
}

function getRingRodDescription(factor: number): string {
  switch (factor) {
    case 0.12: return '8 mm ring';
    case 0.19: return '10 mm ring';
    default: return `${factor} (custom/unknown ring diameter)`;
  }
}

const AiConstructionAdvisoryInputSchema = z.object({
  baseCount: z.number().describe('Number of foundation bases.'),
  baseLengthFt: z.number().describe('Length of the foundation base in feet.'),
  baseWidthFt: z.number().describe('Width of the foundation base in feet.'),
  baseThicknessIn: z.number().describe('Thickness of the foundation base in inches.'),

  columnCount: z.number().describe('Number of columns.'),
  columnLengthIn: z.number().describe('Length of the column cross-section in inches.'),
  columnWidthIn: z.number().describe('Width of the column cross-section in inches.'),
  columnHeightFt: z.number().describe('Total height of the column in feet.'),
  columnRodCount: z.number().describe('Number of main steel reinforcement rods in the column.'),

  beamHeightIn: z.number().describe('Height of the beam cross-section in inches.'),
  beamWidthIn: z.number().describe('Width of the beam cross-section in inches.'),
  beamLengthFt: z.number().describe('Total length of the beam in feet.'),
  beamRodCount: z.number().describe('Number of main steel reinforcement rods in the beam.'),

  mainRodFactor: z.number().describe('Weight per foot factor for the main steel reinforcement rods.'),
  ringRodFactor: z.number().describe('Weight per foot factor for the ring steel reinforcement rods.'),
  ringGapIn: z.number().describe('Gap between ring (stirrup) reinforcements in inches.'),

  baseRodLongitudinalCount: z.number().describe('Number of longitudinal reinforcement rods in the foundation base mesh.'),
  baseRodWidthCount: z.number().describe('Number of width-wise reinforcement rods in the foundation base mesh.'),
});
export type AiConstructionAdvisoryInput = z.infer<typeof AiConstructionAdvisoryInputSchema>;

const AiConstructionAdvisoryOutputSchema = z.object({
  advice: z.string().describe('Contextual insights, best practices, and general guidance related to the construction materials and structural elements.'),
});
export type AiConstructionAdvisoryOutput = z.infer<typeof AiConstructionAdvisoryOutputSchema>;

export async function aiConstructionAdvisory(input: AiConstructionAdvisoryInput): Promise<AiConstructionAdvisoryOutput> {
  return aiConstructionAdvisoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiConstructionAdvisoryPrompt',
  input: {schema: AiConstructionAdvisoryInputSchema},
  output: {schema: AiConstructionAdvisoryOutputSchema},
  prompt: `You are an expert construction advisor and structural engineer. Your role is to provide contextual insights, best practices, and general guidance based on the provided construction dimensions and steel rebar specifications. The concrete mix ratio is fixed at 1:1.5:3 (Cement:Sand:Aggregate).

Analyze the following structural elements and their specifications, then offer advice for each section, concluding with overall best practices and considerations.

---
## Structural Dimensions and Specifications:

### Foundation Base:
- Number of Bases: {{{baseCount}}}
- Length: {{{baseLengthFt}}} feet
- Width: {{{baseWidthFt}}} feet
- Thickness: {{{baseThicknessIn}}} inches
- Base Mesh Longitudinal Rods: {{{baseRodLongitudinalCount}}}
- Base Mesh Width-wise Rods: {{{baseRodWidthCount}}}

### Column:
- Number of Columns: {{{columnCount}}}
- Cross-section Length (per column): {{{columnLengthIn}}} inches
- Cross-section Width (per column): {{{columnWidthIn}}} inches
- Total Height (per column): {{{columnHeightFt}}} feet
- Main Reinforcement Rods (per column): {{{columnRodCount}}}

### Beam:
- Cross-section Height: {{{beamHeightIn}}} inches
- Cross-section Width: {{{beamWidthIn}}} inches
- Total Length: {{{beamLengthFt}}} feet
- Main Reinforcement Rods: {{{beamRodCount}}}

### Steel Reinforcement Details:
- Main Rod: {{{mainRodDescription}}}
- Ring (Stirrup) Rod: {{{ringRodDescription}}}
- Ring (Stirrup) Gap: {{{ringGapIn}}} inches

---
## Your Expert Advice:

Consider the typical construction practices for residential or small commercial buildings when giving advice.
Provide advice in a structured manner, starting with general observations, then addressing each component (Foundation, Columns, Beams, Reinforcement), and finally offering overall best practices.
Keep the advice concise, practical, and focused on structural integrity and material efficiency.
`
});

const aiConstructionAdvisoryFlow = ai.defineFlow(
  {
    name: 'aiConstructionAdvisoryFlow',
    inputSchema: AiConstructionAdvisoryInputSchema,
    outputSchema: AiConstructionAdvisoryOutputSchema,
  },
  async (input) => {
    const mainRodDescription = getRodDescription(input.mainRodFactor);
    const ringRodDescription = getRingRodDescription(input.ringRodFactor);

    const augmentedInput = {
      ...input,
      mainRodDescription: mainRodDescription,
      ringRodDescription: ringRodDescription,
    };

    const {output} = await prompt(augmentedInput as any);
    return output!;
  }
);
