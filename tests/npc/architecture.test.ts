import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function files(directory: string): string[]
{
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? files(path.resolve(directory, entry.name))
            : [path.resolve(directory, entry.name)],
    );
}

function dependencies(file: string): string[]
{
    const imports = ts.preProcessFile(readFileSync(file, "utf8")).importedFiles;

    return imports.map((item) =>
    {
        expect(item.fileName.startsWith(".")).toBe(true);
        const base = path.resolve(path.dirname(file), item.fileName);

        return [base + ".ts", base + "/index.ts"].find((candidate) => existsSync(candidate))!;
    });
}

it("keeps all transitive engine dependencies inside pure contracts, shared rules and the engine", () =>
{
    const allowed = ["packages/npc-engine/src", "packages/game-contracts/src", "shared"].map(
        (directory) => path.resolve(directory) + "/",
    );
    const seen = new Set<string>();

    function walk(file: string)
    {
        expect(allowed.some((directory) => file.startsWith(directory))).toBe(true);

        if (seen.has(file))
        {
            return;
        }

        seen.add(file);

        for (const dependency of dependencies(file))
        {
            walk(dependency);
        }
    }

    for (const file of files(path.resolve("packages/npc-engine/src")))
    {
        walk(file);
    }
});
it("prevents core game modules from importing NPC integration or strategy transitively", () =>
{
    const seen = new Set<string>();

    function walk(file: string)
    {
        expect(file).not.toMatch(/\/npc\/|\/npc-engine\//);

        if (seen.has(file))
        {
            return;
        }

        seen.add(file);

        for (const item of ts.preProcessFile(readFileSync(file, "utf8")).importedFiles)
        {
            if (!item.fileName.startsWith("."))
            {
                continue;
            }

            const base = path.resolve(path.dirname(file), item.fileName);
            const target = [base + ".ts", base + "/index.ts"].find((candidate) =>
                existsSync(candidate),
            );
            if (target && !target.includes("_generated"))
            {
                walk(target);
            }
        }
    }

    for (const file of files(path.resolve("convex/game")))
    {
        walk(file);
    }
});
