import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";

export default defineConfig({
  root: ".", // Root directory
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
    outDir: path.resolve(__dirname, "dist"), // Build output directory
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"), // Ensure it references `index.html`
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // Alias for `src/`
      "@components": path.resolve(__dirname, "src/components"), // Alias for components
    },
  },
  publicDir: path.resolve(__dirname, "public"), // Static assets
});
