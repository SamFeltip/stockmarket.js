import { Modal, money } from "./shared";
import type { Board } from "./types";
import "./player-dock.css";

const powerUps = [
    { name: "Buying power", kind: "buy", icon: "↗", effect: "+10% shares", description: "Get 10% extra shares on your next purchase. A little more stock for the same cash.", timing: "Use before buying" },
    { name: "Safety sell", kind: "sell", icon: "◇", effect: "Price protection", description: "Sell at the period’s opening price if the current price is lower. Protect one sale from a falling market.", timing: "Use before selling" },
];

/** POC only: power-ups and cash insights are examples, never trading mutations. */
export function PlayerDock({ board }: { board: Board })
{
    return (
        <section id="player-dock" className="card card-green rounded p-3" style={{ backgroundColor: "var(--bs-card-bg)" }} aria-label="Your cash, power-ups and cash insights">
            <div className="dock-cash">
                <strong className="dock-balance">
                    £
                    {money(board.player.cash)}
                </strong>
                <div className="dock-cash-insight">
                    <span>Cash insight</span>
                    <strong>
                        <img src="/static/imgs/icons/stock_up.svg" alt="Cash rising" />
                        {" "}
                        +20%
                    </strong>
                </div>
            </div>
            <div className="dock-powers">
                <h2>Power-ups</h2>
                <div className="dock-power-cards">
                    {powerUps.map((power) => (
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
            {powerUps.map((power) => (
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
