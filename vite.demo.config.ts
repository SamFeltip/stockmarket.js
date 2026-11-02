import { copyFileSync } from "node:fs";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.ts";

export default mergeConfig(base, defineConfig({
    plugins: [{
        name: "demo-homepage",
        closeBundle()
        {
            copyFileSync("dist-demo/experiments/cash-dock.html", "dist-demo/index.html");
        },
    }],
    build: {
        outDir: "dist-demo",
        rollupOptions: { input: "experiments/cash-dock.html" },
    },
}));
