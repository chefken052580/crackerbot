import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";

export default defineConfig({
  root: ".", // Project root
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
    host: "0.0.0.0",
    strictPort: true,
  },
  build: {
    outDir: "build",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      input: "index.html", // Use index.html from root
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) return "vendor";
        },
      },
      external: ["structured-clone"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
  publicDir: "public", // Static assets from public/
});