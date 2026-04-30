import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "Circle <noreply@mcpee.fun>";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildHtml(link: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;padding:32px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Verify your Pulse account</h1>
    <p style="color:#475569;font-size:15px;line-height:1.5;margin:0 0 24px">
      Tap the button below to confirm your email address and start using Pulse.
    </p>
    <a href="${link}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Verify email</a>
    <p style="color:#94a3b8;font-size:12px;margin:28px 0 0">If you didn't create an account, you can safely ignore this email.</p>
  </div>
</body></html>`;
}

export const Route = createFileRoute("/api/send-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = (await request.json()) as { email?: string };
          if (!email || !isValidEmail(email)) {
            return Response.json({ error: "Invalid email" }, { status: 400 });
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          const RESEND_API_KEY = process.env.RESEND_API_KEY;
          if (!LOVABLE_API_KEY) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
          if (!RESEND_API_KEY) return Response.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

          // Generate a Supabase signup verification link via admin
          const origin = new URL(request.url).origin;
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: `${origin}/auth` },
          });

          if (linkErr || !linkData?.properties?.action_link) {
            return Response.json({ error: linkErr?.message ?? "Could not generate link" }, { status: 400 });
          }

          const actionLink = linkData.properties.action_link;

          const resp = await fetch(`${GATEWAY_URL}/emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [email],
              subject: "Verify your Pulse account",
              html: buildHtml(actionLink),
            }),
          });

          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            return Response.json({ error: `Resend error [${resp.status}]`, details: data }, { status: 502 });
          }

          return Response.json({ success: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});