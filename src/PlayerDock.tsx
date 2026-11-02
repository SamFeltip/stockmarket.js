import { Modal, money } from "./shared";
import { chanceCards, chanceStockKey, privateCashPercent } from "../shared/chance-cards";
import type { Board } from "./types";
import "./player-dock.css";

export function PlayerDock({ board }: { board: Board })
{
    const ownCards = board.insights.filter((card) => card.playerId === board.player._id
      && card.period === board.game.currentPeriod);
    const granted = ownCards.filter((card) => card.stockKey === chanceStockKey && card.chanceKind)
        .flatMap((card) =>
        {
            const definition = chanceCards.find((item) => item.kind === card.chanceKind);

            return definition ? [{ ...definition, id: card._id }] : [];
        });
    const cashPercent = privateCashPercent(ownCards, board.player._id);
    const cashTone = cashPercent > 0 ? "success" : (cashPercent < 0 ? "danger" : "secondary");

    return (
        <section id="player-dock" className="card card-green rounded p-3" style={{ backgroundColor: "var(--bs-card-bg)" }} aria-label="Your cash, chance cards and cash insights">
            <div className="dock-cash">
                <strong className="dock-balance">
                    £
                    {money(board.player.cash)}
                </strong>
                <span className="dock-cash-label">cash</span>
                <div className="dock-cash-insight card bg-white text-black text-center">
                    <div className={`total-insight text-${cashTone} d-flex justify-content-center align-items-center`}>
                        {cashPercent !== 0 && <img className="pe-2" height={16} src={`/static/imgs/icons/stock_${cashPercent > 0 ? "up" : "down"}.svg`} alt={`Cash ${cashPercent > 0 ? "rising" : "falling"}`} />}
                        <span>{`${cashPercent >= 0 ? "+" : "−"}${Math.abs(cashPercent)}%`}</span>
                    </div>
                    <p>Cash insight</p>
                </div>
            </div>
            {granted.length > 0 ? (
                <div className="dock-powers">
                    <h2 id="chance-cards-label">Chance Cards</h2>
                    <div className="dock-power-cards" role="region" aria-labelledby="chance-cards-label">
                        {granted.map((card) => (
                            <button key={card.id} type="button" className={`dock-power-card dock-power-${card.kind}`} data-bs-toggle="modal" data-bs-target={`#chance-card-${card.id}`} aria-label={`${card.name}: ${card.effect}`}>
                                <span className="dock-power-icon" aria-hidden="true">{card.icon}</span>
                                <span className="dock-power-copy">
                                    <strong>{card.name}</strong>
                                    <span>{card.effect}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="dock-empty-cards">
                    <p>No Chance Cards</p>
                    <p>Chance cards may appear here each round</p>
                </div>
            )}
            {granted.map((card) => (
                <Modal key={card.id} id={`chance-card-${card.id}`} title={card.name} mobileDrawer>
                    <div className="modal-body dock-power-detail">
                        <h2 className="text-black">{card.name}</h2>
                        <h3>{card.effect}</h3>
                        <p>{card.description}</p>
                        <p className="dock-caption">{card.timing}</p>
                        <p className="dock-caption">Activation is coming soon.</p>
                    </div>
                    <div className="modal-footer trade-footer">
                        <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" className="btn btn-primary" disabled>Activate</button>
                    </div>
                </Modal>
            ))}
        </section>
    );
}
