import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./", // Required for Electron file:// protocol
  server: {
    port: 3009,
    allowedHosts: ["localhost", "127.0.0.1", "macos.nessie-alkaid.ts.net"],
    proxy: {
      "/api": "http://localhost:3010",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
