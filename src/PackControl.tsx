import { packIds, packs, type Pack } from "../shared/packs";
import { PackIcon } from "./PackIcon";
import "./pack-control.css";

export function PackControl({ pack = "classic", busy, onChange }: {
    pack?: Pack; busy?: boolean; onChange?: (pack: Pack) => void;
})
{
    return (
        <section className="pack-control" aria-label="Stock pack">
            {onChange ? (
                <div className="pack-options" role="group" aria-label="Choose a stock pack">
                    {packIds.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`btn ${id === pack ? "btn-primary" : "pack-option-idle"} pack-option`}
                            aria-pressed={id === pack}
                            disabled={busy}
                            onClick={() => onChange(id)}
                        >
                            <PackIcon pack={id} />
                            <span>{packs[id].name}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="pack-current bg-dark rounded">
                    <PackIcon pack={pack} />
                    <strong>{packs[pack].name}</strong>
                </div>
            )}
            <p className="pack-summary" aria-live="polite">{packs[pack].summary}</p>
        </section>
    );
}
