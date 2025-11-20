import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import packageJson from "./package.json" assert { type: "json" };

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit()],

  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
  },

  optimizeDeps: {
    entries: ["src/app.html"],
    include: [],
  },

  build: {
    target: "es2022",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
