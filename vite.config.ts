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
    warmup: {
      clientFiles: ["./src/ui/main.tsx", "./src/ui/App.tsx", "./src/ui/Main/index.tsx"],
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
    // Explicit existing entries let Vite serve optimized modules before the crawl finishes.
    holdUntilCrawlEnd: false,
    include: [
      "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
      "antd/es/layout", "antd/es/button", "antd/es/message", "antd/es/spin",
      "antd/es/tabs", "antd/es/alert", "antd/es/select",
      "@ant-design/icons/InboxOutlined", "antd", "@ant-design/icons",
    ],
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
