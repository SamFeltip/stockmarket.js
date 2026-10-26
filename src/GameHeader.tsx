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

export function GameHeader({ board }: { board: Board })
{
    const { game, players } = board;

    return (
        <header className="game-status-card d-none d-sm-flex flex-column justify-content-center card card-green rounded p-3" style={{ backgroundColor: "var(--bs-card-bg)" }}>
            <div className="d-none d-sm-flex flex-column">
                <button type="button" className="p-0 border-0 bg-transparent" data-bs-toggle="modal" data-bs-target="#gameModal">
                    <h1
                        id="stockmarket-header"
                        className="sh-small d-none d-sm-block"
                        data-bs-toggle="modal"
                        data-bs-target="#gameModal"
                    >
                        Stockmarket!
                    </h1>
                </button>
                <div className="game-progress d-flex flex-sm-row flex-column justify-content-between">
                    <div className="text-nowrap">
                        Turn
                        {game.turn + 1}
                        /
                        {players.length * 3}
                    </div>
                    <div className="text-nowrap">
                        Period
                        {game.currentPeriod + 1}
                        /
                        {game.periodCount + 1}
                    </div>
                </div>
                <div className="p-0 p-sm-2 position-static position-sm-absolute end-0 top-0 gap-1 d-flex flex-row justify-content-between">
                    <button className="btn btn-primary d-block d-lg-none flex-fill" data-bs-toggle="offcanvas" data-bs-target="#offcanvasResponsive" aria-label="Feed" title="Activity feed">
                        <HeaderIcon />
                    </button>
                    <button className="btn btn-primary d-block d-sm-none flex-fill" data-bs-toggle="modal" data-bs-target="#gameModal" aria-label="Game menu">
                        <HeaderIcon menu />
                    </button>
                </div>
            </div>
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
            <div className="d-none d-sm-block">
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
