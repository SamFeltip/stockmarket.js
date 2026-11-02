import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    // Worktrees may share node_modules; keep each dev server's optimized modules separate.
    cacheDir: ".vite",
    optimizeDeps: { include: ["recharts"] },
});
