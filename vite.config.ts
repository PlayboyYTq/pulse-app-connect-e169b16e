import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig as defineViteConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

const pwaPlugin = VitePWA({
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
});

export default process.env.VERCEL
  ? defineViteConfig({
      resolve: {
        alias: {
          "@": `${process.cwd()}/src`,
        },
        dedupe: ["react", "react-dom"],
      },
      plugins: [
        tailwindcss(),
        tsconfigPaths({ projects: ["./tsconfig.json"] }),
        tanstackStart(),
        nitro({ preset: "vercel" }),
        react(),
        pwaPlugin,
      ],
    })
  : defineLovableConfig({
      vite: {
        plugins: [pwaPlugin],
      },
    });
