import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Check if we're running in Tauri
  const isTauri = process.env.TAURI_PLATFORM !== undefined || process.env.TAURI_DEBUG === "1";

  return {
    // Tauri expects a fixed port, fail if that port is not available
    server: isTauri
      ? {
          port: 1420,
          strictPort: true,
          watch: {
            // Tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
          },
        }
      : {
          host: "::",
          port: 8080,
        },
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.app/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ["VITE_", "TAURI_"],
    build: {
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
      // don't minify for debug builds
      minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
