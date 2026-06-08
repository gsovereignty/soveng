import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/soveng/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "build",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // v1.1: prevent Vite esbuild pre-bundler from parsing ONNX/WASM imports
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  // v1.1: workers must be ES modules for dynamic import() inside them
  worker: {
    format: "es",
  },
})
