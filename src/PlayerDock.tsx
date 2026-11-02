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
        <section id="player-dock" aria-label="Your cash, power-ups and cash insights">
            <div className="dock-cash">
                <div className="dock-eyebrow">
                    <span className="dock-cash-symbol" aria-hidden="true">£</span>
                    {" "}
                    Your cash
                </div>
                <strong className="dock-balance">
                    £
                    {money(board.player.cash)}
                </strong>
                <p className="dock-caption">Available to invest</p>
            </div>
            <div className="dock-powers">
                <div className="dock-section-heading">
                    <h2>
                        Power-ups
                        <span className="dock-count">2</span>
                    </h2>
                    <span className="dock-preview">Coming soon · Preview</span>
                </div>
                <div className="dock-power-cards">
                    {powerUps.map((power) => (
                        <button key={power.kind} type="button" className={`dock-power-card dock-power-${power.kind}`} data-bs-toggle="modal" data-bs-target={`#power-preview-${power.kind}`} aria-label={`Preview ${power.name}: ${power.effect}`}>
                            <span className="dock-power-icon" aria-hidden="true">{power.icon}</span>
                            <span className="dock-power-copy">
                                <strong>{power.name}</strong>
                                <span>{power.effect}</span>
                            </span>
                            <span className="dock-card-arrow" aria-hidden="true">↗</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="dock-insights">
                <div className="dock-section-heading">
                    <h2>Cash insights</h2>
                    <span className="dock-private">Only you</span>
                </div>
                <div className="dock-insight-cards">
                    <div className="dock-cash-insight dock-insight-up">
                        <span aria-hidden="true">↗</span>
                        <strong>+10%</strong>
                        <span>Interest windfall</span>
                    </div>
                    <div className="dock-cash-insight dock-insight-down">
                        <span aria-hidden="true">↘</span>
                        <strong>−5%</strong>
                        <span>Bank levy</span>
                    </div>
                </div>
                <p className="dock-caption">Sample allocation · Revealed at period end</p>
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
