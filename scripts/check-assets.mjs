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
const avatars = "shared/avatars.ts";
const avatarPaths = [...readFileSync(avatars, "utf8").matchAll(/"(\/static\/imgs\/[^"]+)"/g)].map(([, path]) => path);
for (const path of [...sourceFiles("src"), "convex/catalog.ts", "index.html", "public/static/manifest.json"])
{
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/["'](\/static\/[^"'${}]+)["']/g))
    {
        references.add(match[1]);
    }
}

for (const avatar of avatarPaths)
{
    references.add(avatar);
}

references.add("/static/fonts/BigCaslon.ttf");

const missing = [...references].filter((path) => !existsSync(`public${path}`) || !existsSync(`dist${path}`));
if (missing.length > 0)
{
    throw new Error(`Missing assets: ${missing.join(", ")}`);
}

for (const avatar of avatarPaths)
{
    const portrait = `dist${avatar}`;
    const source = readFileSync(`public${avatar}`);
    const header = source.subarray(0, 16).toString("hex");
    const isImage = header.startsWith("89504e470d0a1a0a") || header.startsWith("ffd8ff")
      || source.subarray(4, 12).toString() === "ftypavif";
    if (!existsSync(portrait) || !isImage || !readFileSync(portrait).equals(source))
    {
        throw new Error(`Missing, altered or invalid deployed portrait: ${portrait}`);
    }
}

console.log(`Verified ${references.size} referenced assets, including the original avatars and company logos.`);
