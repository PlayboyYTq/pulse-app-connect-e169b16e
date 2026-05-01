import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmailVerificationToken } from "@/lib/emailVerification.server";

const APP_URL = "https://mcpee.fun";

export const Route = createFileRoute("/api/verify-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = new URL(request.url).searchParams.get("token");
          if (!token) throw new Error("Verification link missing");

          const payload = verifyEmailVerificationToken(token);
          const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.userId, {
            email_confirm: true,
          });
          if (error) throw error;

          return Response.redirect(`${APP_URL}/auth?verified=1`, 302);
        } catch (err) {
          const message = encodeURIComponent(err instanceof Error ? err.message : "Verification failed");
          return Response.redirect(`${APP_URL}/auth?verification_error=${message}`, 302);
        }
      },
    },
  },
});