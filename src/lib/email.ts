import { Resend } from "resend";

// Not configured locally unless RESEND_API_KEY is set - emails are skipped
// silently rather than breaking the action they're attached to (a message
// still sends, a document still gets marked received, even if the email
// provider is down or simply isn't set up yet).
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FROM = process.env.EMAIL_FROM || "Neubridge <onboarding@resend.dev>";

export async function sendNotificationEmail({
  to,
  message,
  projectId,
  projectCode,
}: {
  to: string;
  message: string;
  projectId: string;
  projectCode: string;
}) {
  if (!resend) return;

  const projectUrl = `${APP_URL}/projects/${projectId}`;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `${projectCode}: ${message}`,
      html: `
        <p>${message}</p>
        <p><a href="${projectUrl}">View in Neubridge →</a></p>
        <p style="color: #888; font-size: 12px;">You're receiving this because of activity on a Neubridge project you have access to.</p>
      `,
    });
  } catch (err) {
    // A flaky email provider shouldn't fail the action it's attached to -
    // the in-app notification is already created regardless.
    console.error("Failed to send notification email:", err);
  }
}
