import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function usePWAInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    setPlatform(detectPlatform());

    // Reuse globally-captured prompt if present
    if (typeof window !== "undefined" && window.__pulseDeferredPrompt) {
      setDeferred(window.__pulseDeferredPrompt);
    }

    const onAvailable = () => {
      if (window.__pulseDeferredPrompt) setDeferred(window.__pulseDeferredPrompt);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };

    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    }

    window.addEventListener("pulse:install-available", onAvailable);
    window.addEventListener("pulse:installed", onInstalled);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("beforeinstallprompt", onBIP);

    return () => {
      window.removeEventListener("pulse:install-available", onAvailable);
      window.removeEventListener("pulse:installed", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBIP);
    };
  }, []);

  const installPWA = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (typeof window !== "undefined") window.__pulseDeferredPrompt = null;
    return outcome;
  };

  return {
    platform,
    isInstallable: !!deferred && !isInstalled,
    isInstalled,
    installPWA,
  };
}
