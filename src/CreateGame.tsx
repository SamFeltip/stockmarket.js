import { gameLengths } from "../shared/rules";
import { useMutation } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, formText, useAction } from "./shared";
import { LobbyCard } from "./LobbyCard";

export function CreateGame()
{
    const create = useMutation(api.games.create);
    const navigate = useNavigate();
    const { run, busy, error } = useAction();

    return (
        <LobbyCard title="Create a game">
            <form
                className="create-game-form bg-dark text-white rounded d-grid"
                aria-busy={busy}
                onSubmit={(event) =>
                {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);

                    void run(async () =>
                    {
                        const code = await create({
                            code: formText(form, "code"), periodCount: Number(form.get("difficulty")),
                        });

                        await navigate(`/games/show/${code}`);
                    });
                }}
            >
                <div>
                    <label className="form-label" htmlFor="lobby-code">Lobby code</label>
                    <input
                        id="lobby-code"
                        className="form-control text-center"
                        type="text"
                        name="code"
                        placeholder="Choose a lobby code"
                        aria-describedby="lobby-code-help"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        pattern="[a-zA-Z0-9_-]+"
                        required
                        maxLength={32}
                        disabled={busy}
                    />
                    <p id="lobby-code-help" className="lobby-hint mt-2">
                        Share with friends. Use letters, numbers, hyphens or underscores.
                    </p>
                </div>
                <fieldset disabled={busy}>
                    <legend className="form-label fs-5">Game length</legend>
                    <div className="d-grid gap-2 lobby-lengths">
                        {gameLengths.map((periods, index) => (
                            <div key={periods}>
                                <input
                                    type="radio"
                                    className="btn-check"
                                    name="difficulty"
                                    id={`length-${index}`}
                                    value={periods - 1}
                                    defaultChecked={index === 0}
                                />
                                <label className="btn btn-outline-light w-100 py-3" htmlFor={`length-${index}`}>
                                    <span className="d-block">{`${periods} periods`}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>
                <Alert message={error} />
                <div className="d-grid gap-3 lobby-actions">
                    <Link to="/" className="btn btn-secondary d-flex align-items-center justify-content-center">Back</Link>
                    <button className="btn btn-primary py-3" type="submit" disabled={busy}>
                        {busy ? "Creating game…" : "Create game"}
                    </button>
                </div>
            </form>
        </LobbyCard>
    );
}
