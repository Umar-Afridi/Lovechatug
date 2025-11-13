'use server';

/**
 * @fileOverview A flow to handle and "send" verification application emails.
 *
 * In a real-world scenario, this flow would integrate with an email service
 * like SendGrid or Mailgun to send an actual email with the document as an attachment.
 * For this demo, it logs the intended email content to the console.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const VerificationInputSchema = z.object({
  fullName: z.string().describe('The full name of the applicant.'),
  username: z.string().describe('The username of the applicant.'),
  email: z.string().email().describe('The email address of the applicant.'),
  documentDataUrl: z.string().describe('The identification document as a base64 data URL.'),
});

export type VerificationInput = z.infer<typeof VerificationInputSchema>;

export async function sendVerificationEmail(input: VerificationInput): Promise<{ success: boolean; message: string }> {
  return sendVerificationEmailFlow(input);
}

const sendVerificationEmailFlow = ai.defineFlow(
  {
    name: 'sendVerificationEmailFlow',
    inputSchema: VerificationInputSchema,
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
    }),
  },
  async (input) => {
    const to = 'Lovechat0300@gmail.com';
    const subject = `New Verification Request from @${input.username}`;
    const body = `
        A new verification request has been submitted.

        Applicant Details:
        - Full Name: ${input.fullName}
        - Username: @${input.username}
        - Email: ${input.email}

        The attached document has been provided for review.
        Document is encoded in base64 below.
    `;

    const attachment = {
        filename: `${input.username}-document.png`, // Assuming png, could be parsed from data url
        content: input.documentDataUrl.split(',')[1],
        contentType: input.documentDataUrl.substring(input.documentDataUrl.indexOf(':') + 1, input.documentDataUrl.indexOf(';')),
    };
    
    // In a real application, you would use an email service here.
    // For example, using a hypothetical `email.send` function:
    /*
    try {
        await email.send({
            to: to,
            subject: subject,
            body: body,
            attachments: [attachment]
        });
        return { success: true, message: 'Email sent successfully.' };
    } catch (error) {
        console.error("Failed to send verification email:", error);
        return { success: false, message: 'Failed to send email.' };
    }
    */

    // For this project, we'll just log the details to the console
    // as if the email was sent. The logs can be checked in the server environment.
    console.log('--- NEW VERIFICATION EMAIL ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('Body:', body);
    console.log('Attachment Filename:', attachment.filename);
    console.log('Attachment Content-Type:', attachment.contentType);
    console.log('--- END OF EMAIL ---');

    return {
      success: true,
      message: 'Verification application logged successfully.',
    };
  }
);
