import { writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
});

try
{
    const { runSimulations } = await server.ssrLoadModule("/scripts/simulate-npcs.ts");
    const report = runSimulations(Number(process.argv[2] ?? 200));

    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/npc-balance.json", JSON.stringify(report, null, 2) + "\n");
    console.log(`Completed ${report.games} paired seeded games; report: reports/npc-balance.json`);
}
finally
{
    await server.close();
}
