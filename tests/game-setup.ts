import { pendingSuspensions } from "../shared/suspensions";
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

/** Unrelated round tests discard dealt chance cards through the same public display flow. */
export async function skipDealtSuspensions(client: Pick<Awaited<ReturnType<typeof setup>>["sam"], "query" | "mutation">,
    code = "test")
{
    const snapshot = await client.query(api.tv.board, { code });
    if (!snapshot?.reveal)
    {
        return;
    }

    const expectedPeriod = snapshot.game.currentPeriod;

    await client.mutation(api.rounds.beginSuspensions, { code, expectedPeriod });

    for (;;)
    {
        const board = await client.query(api.tv.board, { code });
        const players = board!.players.map((player) => ({ _id: player.id }));
        const queue = pendingSuspensions(expectedPeriod, players, board!.reveal!.insights);
        if (!queue[0])
        {
            return board;
        }

        await client.mutation(api.rounds.skipSuspension, { code, expectedPeriod, insightId: queue[0]._id });
    }
}
