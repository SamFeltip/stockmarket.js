import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { portfolioCollapse } from "./bootstrap";
import { FinalHoldings } from "./FinalHoldings";
import { money } from "./shared";
import type { Board, Player } from "./types";

export function MobilePortfolio({ board, player, initiallyOpen, select }: {
    board: Board; player: Player; initiallyOpen: boolean; select: Dispatch<SetStateAction<string | null>>;
})
{
    const reference = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        const element = reference.current;
        if (!element)
        {
            return;
        }

        const instance = portfolioCollapse(element);
        const show = () => select(player._id);
        const hide = () => select((current) => current === player._id ? null : current);

        element.addEventListener("show.bs.collapse", show);
        element.addEventListener("hide.bs.collapse", hide);

        return () =>
        {
            element.removeEventListener("show.bs.collapse", show);
            element.removeEventListener("hide.bs.collapse", hide);

            if (element.classList.contains("collapsing"))
            {
                element.dispatchEvent(new Event("transitionend"));
            }

            instance?.dispose();
        };
    }, [player._id, select]);

    return (
        <div
            ref={reference}
            id={`portfolio-${player._id}`}
            className={`mobile-player-portfolio accordion-collapse collapse ${initiallyOpen ? "show" : ""}`}
            aria-labelledby={`player-heading-${player._id}`}
        >
            <div className="accordion-body text-black bg-white">
                <p>{`Cash £${money(player.cash)}`}</p>
                <FinalHoldings board={board} player={player} />
            </div>
        </div>
    );
}
