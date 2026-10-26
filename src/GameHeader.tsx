import { money } from "./shared";
import type { Board } from "./types";

export function HeaderIcon({ menu = false }: { menu?: boolean })
{
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {menu ? (
                <>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5M21 12H9" />
                </>
            )
                : (
                    <>
                        <path d="M11 8h6M11 12h6M11 16h4" />
                        <path d="M7 8h.01M7 12h.01M7 16h.01" />
                    </>
                )}
        </svg>
    );
}

export function GameHeader()
{
    return (
        <header className="game-status-card d-none d-lg-flex flex-column align-items-center justify-content-center gap-2 card card-green rounded p-3" style={{ backgroundColor: "var(--bs-card-bg)" }}>
            <button type="button" className="game-title-button p-0 border-0 bg-transparent" data-bs-toggle="modal" data-bs-target="#gameModal">
                <h1 id="stockmarket-header" className="sh-small mb-0">Stockmarket!</h1>
            </button>
            <button type="button" className="game-menu-button" data-bs-toggle="modal" data-bs-target="#gameModal" aria-label="Game menu" title="Game menu">
                <HeaderIcon menu />
                <span>Sign out</span>
            </button>
        </header>
    );
}

export function Profile({ board, view, setView }: { board: Board; view: "stocks" | "players"; setView: (view: "stocks" | "players") => void })
{
    const { user } = board;
    const own = board.players.find((p) => p._id === board.player._id);

    return (
        <div id="profile" className="card card-green d-grid align-items-center py-2 px-4 gap-2" style={{ gridTemplateColumns: "60px auto", backgroundColor: "var(--bs-card-bg)" }}>
            <div className="profile-toggle" style={{ width: 60, height: 60 }}>
                <button
                    type="button"
                    className="p-0 border-0 bg-transparent"
                    onClick={() =>
                    {
                        setView("players");
                    }}
                >
                    <img
                        id="show-users"
                        className={`rounded border border-primary border-2 ${view === "stocks" ? "infront" : "behind"}`}
                        height={60}
                        width={60}
                        src={user.profileRoot}
                        alt={user.name}
                    />
                </button>
                <button
                    type="button"
                    className="p-0 border-0 bg-transparent"
                    onClick={() =>
                    {
                        setView("stocks");
                    }}
                >
                    <img
                        id="show-stocks"
                        className={`rounded border border-primary border-2 p-2 ${view === "players" ? "infront" : "behind"}`}
                        style={{ backgroundColor: "var(--bs-primary)" }}
                        height={60}
                        width={60}
                        src="/static/imgs/icons/Stock.svg"
                        alt="stocks icon"
                    />
                </button>
            </div>
            <div className="d-none d-lg-block">
                <h2 className="text-capitalize mb-0" style={{ fontSize: "1.5rem" }}>{user.name}</h2>
                <p>
                    Cash £
                    {money(board.player.cash)}
                </p>
                <p>
                    Net £
                    {money(own?.netWorth ?? 0)}
                </p>
            </div>
        </div>
    );
}
