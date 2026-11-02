import { Modal, money } from "./shared";
import type { Board } from "./types";
import "./player-dock.css";

// Names and effects follow BOARD_GAME_DIFFERENCES_CURRENT.md.
const chanceCards = [
    { name: "Rights Issue", kind: "rights", icon: "+", effect: "50% extra shares", description: "Choose a company. All holders receive 50% extra shares, rounded down.", timing: "Played as a bargain under the general chance-card rule; the individual card entry does not specify a turn cost" },
    { name: "Share Suspended", kind: "hold", icon: "＝", effect: "Freeze a company’s price", description: "Choose one company to suspend. Its share price stays at the previous period’s level when this period settles. This card cannot be retained.", timing: "Play at the end of the round" },
    { name: "Government Loan Stock", kind: "loan", icon: "£", effect: "Collect £10,000", description: "Your Government Loan Stock has matured. Collect £10,000 from the stockbroker.", timing: "Uses one bargain (turn)" },
    { name: "Debenture", kind: "debenture", icon: "◇", effect: "Bankruptcy protection", description: "Retain this card as insurance. If a company goes bankrupt, claim the full purchase price of shares you still hold in that company.", timing: "Claim within two rounds of the bankruptcy" },
    { name: "Option", kind: "option", icon: "⇄", effect: "Reserve a buy or sell price", description: "Choose a company and reserve its current share price for a future purchase or sale. Exercise the option and surrender the card within three periods.", timing: "Reserving the price and exercising the option each use one turn" },
];

/** POC only: chance cards and cash insights are examples, never trading mutations. */
export function PlayerDock({ board }: { board: Board })
{
    return (
        <section id="player-dock" className="card card-green rounded p-3" style={{ backgroundColor: "var(--bs-card-bg)" }} aria-label="Your cash, chance cards and cash insights">
            <div className="dock-cash">
                <strong className="dock-balance">
                    £
                    {money(board.player.cash)}
                </strong>
                <span className="dock-cash-label">cash</span>
                <div className="dock-cash-insight card bg-white text-black text-center">
                    <div className="total-insight text-success d-flex justify-content-center align-items-center">
                        <img className="pe-2" height={16} src="/static/imgs/icons/stock_up.svg" alt="Cash rising" />
                        <span>+20%</span>
                    </div>
                    <p>Cash insight</p>
                </div>
            </div>
            <div className="dock-powers">
                <h2 id="chance-cards-label">chance cards</h2>
                <div className="dock-power-cards" role="region" aria-labelledby="chance-cards-label">
                    {chanceCards.map((power) => (
                        <button key={power.kind} type="button" className={`dock-power-card dock-power-${power.kind}`} data-bs-toggle="modal" data-bs-target={`#power-preview-${power.kind}`} aria-label={`Preview ${power.name}: ${power.effect}`}>
                            <span className="dock-power-icon" aria-hidden="true">{power.icon}</span>
                            <span className="dock-power-copy">
                                <strong>{power.name}</strong>
                                <span>{power.effect}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            {chanceCards.map((power) => (
                <Modal key={power.kind} id={`power-preview-${power.kind}`} title={power.name}>
                    <div className="modal-body dock-power-detail">
                        <span className="dock-preview">Coming soon · Example card</span>
                        <h3>{power.effect}</h3>
                        <p>{power.description}</p>
                        <p className="dock-caption">
                            {power.timing}
                            . This preview does not affect your trades.
                        </p>
                    </div>
                    <div className="modal-footer"><button type="button" className="btn btn-primary" data-bs-dismiss="modal">Got it</button></div>
                </Modal>
            ))}
        </section>
    );
}
