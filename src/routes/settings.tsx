import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Moon, UserCog, ShieldOff, RefreshCw } from "lucide-react";
import { ensureNotificationPermission } from "@/lib/notifications";
import { toast } from "sonner";
import { AppLoader } from "@/components/AppLoader";
import { forceUpdateApp } from "@/lib/updateApp";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const NOTIF_KEY = "pulse:notifications-enabled";

function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [updating, setUpdating] = useState(false);

  const onUpdateApp = async () => {
    if (updating) return;
    setUpdating(true);
    toast.success("Updating Circle to the latest version…");
    await forceUpdateApp();
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(NOTIF_KEY);
    const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
    setNotifEnabled(stored === "true" && permission === "granted");
  }, []);

  const onToggleNotif = async (value: boolean) => {
    if (value) {
      const permission = await ensureNotificationPermission();
      if (permission !== "granted") {
        toast.error("Notification permission was denied in your browser.");
        return;
      }
      window.localStorage.setItem(NOTIF_KEY, "true");
      setNotifEnabled(true);
      toast.success("Notifications enabled");
    } else {
      window.localStorage.setItem(NOTIF_KEY, "false");
      setNotifEnabled(false);
      toast.success("Notifications muted");
    }
  };

  if (loading) return <AppLoader title="Loading settings" detail="Just a moment…" />;
  if (!user) return <AppLoader title="Redirecting to sign in" detail="Please wait…" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/30">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <Link to="/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to chats
        </Link>

        <Card className="p-6 md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize Circle to your preference.</p>
        </Card>

        <Card className="p-6 md:p-8 border-primary/30 bg-primary/5">
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <RefreshCw className={`size-5 text-primary ${updating ? "animate-spin" : ""}`} /> App version
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Not seeing new features? Force-refresh Circle to download the latest version.
          </p>
          <div className="mt-5">
            <Button onClick={onUpdateApp} disabled={updating} className="rounded-xl">
              <RefreshCw className={`size-4 mr-2 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Updating…" : "Update App"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <Bell className="size-5 text-primary" /> Notifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Get a system notification when a new message arrives while Circle is in the background.</p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <Label htmlFor="notif" className="text-sm">Enable browser notifications</Label>
            <Switch id="notif" checked={notifEnabled} onCheckedChange={onToggleNotif} />
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <Moon className="size-5 text-primary" /> Appearance
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Switch between a light and dark interface.</p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <Label htmlFor="dark" className="text-sm">Dark mode</Label>
            <Switch id="dark" checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <UserCog className="size-5 text-primary" /> Profile
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Update your name, avatar, phone number, or manage blocked users.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/profile"><UserCog className="size-4 mr-2" /> Edit profile</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/profile"><ShieldOff className="size-4 mr-2" /> Blocked users</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
