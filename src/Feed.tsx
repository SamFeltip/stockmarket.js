import { FeedMessage } from "./FeedMessage";
import type { Board } from "./types";
export function Feed({ board, busy, onPass }: { board: Board; busy: boolean; onPass: () => void })
{
    const { feed } = board;
    const myTurn = board.game.currentPlayerId === board.player._id;

    return (
        <aside id="offcanvasResponsive" className="rounded-start rounded-lg bg-white text-black p-3 d-lg-grid offcanvas-lg offcanvas-end" tabIndex={-1} aria-labelledby="offcanvasResponsiveLabel">
            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
                {feed[0] ? `${feed[0].title} ${feed[0].message}` : ""}
            </p>
            <div className="d-grid" style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}>
                <div className="d-flex flex-row justify-content-between">
                    <h2 className="text-black" id="offcanvasResponsiveLabel">Feed</h2>
                    <button type="button" className="btn-close d-block d-lg-none" data-bs-dismiss="offcanvas" data-bs-target="#offcanvasResponsive" aria-label="Close" />
                </div>
                <div id="feed-body" className="d-flex flex-column gap-1 overflow-auto">
                    {feed.length === 0 ? <p>no feed items yet</p> : feed.map((item) => (
                        <div className="d-flex flex-row gap-1 mb-3" key={item._id}>
                            <img height={56} width={56} className={`rounded bg-secondary ${item.colour === "grey" ? "p-2" : ""}`} src={item.imageRoot} alt={item.title} />
                            <div>
                                <h3 style={{ fontSize: "1.4rem" }} className="fw-bold text-capitalize text-black mb-0">{item.title}</h3>
                                <FeedMessage item={item} stocks={board.stocks} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {myTurn && (
                <button
                    id="pass-button"
                    className="btn btn-secondary w-100"
                    disabled={busy}
                    data-bs-dismiss="offcanvas"
                    data-bs-target="#offcanvasResponsive"
                    onClick={() =>
                    {
                        onPass();
                    }}
                >
                    PASS
                </button>
            )}
        </aside>
    );
}
