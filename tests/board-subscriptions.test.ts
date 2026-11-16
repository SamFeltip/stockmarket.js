import { expect, it, vi } from "vitest";
import { useBoardSubscriptions } from "../src/use-board-subscriptions";
import { useTradeHistory } from "../src/use-trade-history";
import type { Id } from "../convex/_generated/dataModel";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("../src/use-trade-history", () => ({ useTradeHistory: vi.fn() }));

it("keeps the trade subscription reference stable while opening and launching a lobby", () =>
{
    const gameId = "game" as Id<"games">;
    const useHistory = vi.mocked(useTradeHistory);

    useBoardSubscriptions(undefined, undefined, false, 0, undefined, undefined);
    useBoardSubscriptions(gameId, 0, true, 1, 0, 5);
    useBoardSubscriptions(gameId, 0, false, 4, 0, 5);

    const [[initialQuery], [waitingQuery, waiting], [playingQuery, playing]] = useHistory.mock.calls;

    expect(waitingQuery).toBe(initialQuery);
    expect(playingQuery).toBe(initialQuery);
    expect(waiting).toBeUndefined();
    expect(playing).toEqual({ gameId, seatCount: 4, start: 0 });
});
