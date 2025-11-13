'use server';
/**
 * @fileOverview A flow to handle verification email sending.
 * This is a server-side flow that takes user details and a file,
 * then logs the formatted email content. In a production environment,
 * this log could be replaced with a real email sending service like SendGrid or Mailgun.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input schema for the verification flow.
const VerificationInputSchema = z.object({
  fullName: z.string().describe('The full name of the user.'),
  username: z.string().describe('The username of the user.'),
  email: z.string().email().describe("The user's active email address for contact."),
  document: z
    .string()
    .describe(
      "A government-issued ID, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

// Exporting the type for client-side usage
export type VerificationInput = z.infer<typeof VerificationInputSchema>;

/**
 * A server action that takes verification details and logs them.
 * This simulates sending an email in a secure, server-only environment.
 *
 * @param input - The user's verification data.
 * @returns A promise that resolves with a success or error message.
 */
export async function sendVerificationEmail(input: VerificationInput): Promise<{ success: boolean; message: string; }> {
  try {
    // Validate input with Zod on the server-side.
    const validatedInput = VerificationInputSchema.parse(input);
    
    // In a real application, you would integrate an email service here.
    // For now, we will log the intended email content to the server console.
    // This log can be viewed in the Firebase Functions logs.
    
    const emailBody = `
      =================================
      Verification Request Received
      =================================
      Full Name: ${validatedInput.fullName}
      Username: @${validatedInput.username}
      Active Email: ${validatedInput.email}
      
      Document: (Base64 data below)
      ${validatedInput.document.substring(0, 100)}... 
      =================================
    `;

    console.log("Verification Email Body:", emailBody);

    return { success: true, message: 'Verification application logged successfully.' };

  } catch (error) {
    console.error("Error in sendVerificationEmail flow:", error);
    // If it's a Zod validation error, return a more specific message
    if (error instanceof z.ZodError) {
        return { success: false, message: `Invalid input: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { success: false, message: 'Failed to process verification application.' };
  }
}
