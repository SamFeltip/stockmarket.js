import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../convex/_generated/api";
import { RightsIssue } from "../src/RightsIssue";
import { RightsIssueModal } from "../src/RightsIssueModal";
import { fixture } from "./rights-issue-setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("lists unowned stocks on the Frantic card and opens a private purchase for the card player", async () =>
{
    const { t, bob, board, command, insightId } = await fixture();

    await t.run(async (context) => await context.db.patch(board.game._id, { pack: "frantic" }));
    const current = await bob.query(api.board.get, { code: "test" });
    const client = new ConvexReactClient("https://frantic-rights-selector-test.invalid");
    const html = renderToStaticMarkup(
        <ConvexProvider client={client}>
            <RightsIssueModal board={current} insightId={insightId} used={false} />
        </ConvexProvider>,
    );

    expect(html.match(/type="radio"/g)).toHaveLength(current.stocks.filter((stock) => stock.display).length);
    expect(html).toContain("aria-label=\"Natwest: 0 stocks\"");
    expect(html).toContain("you can buy up to 5,000 shares");
    await bob.mutation(api.rightsIssue.activate, { ...command, stockKey: 12 });
    const opened = await bob.query(api.board.get, { code: "test" });

    expect(opened.game.rightsIssue?.offers).toEqual([{ playerId: board.player._id, held: 0, maximum: 5000 }]);
    expect(renderToStaticMarkup(<RightsIssue board={opened} playerId={board.player._id} />))
        .toContain("Maximum: 5,000 shares");
    await bob.mutation(api.rightsIssue.decide, { code: "test", insightId, expectedIndex: 0, quantity: 5000 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await bob.query(api.board.get, { code: "test" });

    expect(after.player.holdings).toContainEqual({ stockKey: 12, quantity: 5000 });
    expect(after.game.turn).toBe(command.expectedTurn + 1);
    expect(after.game.rightsIssue).toBeUndefined();
});
