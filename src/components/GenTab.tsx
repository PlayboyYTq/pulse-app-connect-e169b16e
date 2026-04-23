import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCw, Sparkles } from "lucide-react";

const GEN_URL = "https://minequest.fun/ai-features";

/**
 * GenTab — keeps the iframe mounted across tab switches so re-opening is instant.
 * Parent should render this once and toggle visibility (display: none) instead of unmounting.
 */
export function GenTab({ visible }: { visible: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Preconnect once on mount for fastest first paint
  useEffect(() => {
    if (typeof document === "undefined") return;
    const links: HTMLLinkElement[] = [];
    const add = (rel: string) => {
      const l = document.createElement("link");
      l.rel = rel;
      l.href = "https://minequest.fun";
      if (rel === "preconnect") l.crossOrigin = "";
      document.head.appendChild(l);
      links.push(l);
    };
    add("preconnect");
    add("dns-prefetch");
    return () => { links.forEach((l) => l.remove()); };
  }, []);

  const refresh = () => {
    setLoaded(false);
    setReloadKey((k) => k + 1);
  };

  const back = () => {
    try { iframeRef.current?.contentWindow?.history.back(); } catch { /* cross-origin */ }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col bg-background"
      style={{ display: visible ? "flex" : "none" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border/70 bg-card/80 backdrop-blur-xl">
        <Button size="icon" variant="ghost" className="size-9 rounded-xl" onClick={back} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" className="size-9 rounded-xl" onClick={refresh} aria-label="Refresh">
          <RotateCw className="size-4" />
        </Button>
        <div className="ml-1 flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          AI Tools
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col gap-3 p-4 animate-pulse bg-background">
            <div className="h-8 w-2/3 rounded-xl bg-muted" />
            <div className="h-32 rounded-2xl bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 rounded-2xl bg-muted" />
              <div className="h-24 rounded-2xl bg-muted" />
            </div>
            <div className="h-24 rounded-2xl bg-muted" />
          </div>
        )}
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={GEN_URL}
          title="AI Tools"
          loading="eager"
          onLoad={() => setLoaded(true)}
          allow="clipboard-write; fullscreen; camera; microphone"
          className="absolute inset-0 w-full h-full border-0"
          style={{ touchAction: "pan-x pan-y" }}
        />
      </div>
    </div>
  );
}
