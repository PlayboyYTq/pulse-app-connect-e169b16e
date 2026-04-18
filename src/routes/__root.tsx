import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { CallProvider } from "@/lib/calls";
import { CallScreen } from "@/components/CallScreen";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";
import { registerServiceWorker } from "@/lib/registerSW";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#3B82F6" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pulse" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Pulse — Real-time Messaging" },
      { name: "description", content: "Modern minimal real-time chat. Sign up, find friends, and message instantly." },
      { property: "og:title", content: "Pulse — Real-time Messaging" },
      { name: "twitter:title", content: "Pulse — Real-time Messaging" },
      { property: "og:description", content: "Modern minimal real-time chat. Sign up, find friends, and message instantly." },
      { name: "twitter:description", content: "Modern minimal real-time chat. Sign up, find friends, and message instantly." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c53039d2-07b8-4751-bf8a-44d2905bcc19/id-preview-635833f6--d1cdc786-0f1a-40f2-95c9-e94f5b1a057a.lovable.app-1776530935261.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c53039d2-07b8-4751-bf8a-44d2905bcc19/id-preview-635833f6--d1cdc786-0f1a-40f2-95c9-e94f5b1a057a.lovable.app-1776530935261.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" },
    ],
    scripts: [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <Outlet />
          <CallScreen />
          <Toaster richColors position="top-center" />
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
