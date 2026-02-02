import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "http";
import { createProxyMiddleware, type RequestHandler } from "http-proxy-middleware";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

function esProxyPlugin(): Plugin {
  return {
    name: "es-proxy",
    configureServer(server) {
      const proxy = createProxyMiddleware({
        changeOrigin: true,
        secure: false,
        router: (req: IncomingMessage) => {
          const targetHeader = req.headers["x-es-target"];
          if (typeof targetHeader === "string" && targetHeader.length > 0) {
            return targetHeader;
          }
          if (Array.isArray(targetHeader) && targetHeader[0]) {
            return targetHeader[0];
          }
          return "http://localhost:9200";
        },
        pathRewrite: {
          "^/es": ""
        },
        on: {
          proxyReq: (proxyReq, req) => {
            // 确保 Authorization 头被转发
            const auth = req.headers["authorization"];
            if (auth) {
              proxyReq.setHeader("Authorization", auth);
            }
          },
          error: (err, _req, res) => {
            if (res && "writeHead" in res) {
              (res as ServerResponse).writeHead(502, { "Content-Type": "application/json" });
              (res as ServerResponse).end(JSON.stringify({ error: err.message }));
            }
          }
        }
      }) as RequestHandler;

      server.middlewares.use("/es", (req, res, next) => {
        proxy(req, res, next);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), esProxyPlugin()],
  // Tauri 要求使用相对路径
  base: "./"
});
