import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite"; // ⬅️ ADICIONE

export default defineConfig({
  plugins: [react(), tailwindcss()],        // ⬅️ ADICIONE
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "./node_modules/react"),
    },
  },
});
