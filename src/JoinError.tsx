import { Link, useNavigate } from "react-router-dom";
import { LobbyCard } from "./LobbyCard";
import { formText } from "./shared";
import { describeJoinError } from "./join-error";

export function JoinError({ error, code }: { error: unknown; code: string })
{
    const navigate = useNavigate();
    const description = describeJoinError(error, code);

    return (
        <LobbyCard title={description.title}>
            <div className="bg-dark text-white rounded p-3 p-sm-4 d-grid gap-4">
                <p className="text-center" role="alert">{description.message}</p>
                <form
                    className="d-grid gap-3"
                    onSubmit={(event) =>
                    {
                        event.preventDefault();
                        const nextCode = formText(new FormData(event.currentTarget), "game").trim().toLowerCase();
                        if (nextCode === code.trim().toLowerCase())
                        {
                            // Rejoin the same URL by remounting the route after a connection error.
                            void navigate(`/games/show/${encodeURIComponent(nextCode)}`, {
                                replace: true, state: { retry: Date.now() },
                            });
                        }
                        else
                        {
                            void navigate(`/games/show/${encodeURIComponent(nextCode)}`);
                        }
                    }}
                >
                    <label className="form-label mb-0" htmlFor="retry-lobby-code">Lobby code</label>
                    <input
                        id="retry-lobby-code"
                        className="text-center form-control"
                        type="text"
                        name="game"
                        defaultValue={code}
                        placeholder="Enter a lobby code"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={32}
                        pattern="[a-zA-Z0-9_-]+"
                        required
                    />
                    <button type="submit" className="btn btn-primary py-3">Try joining again</button>
                </form>
                <div className="d-grid gap-3 lobby-actions">
                    <Link to="/" className="btn btn-secondary">Back home</Link>
                    <Link to="/games/new" className="btn btn-primary">Create a game</Link>
                </div>
            </div>
        </LobbyCard>
    );
}
