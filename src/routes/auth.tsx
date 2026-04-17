import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { MessageCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "signin" | "signup";

const DEFAULT_DIAL_CODE = "+91";

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");

  // signup-only fields
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // shared phone (split into dial code + local digits)
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [localPhone, setLocalPhone] = useState("");

  // OTP stage
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  // remember signup payload across the OTP step so we can attach email/password after verify
  const pendingProfileRef = useRef<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chats" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const fullPhone = () => {
    const code = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
    const digits = localPhone.replace(/\D/g, "");
    return `${code}${digits}`.replace(/[^\d+]/g, "");
  };

  const validate = () => {
    const phone = fullPhone();
    if (!phone.startsWith("+") || phone.length < 8) {
      throw new Error("Enter a valid phone number with country code");
    }
    if (mode === "signup") {
      if (!name.trim()) throw new Error("Please enter your name");
      if (!dob) throw new Error("Please enter your date of birth");
      if (!email.trim() || !email.includes("@")) throw new Error("Please enter a valid email");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
    }
    return phone;
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const phone = validate();
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: mode === "signup",
          data:
            mode === "signup"
              ? { name: name.trim(), date_of_birth: dob || null, phone, email: email.trim() }
              : undefined,
        },
      });
      if (error) throw error;
      pendingProfileRef.current =
        mode === "signup" ? { email: email.trim(), password } : null;
      setOtpStage(true);
      setOtp("");
      setResendIn(60);
      toast.success("Code sent — check your messages");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const phone = fullPhone();
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;

      // After verification, attach email + password to the new account so the user
      // also has an email-based recovery method on file.
      const pending = pendingProfileRef.current;
      if (pending) {
        const { error: updErr } = await supabase.auth.updateUser({
          email: pending.email,
          password: pending.password,
        });
        if (updErr) {
          // Don't block sign-in if this fails (e.g. email already used) — surface a notice.
          toast.warning(`Signed in, but couldn't save email/password: ${updErr.message}`);
        } else {
          toast.success("Account created — verify your email when convenient");
        }
        pendingProfileRef.current = null;
      } else {
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  };

  const resetOtp = () => {
    setOtpStage(false);
    setOtp("");
    setResendIn(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/40">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="size-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/20">
            <MessageCircle className="size-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Pulse</span>
        </Link>

        <Card className="p-7 shadow-xl border-border/60">
          {otpStage ? (
            <>
              <button
                type="button"
                onClick={resetOtp}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <h1 className="text-2xl font-semibold tracking-tight">Enter verification code</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a 6-digit code to <span className="text-foreground font-medium">{fullPhone()}</span>
              </p>
              <form onSubmit={verifyOtp} className="mt-6 space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric">
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={busy || otp.length !== 6}>
                  {busy ? "Verifying…" : "Verify & continue"}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  {resendIn > 0 ? (
                    <>Resend code in {resendIn}s</>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => sendOtp(e as unknown as React.FormEvent)}
                      className="hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "signin"
                  ? "Sign in with a one-time code"
                  : "Quick signup — we'll text you a code to verify"}
              </p>

              <form onSubmit={sendOtp} className="mt-5 space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        autoComplete="bday"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="dial"
                      inputMode="tel"
                      value={dialCode}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d+]/g, "");
                        setDialCode(v.startsWith("+") ? v : `+${v}`);
                      }}
                      className="w-20 text-center font-medium"
                      aria-label="Country code"
                    />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      required
                      value={localPhone}
                      onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="98765 43210"
                      autoComplete="tel-national"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Default is India (+91). Edit the prefix for other countries.
                  </p>
                </div>

                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full h-11 rounded-xl" disabled={busy}>
                  {busy ? "Sending…" : mode === "signin" ? "Send code" : "Create account & send code"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-5 text-sm text-muted-foreground hover:text-foreground w-full text-center"
              >
                {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
