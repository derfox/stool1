import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    nodePolyfills({
      include: ["stream", "crypto", "process"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    react(),
  ],
  build: {
    assetsDir: "_assets",
  },
}));
