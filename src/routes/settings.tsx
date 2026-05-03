import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Bell, Moon, UserCog, ShieldOff, RefreshCw, Search,
  KeyRound, Lock, ListChecks, MessageSquare, Database, Accessibility,
  Globe, HelpCircle, Smartphone, UserPlus, ChevronRight, QrCode, Plus,
} from "lucide-react";
import { ensureNotificationPermission } from "@/lib/notifications";
import { toast } from "sonner";
import { AppLoader } from "@/components/AppLoader";
import { forceUpdateApp } from "@/lib/updateApp";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const NOTIF_KEY = "pulse:notifications-enabled";

function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState("");
  const [openInfo, setOpenInfo] = useState<null | { title: string; body: string }>(null);

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

  const showInfo = (title: string, body: string) => setOpenInfo({ title, body });
  const inviteFriends = async () => {
    const shareData = {
      title: "Join me on Circle",
      text: "Hey! I'm using Circle to chat. Join me:",
      url: typeof window !== "undefined" ? window.location.origin : "https://mcpee.fun",
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast.success("Invite link copied to clipboard");
      }
    } catch {
      // user cancelled
    }
  };

  type Row = {
    icon: ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    onClick?: () => void;
    to?: string;
    right?: React.ReactNode;
    keywords?: string;
  };

  const sections: { title?: string; rows: Row[] }[] = [
    {
      rows: [
        { icon: UserPlus, title: "Invite a friend", subtitle: "Invite people to chat on Circle", onClick: inviteFriends },
      ],
    },
    {
      rows: [
        { icon: KeyRound, title: "Account", subtitle: "Security, change number, log out", to: "/profile" },
        { icon: Lock, title: "Privacy", subtitle: "Blocked accounts, last seen, read receipts", to: "/profile", keywords: "blocked" },
        { icon: ListChecks, title: "Lists", subtitle: "Manage people and groups", onClick: () => showInfo("Lists", "Custom lists let you organize friends and groups. Coming soon to Circle.") },
        { icon: MessageSquare, title: "Chats", subtitle: "Theme, wallpapers, chat history",
          right: <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Dark mode" />,
          keywords: "theme dark light wallpaper" },
        { icon: Bell, title: "Notifications", subtitle: "Message, group & call tones",
          right: <Switch checked={notifEnabled} onCheckedChange={onToggleNotif} aria-label="Notifications" /> },
        { icon: Database, title: "Storage and data", subtitle: "Network usage, auto-download",
          onClick: () => showInfo("Storage and data", "Circle stores your messages and media in your browser cache. Use the Update App option below to clear and reload caches.") },
        { icon: Accessibility, title: "Accessibility", subtitle: "Increase contrast, animation",
          onClick: () => showInfo("Accessibility", "Circle inherits your system contrast and reduced-motion preferences automatically.") },
        { icon: Globe, title: "App language", subtitle: "English (device's language)",
          onClick: () => showInfo("App language", "Circle uses your device language. More languages will be available soon.") },
        { icon: HelpCircle, title: "Help and feedback", subtitle: "Help center, contact us, privacy policy",
          onClick: () => showInfo("Help & feedback", "Need help? Email support@mcpee.fun. We read every message.") },
        { icon: Smartphone, title: "App updates", subtitle: updating ? "Updating to the latest version…" : "Force-refresh to the latest version",
          onClick: onUpdateApp },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = sections.map((s) => ({
    ...s,
    rows: q ? s.rows.filter((r) => `${r.title} ${r.subtitle} ${r.keywords ?? ""}`.toLowerCase().includes(q)) : s.rows,
  })).filter((s) => s.rows.length > 0);

  const displayName = profile?.name || user.email?.split("@")[0] || "You";
  const status = profile?.status || "Hey there! I'm on Circle.";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate({ to: "/chats" })} aria-label="Back" className="p-2 -ml-2 rounded-full hover:bg-accent">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight flex-1">Settings</h1>
          <button aria-label="Search" className="p-2 rounded-full hover:bg-accent" onClick={() => {
            const el = document.getElementById("settings-search") as HTMLInputElement | null;
            el?.focus();
          }}>
            <Search className="size-5" />
          </button>
        </div>
        <div className="max-w-xl mx-auto px-4 pb-3">
          <input
            id="settings-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            className="w-full h-10 rounded-full bg-muted px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </header>

      <main className="max-w-xl mx-auto pb-10">
        {/* Profile header */}
        <Link to="/profile" className="block">
          <div className="flex items-center gap-4 px-4 py-4 hover:bg-accent/50 transition-colors">
            <Avatar className="size-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback>{initials(displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold truncate">{displayName}</div>
              <div className="inline-flex max-w-full items-center gap-1 mt-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs truncate">
                <span className="truncate">{status}</span>
              </div>
            </div>
            <button aria-label="QR code" className="p-2 rounded-full hover:bg-accent" onClick={(e) => { e.preventDefault(); showInfo("Your QR code", "Friends can scan your code to add you instantly. QR sharing is coming soon."); }}>
              <QrCode className="size-5 text-primary" />
            </button>
            <button aria-label="Add status" className="p-2 rounded-full hover:bg-accent" onClick={(e) => { e.preventDefault(); navigate({ to: "/profile" }); }}>
              <Plus className="size-5 text-primary" />
            </button>
          </div>
        </Link>

        <div className="px-4 py-2 text-xs text-muted-foreground border-y border-border bg-muted/40">
          This is a linked device. <button className="text-primary underline-offset-2 hover:underline" onClick={() => showInfo("Linked devices", "Circle works across all your devices. Sign in on any browser to continue your chats.")}>Learn more</button>
        </div>

        {filtered.map((section, i) => (
          <div key={i} className="mt-2">
            {section.title && <div className="px-4 pt-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title}</div>}
            <ul className="divide-y divide-border/60">
              {section.rows.map((row) => {
                const Icon = row.icon;
                const content = (
                  <div className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors">
                    <Icon className="size-6 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium truncate">{row.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{row.subtitle}</div>
                    </div>
                    {row.right ?? <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                  </div>
                );
                return (
                  <li key={row.title}>
                    {row.to ? (
                      <Link to={row.to}>{content}</Link>
                    ) : (
                      <button type="button" onClick={row.onClick} className="w-full text-left">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No settings match "{query}".</div>
        )}

        <div className="px-4 pt-8 pb-2 text-center text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1"><RefreshCw className={`size-3 ${updating ? "animate-spin" : ""}`} /> Circle by mcpee.fun</div>
        </div>
      </main>

      <Dialog open={!!openInfo} onOpenChange={(v) => !v && setOpenInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openInfo?.title}</DialogTitle>
            <DialogDescription>{openInfo?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpenInfo(null)} className="rounded-xl">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
