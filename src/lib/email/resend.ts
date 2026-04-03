import { Resend } from 'resend';
import { render } from '@react-email/render';

// Initialize Resend client with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email using Resend
 * @param options - Email options including to, subject, and content (html or react)
 * @returns Result with success status and optional id or error message
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const fromEmail = options.from || process.env.FROM_EMAIL || 'AI Digest <noreply@example.com>';

  try {
    // Render React component to HTML if provided
    let html = options.html;
    if (options.react && !html) {
      html = await render(options.react);
    }

    if (!html) {
      return {
        success: false,
        error: 'No HTML content provided',
      };
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html,
      text: options.text,
      replyTo: options.replyTo,
      headers: options.headers,
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error sending email';
    console.error('Email send error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Export the resend client for advanced use cases
export { resend };
