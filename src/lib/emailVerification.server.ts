import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

type VerificationPayload = {
  userId: string;
  email: string;
  expiresAt: number;
};

function getSigningSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY;
  if (!secret) throw new Error("Verification signing secret missing");
  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function createEmailVerificationToken(userId: string, email: string) {
  const payload = base64UrlEncode(JSON.stringify({ userId, email, expiresAt: Date.now() + TOKEN_TTL_MS } satisfies VerificationPayload));
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailVerificationToken(token: string): VerificationPayload {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid verification link");

  const expected = sign(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Invalid verification link");
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as VerificationPayload;
  if (!parsed.userId || !parsed.email || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
    throw new Error("Verification link expired");
  }

  return parsed;
}