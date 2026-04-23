import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink, Wand2, Image as ImageIcon, MessageSquare, Mic } from "lucide-react";

const GEN_URL = "https://minequest.fun/ai-features";

/**
 * GenTab — launcher for external AI Tools (minequest.fun/ai-features).
 * The remote site blocks iframe embedding (X-Frame-Options / CSP frame-ancestors),
 * so instead of a broken embed we present a clean in-app launcher that opens the
 * tools in a new tab on user click.
 */
export function GenTab({ visible }: { visible: boolean }) {
  const open = () => window.open(GEN_URL, "_blank", "noopener,noreferrer");

  return (
    <div
      className="absolute inset-0 flex flex-col bg-background overflow-y-auto"
      style={{ display: visible ? "flex" : "none" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <Sparkles className="size-4 text-primary" />
        <div className="text-sm font-semibold">AI Tools</div>
        <Button size="sm" variant="ghost" className="ml-auto h-8 rounded-xl gap-1.5 text-xs" onClick={open}>
          <ExternalLink className="size-3.5" />
          Open
        </Button>
      </div>

      <div className="flex-1 px-5 py-8 max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="mx-auto size-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--color-primary)_70%,transparent)] mb-5">
            <Wand2 className="size-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate with AI</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Image generation, chat, voice tools and more — open the AI suite to start creating.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Feature icon={<ImageIcon className="size-5" />} title="Images" desc="Generate art" />
          <Feature icon={<MessageSquare className="size-5" />} title="Chat" desc="Ask anything" />
          <Feature icon={<Mic className="size-5" />} title="Voice" desc="Speech tools" />
        </div>

        <Button onClick={open} className="w-full h-12 rounded-2xl gap-2 text-sm font-semibold">
          <ExternalLink className="size-4" />
          Open AI Tools
        </Button>
        <p className="text-[11px] text-center text-muted-foreground mt-3">
          Opens minequest.fun in a new tab
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 text-center">
      <div className="mx-auto size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
        {icon}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
