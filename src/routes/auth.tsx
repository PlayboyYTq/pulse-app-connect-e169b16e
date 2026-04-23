import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Mail, MessageCircle, Phone, ShieldCheck, Sparkles } from "lucide-react";
import googleLogo from "@/assets/google.svg?url";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const POST_LOGIN_REDIRECT = "https://mcpee.fun";

type Mode = "signin" | "signup";

type FieldErrors = {
  name?: string;
  dob?: string;
  phone?: string;
  email?: string;
  password?: string;
  form?: string;
};

function AuthPage() {
  const { session, user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cooldown, setCooldown] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && user) {
      window.location.replace(POST_LOGIN_REDIRECT);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!session?.user?.email || session.user.email_confirmed_at) return;
    setPendingVerificationEmail(session.user.email);
  }, [session]);

  const verificationText = useMemo(() => {
    if (!pendingVerificationEmail) return null;
    return `Please verify ${pendingVerificationEmail} before continuing.`;
  }, [pendingVerificationEmail]);

  const validate = () => {
    const next: FieldErrors = {};

    if (mode === "signup") {
      if (!name.trim()) next.name = "Please enter your full name";
      else if (name.trim().length > 60) next.name = "Name is too long";

      if (!dob) next.dob = "Please enter your date of birth";
      else {
        const date = new Date(dob);
        if (Number.isNaN(date.getTime()) || date > new Date()) next.dob = "Enter a valid date";
      }

      const normalizedPhone = phone.trim();
      if (!normalizedPhone) next.phone = "Mobile number is required";
      else if (!/^\+\d{8,15}$/.test(normalizedPhone)) next.phone = "Use international format, e.g. +919876543210";
    }

    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";

    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resendVerification = async () => {
    if (!pendingVerificationEmail) return;
    if (cooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to send verification email");
      toast.success("Verification email sent");
      setCooldown(30);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  const sendBrandedVerification = async (targetEmail: string) => {
    try {
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to send verification email");
      setCooldown(30);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification email");
      return false;
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: POST_LOGIN_REDIRECT,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      // Tokens set successfully — go to external destination
      window.location.replace(POST_LOGIN_REDIRECT);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;
    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              name: name.trim(),
              date_of_birth: dob,
              phone: phone.trim(),
            },
          },
        });
        if (error) throw error;
        setPendingVerificationEmail(email.trim());
        // Sign user out so they MUST verify before continuing
        await supabase.auth.signOut();
        // Send our branded verification email immediately
        await sendBrandedVerification(email.trim());
        setMode("signin");
        setPassword("");
        toast.success("Account created. Check your email to verify your account.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      if (!data.user.email_confirmed_at) {
        setPendingVerificationEmail(email.trim());
        await supabase.auth.signOut();
        toast.error("Verify your email before signing in.");
        return;
      }

      toast.success("Signed in");
      window.location.replace(POST_LOGIN_REDIRECT);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const normalized = /email.*confirm/i.test(msg) ? "Verify your email before signing in." : msg;
      if (/email.*confirm/i.test(msg)) setPendingVerificationEmail(email.trim());
      setErrors({ form: normalized });
      toast.error(normalized);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="surface-glass order-2 rounded-[2rem] border-border/70 p-5 shadow-none md:p-7 lg:order-1">
          <div className="mx-auto mb-5 grid size-18 place-items-center rounded-[1.6rem] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-primary)_90%,white_10%),color-mix(in_oklab,var(--color-accent)_80%,var(--color-primary)_20%))] text-primary-foreground shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--color-primary)_60%,transparent)]">
            <MessageCircle className="size-8" />
          </div>

          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-[2rem] font-semibold tracking-tight text-primary">
              Pulse
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">Your intelligent real-time messaging companion</p>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-full bg-secondary p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrors({});
              }}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${mode === "signin" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrors({});
              }}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${mode === "signup" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleBusy}
              className="h-12 w-full rounded-2xl border-border/70 bg-background/80 text-sm font-semibold"
            >
              <img src={googleLogo} alt="" className="size-5" aria-hidden />
              {googleBusy ? "Connecting…" : "Continue with Google"}
            </Button>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">or with email</span>
              </div>
            </div>
            {mode === "signup" && (
              <>
                <Field label="Full name" htmlFor="name" error={errors.name}>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" className="h-12 rounded-2xl border-border/70 bg-background/80" />
                </Field>
                <Field label="Date of birth" htmlFor="dob" error={errors.dob}>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" className="h-12 rounded-2xl border-border/70 bg-background/80" />
                </Field>
                <Field label="Mobile number" htmlFor="phone" error={errors.phone}>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" autoComplete="tel" inputMode="tel" className="h-12 rounded-2xl border-border/70 bg-background/80 pl-10" />
                  </div>
                </Field>
              </>
            )}

            <Field label="Email" htmlFor="email" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="h-12 rounded-2xl border-border/70 bg-background/80 pl-10" />
              </div>
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password}>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} className="h-12 rounded-2xl border-border/70 bg-background/80" />
            </Field>

            {verificationText && (
              <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                  <div className="space-y-2">
                    <p>{verificationText}</p>
                    <Button type="button" variant="ghost" onClick={resendVerification} disabled={resending || cooldown > 0} className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/80">
                      {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {errors.form && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p>}

            <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create account"}
            </Button>
          </form>
        </Card>

        <section className="surface-panel relative order-1 hidden overflow-hidden rounded-[2rem] p-8 text-center lg:order-2 lg:flex lg:min-h-[720px] lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,color-mix(in_oklab,var(--color-primary)_18%,white_82%),transparent_22%),radial-gradient(circle_at_62%_46%,color-mix(in_oklab,var(--color-accent)_42%,white_58%),transparent_28%),linear-gradient(180deg,color-mix(in_oklab,white_72%,var(--color-accent)_28%),color-mix(in_oklab,white_88%,var(--color-background)_12%))]" />
          <div className="relative flex h-full flex-col items-center justify-center">
            <div className="mb-8 grid size-28 place-items-center rounded-[2rem] bg-card/80 text-primary shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--color-primary)_30%,transparent)] backdrop-blur">
              <MessageCircle className="size-14" />
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-primary md:text-5xl">Welcome to Pulse</h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              Fast chat, voice and video conversations, and a clean experience that feels solid every time you come back.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <FeaturePill icon={<Sparkles className="size-3.5" />} label="AI Chat" />
              <FeaturePill icon={<ShieldCheck className="size-3.5" />} label="Secure Login" />
              <FeaturePill icon={<Phone className="size-3.5" />} label="Voice Calls" />
              <FeaturePill icon={<Mail className="size-3.5" />} label="Verified Access" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">{icon}{label}</div>;
}

