// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually:
//   tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//   componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//   error logger plugins, and sandbox detection.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  cloudflare: process.env.VERCEL ? false : undefined,
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: { outputPath: "/index" },
    },
  },
  vite: {
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    environments: {
      client: {
        build: { outDir: "dist" },
      },
      ssr: {
        build: { outDir: ".output/server" },
      },
    },
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