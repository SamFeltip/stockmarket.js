import { HeaderIcon } from "./GameHeader";

export { GameMetrics } from "./GameMetrics";

export function MobileGameActions()
{
    return (
        <div className="mobile-game-actions d-flex d-lg-none">
            <button
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#gameModal"
                aria-label="Game menu"
                title="Game menu"
            >
                <HeaderIcon menu />
            </button>
            <button
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasResponsive"
                aria-label="Feed"
                title="Activity feed"
            >
                <HeaderIcon />
            </button>
        </div>
    );
}
