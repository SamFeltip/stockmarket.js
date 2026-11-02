import { Modal, money } from "./shared";
import type { Board } from "./types";
import "./player-dock.css";

// Names and effects follow BOARD_GAME_DIFFERENCES_CURRENT.md.
const powerUps = [
    { name: "Rights Issue", kind: "rights", icon: "+", effect: "50% extra shares", description: "Choose a company. All holders receive 50% extra shares, rounded down.", timing: "Applies to all holders of the chosen company" },
    { name: "Hold Stock Price", kind: "hold", icon: "＝", effect: "Freeze a company’s price", description: "Choose one company to suspend. Its share price stays unchanged when this period settles.", timing: "Choose a company before period-end settlement" },
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
