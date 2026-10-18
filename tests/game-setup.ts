import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

export async function setup(periodCount = 5, humanCount = 4)
{
    const t = convexTest(schema, modules);
    const [samId, bobId, outsiderId, patId, leeId] = await t.run(async (context) =>
    {
        const ids = [];
        for (const name of ["sam", "bob", "outsider", "pat", "lee"])
        {
            ids.push(await context.db.insert("users", { name, email: name, profileRoot: "/static/imgs/1profile.png" }));
        }

        return ids;
    });
    const sam = t.withIdentity({ subject: `${samId}|session` });
    const bob = t.withIdentity({ subject: `${bobId}|session` });
    const outsider = t.withIdentity({ subject: `${outsiderId}|session` });

    const pat = t.withIdentity({ subject: `${patId}|session` });
    const lee = t.withIdentity({ subject: `${leeId}|session` });
    const clients = [sam, bob, pat, lee];

    await sam.mutation(api.games.create, { code: "TEST", periodCount });

    for (const client of clients.slice(1, humanCount))
    {
        await client.mutation(api.games.join, { code: "test" });
    }

    return { t, sam, bob, outsider, pat, lee, clients: clients.slice(0, humanCount) };
}
