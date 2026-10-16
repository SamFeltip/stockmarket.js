import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keys are piped directly to Convex; never printed or saved on disk.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const values = {
    JWT_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).trimEnd().replaceAll("\n", " "),
    JWKS: JSON.stringify({ keys: [{ ...jwk, use: "sig" }] }),
};
const cli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
for (const [name, value] of Object.entries(values))
{
    const result = spawnSync(process.execPath, [cli, "env", "set", name, ...process.argv.slice(2)], {
        input: value,
        encoding: "utf8",
    });
    if (result.status !== 0)
    {
        throw new Error(`Could not configure ${name}: ${result.stderr}`);
    }

    console.log(`Configured ${name}`);
}
