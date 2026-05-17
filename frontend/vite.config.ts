import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
      // When running behind a reverse proxy (e.g. nginx on lightstudio.biz),
      // set DEV_PROXY_HOST=lightstudio.biz so the HMR client connects through
      // the proxy instead of trying localhost:8080 from a remote browser.
      ...(process.env.DEV_PROXY_HOST
        ? {
            host: process.env.DEV_PROXY_HOST,
            clientPort: 443,
            protocol: 'wss',
          }
        : {}),
    },
  },
  plugins: [react()],
  // Required for the @jsquash WASM workers to bundle correctly with code-splitting.
  worker: { format: 'es' },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
