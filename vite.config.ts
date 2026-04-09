import { defineConfig, loadEnv } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const host = env.TAURI_DEV_HOST;

  return {
    plugins: [sveltekit()],

    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
    },

    optimizeDeps: {
      entries: ["src/app.html"],
    },

    build: {
      target: "es2022",
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    clearScreen: false,
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
  };
});
