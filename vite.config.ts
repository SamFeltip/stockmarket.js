import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
    plugins: [react()],
    server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
    // Worktrees may share node_modules; keep each dev server's optimized modules separate.
    cacheDir: ".vite",
    optimizeDeps: { include: ["recharts"] },
});
