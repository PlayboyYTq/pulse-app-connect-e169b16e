import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCw, Sparkles, ExternalLink } from "lucide-react";

const GEN_URL = "https://minequest.fun/ai-features";

/**
 * GenTab — keeps the iframe mounted across tab switches so re-opening is instant.
 * If the remote site refuses to be framed (X-Frame-Options / CSP frame-ancestors),
 * we detect the load failure via a timeout and show a fallback that opens the page
 * in a new tab.
 */
export function GenTab({ visible }: { visible: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const autoOpenedRef = useRef(false);

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

  // Detect iframe blocked (no onLoad within 4s = likely X-Frame-Options/CSP refusal)
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [loaded, reloadKey]);

  // When blocked + tab becomes visible, auto-open once in a new tab
  useEffect(() => {
    if (blocked && visible && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      try { window.open(GEN_URL, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
    }
  }, [blocked, visible]);

  const refresh = () => {
    setLoaded(false);
    setBlocked(false);
    autoOpenedRef.current = false;
    setReloadKey((k) => k + 1);
  };

  const back = () => {
    try { iframeRef.current?.contentWindow?.history.back(); } catch { /* cross-origin */ }
  };

  const openExternal = () => {
    window.open(GEN_URL, "_blank", "noopener,noreferrer");
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
        <Button size="sm" variant="ghost" className="ml-auto h-9 rounded-xl gap-1.5 text-xs" onClick={openExternal}>
          <ExternalLink className="size-3.5" />
          Open
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!loaded && !blocked && (
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

        {blocked ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">AI Tools opened in a new tab</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                This site can't be embedded inside the app. We opened it for you in a new tab.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={openExternal} className="rounded-xl gap-1.5">
                <ExternalLink className="size-4" />
                Open AI Tools
              </Button>
              <Button variant="outline" onClick={refresh} className="rounded-xl gap-1.5">
                <RotateCw className="size-4" />
                Try again
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
