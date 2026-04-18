import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { initials } from "@/lib/format";
import { ArrowLeft, Camera, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: ProfilePage,
});

type BlockedUser = { id: string; name: string; avatar_url: string | null };

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Phone change OTP flow
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");

  // Blocked users
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setDob(profile.date_of_birth ?? "");
      setPhone(profile.phone ?? "");
      setOriginalPhone(profile.phone ?? "");
    }
  }, [profile]);

  const loadBlocked = async () => {
    if (!user) return;
    setBlockedLoading(true);
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    const ids = (blocks ?? []).map((b) => b.blocked_id);
    if (ids.length === 0) { setBlocked([]); setBlockedLoading(false); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,name,avatar_url")
      .in("id", ids);
    setBlocked((profs ?? []) as BlockedUser[]);
    setBlockedLoading(false);
  };

  useEffect(() => { loadBlocked(); }, [user?.id]);

  const unblock = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);
    if (error) return toast.error(error.message);
    toast.success("User unblocked");
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  };

  const saveProfileBasics = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name, date_of_birth: dob || null })
      .eq("id", user.id);
    if (error) throw error;
    await refreshProfile();
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const normalizedPhone = phone.trim();
    setSaving(true);
    try {
      await saveProfileBasics();
      if (normalizedPhone && normalizedPhone !== originalPhone) {
        // Trigger OTP for phone change
        if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
          toast.error("Phone must be in international format, e.g. +919876543210");
          setSaving(false);
          return;
        }
        setOtpSending(true);
        const { error } = await supabase.auth.updateUser({ phone: normalizedPhone });
        setOtpSending(false);
        if (error) {
          toast.error(error.message);
          setSaving(false);
          return;
        }
        setPendingPhone(normalizedPhone);
        setOtpOpen(true);
        toast.success("Verification code sent to your new number");
      } else {
        toast.success("Profile updated");
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return toast.error("Enter the 6-digit code");
    setOtpVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: otpCode,
      type: "phone_change",
    });
    setOtpVerifying(false);
    if (error) return toast.error(error.message);
    setOtpOpen(false);
    setOtpCode("");
    setOriginalPhone(pendingPhone);
    toast.success("Phone number updated");
    await refreshProfile();
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (updErr) return toast.error(updErr.message);
    toast.success("Avatar updated");
    await refreshProfile();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/30">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <Link to="/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to chats
        </Link>

        <Card className="p-6 md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Update how you appear to others.</p>

          <div className="mt-6 flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xl">{initials(profile?.name ?? "U")}</AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 size-8 grid place-items-center rounded-full bg-primary text-primary-foreground shadow cursor-pointer hover:opacity-90">
                <Camera className="size-4" />
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
              </label>
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{profile?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{profile?.email ?? user?.email}</div>
              {uploading && <div className="text-xs text-muted-foreground mt-1">Uploading…</div>}
            </div>
          </div>

          <form onSubmit={onSave} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                Include the country code (e.g. <span className="font-mono">+91</span>). Changing this requires OTP verification.
              </p>
            </div>
            <Button type="submit" disabled={saving || otpSending} className="rounded-xl">
              {(saving || otpSending) && <Loader2 className="size-4 mr-2 animate-spin" />}
              {otpSending ? "Sending code…" : saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Blocked users</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Blocked users can't message you, send friend requests, or find you in search.
              </p>
            </div>
            <ShieldOff className="size-5 text-muted-foreground" />
          </div>

          <div className="mt-5 -mx-2">
            {blockedLoading && <p className="px-2 text-sm text-muted-foreground">Loading…</p>}
            {!blockedLoading && blocked.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">You haven't blocked anyone.</p>
            )}
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent/40">
                <Avatar className="size-10">
                  <AvatarImage src={b.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(b.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 font-medium truncate">{b.name}</div>
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => unblock(b.id)}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={otpOpen} onOpenChange={(v) => { if (!otpVerifying) setOtpOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify new phone</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code we sent to <span className="font-medium text-foreground">{pendingPhone}</span>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.4em] font-mono h-12 rounded-xl"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOtpOpen(false)} disabled={otpVerifying}>Cancel</Button>
            <Button onClick={verifyOtp} disabled={otpVerifying || otpCode.length !== 6} className="rounded-xl">
              {otpVerifying && <Loader2 className="size-4 mr-2 animate-spin" />}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
