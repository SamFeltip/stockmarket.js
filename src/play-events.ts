import type { Board } from "./display-types";

export function newPlayEvents(board: Board, previousId?: string, previousAt = Infinity)
{
    const anchor = board.feed.findIndex((item) => item._id === previousId);
    const items = anchor === -1
        ? board.feed.filter((item) => item._creationTime > previousAt)
        : board.feed.slice(0, anchor);

    return items.filter((item) => item.colour !== "grey" && (Boolean(item.quantity)
      || item.message === "passed their go")).toReversed();
}
