import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../convex/_generated/api";
import { PlayAnimation } from "../src/PlayAnimation";
import { Feed } from "../src/Feed";
import { Feed as SpectatorFeed } from "../src/spectator/Dashboard";
import { setup } from "./game-setup";
import type { CompanyRole } from "../shared/company-roles";

const cases: { held: number; quantity: number; stockKey?: number; otherChairman?: boolean;
    before?: CompanyRole; after?: CompanyRole; messages: string[] }[] = [
    { held: 0, quantity: 50_000, after: "director", messages: ["new director"] },
    { held: 0, quantity: 100_000, after: "chairman", messages: ["new chairman"] },
    { held: 90_000, quantity: 10_000, before: "director", after: "chairman", messages: ["promoted to chairman"] },
    { held: 100_000, quantity: 1000, before: "chairman", after: "chairman", messages: [] },
    { held: 100_000, quantity: -10_000, before: "chairman", after: "director",
        messages: ["demoted to director"] },
    { held: 100_000, quantity: -60_000, before: "chairman", messages: ["stepped down as chairman"] },
    { held: 50_000, quantity: -1000, before: "director", messages: ["stepped down as director"] },
    { held: 100_000, quantity: 1000, stockKey: 9, messages: [] },
    { held: 90_000, quantity: 10_000, otherChairman: true, before: "director", after: "director", messages: [] },
];

describe("trade role announcements", () =>
{
    for (const test of cases)
    {
        it(`records the role for ${test.held} shares and a ${test.quantity} trade in stock ${test.stockKey ?? 8}`, async () =>
        {
            const { t, sam } = await setup();

            await sam.mutation(api.games.start, { code: "test" });
            const initial = await sam.query(api.board.get, { code: "test" });

            await t.run(async (context) =>
            {
                await context.db.patch(initial.player._id, { cash: 1_000_000,
                    holdings: initial.player.holdings.map((holding) => holding.stockKey === 8
                        ? { ...holding, quantity: test.held } : holding) });

                if (test.otherChairman)
                {
                    await context.db.patch(initial.players[1]._id, { holdings: [{ stockKey: 8, quantity: 100_000 }] });
                }
            });
            await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0,
                stockKey: test.stockKey ?? 8, quantity: test.quantity });
            const board = await sam.query(api.board.get, { code: "test" });
            const event = board.feed.find((item) => item.quantity)!;
            const publicBoard = (await sam.query(api.tv.board, { code: "test" }))!;
            const publicEvent = publicBoard.feed.find((item) => item.quantity)!;

            expect(event.roleBefore).toBe(test.before);
            expect(event.roleAfter).toBe(test.after);
            expect(publicEvent.roleBefore).toBe(test.before);
            expect(publicEvent.roleAfter).toBe(test.after);
            // Render the recorded trade even after the live player has lost every holding.
            const historical = { ...board,
                players: board.players.map((player) => ({ ...player, holdings: [], roles: [] })), feed: [event] };
            const popup = renderToStaticMarkup(<PlayAnimation board={historical} preview />);
            const feed = renderToStaticMarkup(<Feed board={historical} />);
            const spectator = renderToStaticMarkup(<SpectatorFeed board={{ ...publicBoard, feed: [publicEvent] }} />);
            for (const html of [popup, feed, spectator])
            {
                if (test.messages.length === 0)
                {
                    expect(html).not.toContain("new chairman");
                    expect(html).not.toContain("new director");
                    expect(html).not.toContain("stepped down");
                }

                if (test.after)
                {
                    expect(html).toContain(`${test.after}.svg`);
                }
                else
                {
                    expect(html).not.toContain("chairman.svg");
                    expect(html).not.toContain("director.svg");
                }
            }

            for (const message of test.messages)
            {
                expect(popup).toContain(message);
            }

            for (const html of [feed, spectator])
            {
                expect(html).not.toContain("trade-role-change");
                expect(html).not.toContain("new director");
                expect(html).not.toContain("new chairman");
                expect(html).not.toContain("stepped down");
                expect(html).not.toContain("promoted to");
                expect(html).not.toContain("demoted to");
            }

            if (test.after)
            {
                expect(feed).toContain(`class="trade-role-label">${test.after}</p>`);
                expect(spectator).toContain(`class="trade-role-label">${test.after}</p>`);
            }
        });
    }
});
