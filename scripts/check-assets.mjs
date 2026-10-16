import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

function sourceFiles(directory)
{
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    {
        const filePath = path.join(directory, entry.name);

        return entry.isDirectory() ? sourceFiles(filePath) : [filePath];
    });
}

const references = new Set();
for (const path of [...sourceFiles("src"), "convex/catalog.ts", "index.html", "public/static/manifest.json"])
{
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/["'](\/static\/[^"'${}]+)["']/g))
    {
        references.add(match[1]);
    }
}

for (let avatar = 1; avatar <= 5; avatar++)
{
    references.add(`/static/imgs/${avatar}profile.png`);
}

const missing = [...references].filter((path) => !existsSync(`public${path}`));
if (missing.length > 0)
{
    throw new Error(`Missing assets: ${missing.join(", ")}`);
}

console.log(`Verified ${references.size} referenced assets, including the original avatars and company logos.`);
