import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; dob?: string; email?: string; password?: string; form?: string }>({});

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chats" });
  }, [session, loading, navigate]);

  const validate = () => {
    const next: typeof errors = {};
    if (mode === "signup") {
      if (!name.trim()) next.name = "Please enter your name";
      else if (name.trim().length > 60) next.name = "Name is too long";
      if (!dob) next.dob = "Please enter your date of birth";
      else {
        const d = new Date(dob);
        if (isNaN(d.getTime()) || d > new Date()) next.dob = "Enter a valid date";
      }
    }
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
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
            emailRedirectTo: `${window.location.origin}/chats`,
            data: { name: name.trim(), date_of_birth: dob },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden px-4 py-8 md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-panel relative hidden overflow-hidden rounded-[2rem] p-8 text-foreground lg:flex lg:min-h-[720px] lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_oklab,var(--color-accent)_35%,transparent),transparent_48%)]" />
          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-background/60 px-4 py-2 text-sm font-semibold backdrop-blur">
              <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <MessageCircle className="size-4" />
              </span>
              Pulse
            </Link>
            <div className="mt-14 max-w-xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-accent-foreground">
                <Sparkles className="size-3.5" /> Professional messaging
              </p>
              <h1 className="text-balance text-5xl font-semibold leading-[0.95] tracking-tight">
                {mode === "signin" ? "Welcome back to faster, cleaner conversations." : "Create your account and start chatting instantly."}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                Simple email access, polished chat flows, and instant delivery designed to feel reliable every time you open the app.
              </p>
            </div>
          </div>

          <div className="relative grid gap-4 md:grid-cols-2">
            <div className="surface-glass rounded-[1.6rem] p-5">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Secure by default</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Email and password only, clean validation, and a calmer onboarding flow.</p>
            </div>
            <div className="surface-glass rounded-[1.6rem] p-5">
              <ArrowRight className="size-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Built for speed</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Messages render instantly and the interface stays focused on the conversation.</p>
            </div>
          </div>
        </section>

        <div className="w-full max-w-xl justify-self-center lg:max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-3 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm font-semibold backdrop-blur lg:hidden">
            <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <MessageCircle className="size-4" />
            </span>
            Pulse
          </Link>

          <Card className="surface-glass rounded-[2rem] border-border/70 p-7 shadow-none md:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{mode === "signin" ? "Sign in" : "Create account"}</p>
              <h2 className="text-3xl font-semibold tracking-tight">
                {mode === "signin" ? "Access your workspace" : "Join Pulse"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {mode === "signin" ? "Use your email and password to continue." : "Fill in your details to create a new account."}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                  <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" aria-invalid={!!errors.name} className="h-12 rounded-2xl border-border/70 bg-background/80" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    autoComplete="bday"
                    aria-invalid={!!errors.dob}
                      className="h-12 rounded-2xl border-border/70 bg-background/80"
                  />
                  {errors.dob && <p className="text-xs text-destructive">{errors.dob}</p>}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="h-12 rounded-2xl border-border/70 bg-background/80"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                aria-invalid={!!errors.password}
                className="h-12 rounded-2xl border-border/70 bg-background/80"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {errors.form && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{errors.form}</p>
            )}

            <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrors({}); }}
            className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
