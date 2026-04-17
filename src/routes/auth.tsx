import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { MessageCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Method = "email" | "phone";
type Mode = "signin" | "signup";

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<Mode>("signin");

  // shared
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  // email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // OTP
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chats" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const normalizePhone = (p: string) => p.replace(/[^\d+]/g, "");

  // ---- EMAIL submit ----
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanedPhone = normalizePhone(phone);
        if (!cleanedPhone.startsWith("+") || cleanedPhone.length < 8) {
          throw new Error("Enter phone in international format, e.g. +14155552671");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/chats`,
            data: { name, date_of_birth: dob || null, phone: cleanedPhone },
          },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- PHONE: send OTP ----
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cleaned = normalizePhone(phone);
      if (!cleaned.startsWith("+") || cleaned.length < 8) {
        throw new Error("Enter phone in international format, e.g. +14155552671");
      }
      if (mode === "signup" && !name.trim()) {
        throw new Error("Please enter your name");
      }
      const { error } = await supabase.auth.signInWithOtp({
        phone: cleaned,
        options: {
          // For signup, attach profile data; for signin, this is ignored on existing users
          data:
            mode === "signup"
              ? { name, date_of_birth: dob || null, phone: cleaned }
              : undefined,
          // shouldCreateUser true for signup, false for signin (so it errors if user not found)
          shouldCreateUser: mode === "signup",
        },
      });
      if (error) throw error;
      setOtpStage(true);
      setResendIn(60);
      toast.success("Code sent — check your messages");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  // ---- PHONE: verify OTP ----
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const cleaned = normalizePhone(phone);
      const { error } = await supabase.auth.verifyOtp({
        phone: cleaned,
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Verified");
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
                We sent a 6-digit code to <span className="text-foreground font-medium">{phone}</span>
              </p>
              <form onSubmit={verifyOtp} className="mt-6 space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
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
                {mode === "signin" ? "Sign in to continue chatting" : "Join the conversation in seconds"}
              </p>

              <Tabs value={method} onValueChange={(v) => setMethod(v as Method)} className="mt-5">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="phone">Phone</TabsTrigger>
                </TabsList>

                {/* EMAIL */}
                <TabsContent value="email">
                  <form onSubmit={submitEmail} className="mt-4 space-y-4">
                    {mode === "signup" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dob">Date of birth</Label>
                          <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone-e">Phone number</Label>
                          <Input
                            id="phone-e"
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+14155552671"
                          />
                          <p className="text-xs text-muted-foreground">Use international format with country code.</p>
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl" disabled={busy}>
                      {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                    </Button>
                  </form>
                </TabsContent>

                {/* PHONE */}
                <TabsContent value="phone">
                  <form onSubmit={sendOtp} className="mt-4 space-y-4">
                    {mode === "signup" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="name-p">Name</Label>
                          <Input id="name-p" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dob-p">Date of birth</Label>
                          <Input id="dob-p" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="phone-p">Phone number</Label>
                      <Input
                        id="phone-p"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+14155552671"
                      />
                      <p className="text-xs text-muted-foreground">We'll text you a 6-digit code.</p>
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl" disabled={busy}>
                      {busy ? "Sending…" : "Send verification code"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

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
