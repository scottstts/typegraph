import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "hosted",
  publicDir: "../public",
  plugins: [react()],
  resolve: {
    alias: {
      "/src": path.resolve(projectRoot, "src")
    }
  },
  build: {
    outDir: "../dist-hosted",
    emptyOutDir: true,
    sourcemap: true
  }
});
