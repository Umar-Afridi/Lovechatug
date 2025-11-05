'use server';
/**
 * @fileOverview An AI-powered quick reply suggestion flow.
 *
 * - generateSuggestedReplies - A function that generates suggested replies based on message content.
 * - SuggestedRepliesInput - The input type for the generateSuggestedReplies function.
 * - SuggestedRepliesOutput - The return type for the generateSuggestedReplies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestedRepliesInputSchema = z.object({
  messageContent: z.string().describe('The content of the message to generate reply suggestions for.'),
});
export type SuggestedRepliesInput = z.infer<typeof SuggestedRepliesInputSchema>;

const SuggestedRepliesOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of suggested quick replies.'),
});
export type SuggestedRepliesOutput = z.infer<typeof SuggestedRepliesOutputSchema>;

export async function generateSuggestedReplies(input: SuggestedRepliesInput): Promise<SuggestedRepliesOutput> {
  return generateSuggestedRepliesFlow(input);
}

const suggestedRepliesPrompt = ai.definePrompt({
  name: 'suggestedRepliesPrompt',
  input: {schema: SuggestedRepliesInputSchema},
  output: {schema: SuggestedRepliesOutputSchema},
  prompt: `You are a helpful assistant that provides quick reply suggestions based on the content of a given message.

  Message Content: {{{messageContent}}}

  Generate 3 diverse quick reply suggestions that would be appropriate responses to the message.
  Format your response as a JSON array of strings.
  Example: ["Okay", "Sounds good!", "I'll do that right away"]
  `,
});

const generateSuggestedRepliesFlow = ai.defineFlow(
  {
    name: 'generateSuggestedRepliesFlow',
    inputSchema: SuggestedRepliesInputSchema,
    outputSchema: SuggestedRepliesOutputSchema,
  },
  async input => {
    const {output} = await suggestedRepliesPrompt(input);
    return output!;
  }
);
