import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

export async function setup(periodCount = 0)
{
    const t = convexTest(schema, modules);
    const [samId, bobId, outsiderId] = await t.run(async (context) =>
    {
        const ids = [];
        for (const name of ["sam", "bob", "outsider"])
        {
            ids.push(await context.db.insert("users", { name, email: name, profileRoot: "/static/imgs/1profile.png" }));
        }

        return ids;
    });
    const sam = t.withIdentity({ subject: `${samId}|session` });
    const bob = t.withIdentity({ subject: `${bobId}|session` });
    const outsider = t.withIdentity({ subject: `${outsiderId}|session` });

    await sam.mutation(api.games.create, { code: "TEST", periodCount });
    await bob.mutation(api.games.join, { code: "test" });

    return { t, sam, bob, outsider };
}
