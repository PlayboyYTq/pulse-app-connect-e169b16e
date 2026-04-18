import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, MessageCircle, Phone, Video, Users, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  head: () => ({
    meta: [
      { title: "Download Pulse for Android — APK" },
      { name: "description", content: "Download the Pulse Android APK and start chatting, calling, and connecting in seconds." },
    ],
  }),
});

const FEATURES = [
  { icon: MessageCircle, title: "Real-time chat", desc: "Instant messages with delivery and read states." },
  { icon: Phone, title: "Voice calls", desc: "Crystal-clear 1:1 voice over WebRTC." },
  { icon: Video, title: "Video calls", desc: "Face-to-face with mute and camera controls." },
  { icon: Users, title: "Group chats", desc: "Bring friends and teams together." },
  { icon: Shield, title: "Private by design", desc: "Row-level security on every message." },
  { icon: Zap, title: "Lightning fast", desc: "Sub-second sync, even on flaky networks." },
];

function DownloadPage() {
  const onDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info("APK coming soon — install the PWA in the meantime.");
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <Link to="/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to chats
        </Link>

        <header className="mt-8 flex flex-col items-center text-center">
          <img src="/icon-512.png" alt="Pulse app icon" width={112} height={112} className="size-28 rounded-[2rem] shadow-2xl" />
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight text-balance">Pulse for Android</h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            The full Pulse experience in a native Android wrapper. Get notifications, calls, and chat in one tap.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="text-base px-8 h-12">
              <a href="#" onClick={onDownload}><Download className="size-5 mr-2" /> Download APK</a>
            </Button>
            <Button asChild variant="secondary" size="lg" className="text-base px-8 h-12">
              <Link to="/install">Install as PWA</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">v1.0.0 · ~12 MB · Android 8+</p>
        </header>

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="surface-glass rounded-3xl p-6">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-6">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 surface-glass rounded-3xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-semibold">How to install the APK</h2>
          <ol className="mt-4 mx-auto max-w-md text-left text-sm text-muted-foreground space-y-2">
            <li><span className="font-semibold text-foreground">1.</span> Tap <em>Download APK</em> above.</li>
            <li><span className="font-semibold text-foreground">2.</span> Allow installs from your browser when prompted.</li>
            <li><span className="font-semibold text-foreground">3.</span> Open the downloaded file and tap <em>Install</em>.</li>
            <li><span className="font-semibold text-foreground">4.</span> Sign in and start chatting.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
