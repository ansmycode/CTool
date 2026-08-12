import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: `dist-react`,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // 这里设置 @ 指向 src 目录
    },
  },
});
