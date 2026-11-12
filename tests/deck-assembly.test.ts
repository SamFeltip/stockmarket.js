import { expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { specialDeck } from "../shared/chance-cards";
import { setup } from "./game-setup";

it("starts Classic with exactly the original 108 cards even if legacy database rows are changed", async () =>
{
    const { t, sam } = await setup();

    await t.mutation(internal.catalogAdmin.seed, {});
    const original = await t.run(async (context) =>
    {
        const cards = await context.db.query("insights").collect();

        await context.db.patch(cards[0]._id, { value: 999, description: "Legacy edit" });
        await context.db.delete(cards[1]._id);

        return cards.map(({ key, stockKey, value, description }) =>
            ({ id: `boardgame:insight:${key}`, stockKey, value, description }));
    });

    expect(original).toHaveLength(92);
    await sam.mutation(api.games.start, { code: "test" });
    const saved = await t.run((context) => context.db.query("gameCatalogs").unique());

    expect(saved?.cards).toEqual([...original, ...specialDeck("classic")]);
});

it("starts Frantic and deals its extra negative cards without any legacy insight rows", async () =>
{
    const { t, sam } = await setup();

    expect(await t.run((context) => context.db.query("insights").first())).toBeNull();
    await sam.mutation(api.games.setPack, { code: "test", pack: "frantic" });
    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });

    expect(board.insights.filter((card) => card.catalogCardId?.startsWith("frantic:downside:")).length)
        .toBeGreaterThan(12);
    expect(await t.run((context) => context.db.query("insights").first())).toBeNull();
});
