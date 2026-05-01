import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createEmailVerificationToken } from "@/lib/emailVerification.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "Circle <noreply@mcpee.fun>";
const APP_URL = "https://mcpee.fun";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildHtml(link: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;padding:32px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Verify your Circle account</h1>
    <p style="color:#475569;font-size:15px;line-height:1.5;margin:0 0 24px">
      Tap the button below to confirm your email address and start using Circle.
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
          const { email, name, dob, phone, password } = (await request.json()) as { email?: string; name?: string; dob?: string; phone?: string; password?: string };
          if (!email || !isValidEmail(email)) {
            return Response.json({ error: "Invalid email" }, { status: 400 });
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          const RESEND_API_KEY = process.env.RESEND_API_KEY;
          if (!LOVABLE_API_KEY) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
          if (!RESEND_API_KEY) return Response.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

          const normalizedEmail = email.trim().toLowerCase();
          let userId = "";

          if (password) {
            const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: normalizedEmail,
              password,
              email_confirm: false,
              user_metadata: { name: name?.trim(), date_of_birth: dob, phone: phone?.trim() },
            });
            if (createErr || !userData.user) {
              return Response.json({ error: createErr?.message ?? "Could not create account" }, { status: 400 });
            }
            userId = userData.user.id;
          } else {
            const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (listErr) return Response.json({ error: listErr.message }, { status: 400 });
            const existing = usersData.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
            if (!existing) return Response.json({ error: "Create an account before requesting verification." }, { status: 404 });
            if (existing.email_confirmed_at) return Response.json({ success: true, alreadyVerified: true });
            userId = existing.id;
          }

          const actionLink = `${APP_URL}/api/verify-email?token=${encodeURIComponent(createEmailVerificationToken(userId, normalizedEmail))}`;

          const resp = await fetch(`${GATEWAY_URL}/emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [normalizedEmail],
              subject: "Verify your Circle account",
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