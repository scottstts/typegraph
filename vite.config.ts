import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "dist/web",
    emptyOutDir: false,
    sourcemap: true
  },
  server: {
    host: "127.0.0.1",
    port: 5174
  }
});
