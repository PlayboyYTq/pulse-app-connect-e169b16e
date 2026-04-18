import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Apple, Smartphone, Download, Bell, Camera, Mic, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/install")({
  component: InstallPage,
  head: () => ({
    meta: [
      { title: "Install Pulse — Add to your phone" },
      { name: "description", content: "Install Pulse on Android or iOS for a native app experience with notifications and offline support." },
    ],
  }),
});

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallPage() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) {
      toast.info("Open this page in Chrome on Android, then tap Install.");
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") toast.success("Installing Pulse…");
    setDeferred(null);
  };

  const requestPerms = async () => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {});
      toast.success("Permissions granted where allowed.");
    } catch {
      toast.error("Permission request failed.");
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to chats
        </Link>

        <header className="mt-6 flex flex-col items-center text-center">
          <img src="/icon-512.png" alt="Pulse app icon" width={96} height={96} className="size-24 rounded-3xl shadow-xl" />
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight">Install Pulse</h1>
          <p className="mt-2 max-w-lg text-sm sm:text-base text-muted-foreground">
            Add Pulse to your home screen for instant access, push-style alerts, and a full-screen, app-like experience.
          </p>
        </header>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="surface-glass rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Smartphone className="size-5" /></div>
              <h2 className="text-lg font-semibold">Android</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the button below in Chrome, Edge, or Brave. {installed && "✅ Already installed."}
            </p>
            <Button onClick={install} disabled={installed} className="mt-4 w-full" size="lg">
              {installed ? <><Check className="size-4 mr-2" /> Installed</> : <><Download className="size-4 mr-2" /> Install App</>}
            </Button>
          </div>

          <div className="surface-glass rounded-3xl p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Apple className="size-5" /></div>
              <h2 className="text-lg font-semibold">iPhone / iPad</h2>
            </div>
            <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span> Open Pulse in <strong className="text-foreground">Safari</strong>.</li>
              <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span> Tap the <Share2 className="inline size-4" /> Share button.</li>
              <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span> Choose <strong className="text-foreground">Add to Home Screen</strong>.</li>
            </ol>
            {isIOS && <p className="mt-3 text-xs text-primary">You're on iOS — follow the steps above in Safari.</p>}
          </div>
        </section>

        <section className="mt-6 surface-glass rounded-3xl p-6">
          <h3 className="text-lg font-semibold">Enable permissions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pulse needs notifications, microphone, and camera access for messages and calls.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm"><Bell className="size-4 text-primary" /> Notifications</div>
            <div className="flex items-center gap-2 text-sm"><Mic className="size-4 text-primary" /> Microphone</div>
            <div className="flex items-center gap-2 text-sm"><Camera className="size-4 text-primary" /> Camera</div>
          </div>
          <Button variant="secondary" onClick={requestPerms} className="mt-4 w-full sm:w-auto">Request permissions</Button>
        </section>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Prefer the Android APK? <Link to="/download" className="text-primary font-medium hover:underline">Download here</Link>.
        </div>
      </div>
    </div>
  );
}
