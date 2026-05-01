import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Disable Cloudflare Worker build when deploying to Node hosts (Railway, etc.)
// Set DEPLOY_TARGET=node in Railway env vars. Locally / in Lovable sandbox the
// default Cloudflare build is preserved so server functions keep working there.
const isNodeTarget = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  cloudflare: isNodeTarget ? false : undefined,
  vite: {
    plugins: [
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        injectRegister: false,
        manifest: false,
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
  },
});
