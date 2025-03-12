import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";

export default defineConfig({
  root: ".", 
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
    outDir: 'build', // Ensure this matches where your build output goes
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) return "vendor";
        },
      },
      external: ["structured-clone"], // Treat structured-clone as external if dynamically imported
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
  publicDir: path.resolve(__dirname, "public"),
});