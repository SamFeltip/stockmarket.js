import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, Loading, useAction, formText } from "./shared";
import type { Board } from "./types";

export function Home({ user }: { user: Board["user"] })
{
    const navigate = useNavigate();

    return (
        <main className="d-flex flex-column justify-content-center p-2 position-relative">
            <div className="position-absolute p-3 top-0 start-0">
                <Link to="/logout" className="d-flex flex-row align-items-center gap-2 text-decoration-none">
                    <img height="64em" className="rounded-circle" src={user.profileRoot} alt={user.name} />
                    <span className="text-white text-capitalize">{user.name}</span>
                </Link>
            </div>
            <div className="container-fluid rounded d-flex justify-content-center card card-green" style={{ maxWidth: "40rem" }}>
                <header className="card-header text-center">
                    <h1 id="stockmarket-header">Stockmarket!</h1>
                    <h2>Welcome to stockmarket</h2>
                </header>
                <div id="home-screen" className="card-body d-grid gap-3">
                    <form
                        className="bg-dark rounded text-center p-5"
                        onSubmit={(event) =>
                        {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget, (event.nativeEvent).submitter);
                            const code = formText(form, "game").trim().toLowerCase();

                            const path = form.get("intent") === "spectate" ? "/spectate" : "/games/show";

                            void navigate(`${path}/${encodeURIComponent(code)}`);
                        }}
                    >
                        <h3>Join game</h3>
                        <input
                            className="text-center form-control mb-3"
                            type="text"
                            name="game"
                            placeholder="Lobby number"
                            aria-label="Lobby number"
                            maxLength={32}
                            pattern="[a-zA-Z0-9_-]+"
                            required
                        />
                        <div className="d-flex justify-content-center gap-3">
                            <button type="submit" className="btn btn-primary px-5">Join</button>
                            <button type="submit" name="intent" value="spectate" className="btn btn-outline-light">Spectate</button>
                        </div>
                    </form>
                    <Link to="/games/new" className="btn btn-primary d-flex flex-column justify-content-center align-items-center text-center p-5">
                        <img width={48} height={39} src="/static/imgs/icons/Handshake.svg" alt="" />
                        <div>Start game</div>
                    </Link>
                </div>
            </div>
        </main>
    );
}

export function GameList()
{
    const games = useQuery(api.games.list);
    if (!games)
    {
        return <Loading />;
    }

    return (
        <main className="d-flex flex-column justify-content-center p-2">
            <div className="container rounded">
                <div className="d-flex justify-content-between pb-3">
                    <h1 className="primary">Games</h1>
                    <Link className="d-flex align-items-center btn btn-primary" to="/games/new">New Game</Link>
                </div>
                {games.map((game) => (
                    <div className="row border rounded px-3 py-4" key={game._id}>
                        <div className="col-md-4">
                            <h2>
                                ID:
                                {game.code}
                            </h2>
                            <Link className="btn btn-default btn-outline-secondary" to={`/games/show/${game.code}`}>View Game</Link>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}

export function Users({ single = false }: { single?: boolean })
{
    const users = useQuery(api.users.list);
    const { id } = useParams();
    if (!users)
    {
        return <Loading />;
    }

    return (
        <div>
            {single ? users.find((user) => user._id === id)?.name ?? "No user found!"
                : users.map((user) => <p key={user._id}>{user.name}</p>)}
        </div>
    );
}

export function CatalogEditor()
{
    const insights = useQuery(api.catalogAdmin.list);
    const update = useMutation(api.catalogAdmin.updateDescription);
    const { run, busy, error } = useAction();
    if (!insights)
    {
        return <Loading />;
    }

    return (
        <div className="container">
            <h1>Insights</h1>
            <Alert message={error} />
            {insights.map((insight) => (
                <div className="card mb-2" key={insight._id} id={`insight-${insight.key}`}>
                    <div className="card-header d-flex flex-row align-items-center gap-2 py-2">
                        <img
                            height={50}
                            src={insight.stock?.imagePath}
                            alt={insight.stock?.name}
                        />
                        <h1 className="text-black mb-0">{insight.stock?.name}</h1>
                    </div>
                    <div className="card-body">
                        <form onSubmit={(event) =>
                        {
                            event.preventDefault();
                            const description = formText(new FormData(event.currentTarget), "Description");

                            void run(() => update({ insightId: insight._id, description }));
                        }}
                        >
                            <div className="row">
                                <div className="col-2"><input className="form-control text-center" aria-label="Value" value={`£${insight.value.toFixed(2)}`} disabled /></div>
                                <div className="col-8"><input className="form-control" name="Description" aria-label="Description" defaultValue={insight.description} required /></div>
                                <input type="submit" className="col-2 btn btn-secondary" value="Update" disabled={busy} />
                            </div>
                        </form>
                    </div>
                </div>
            ))}
        </div>
    );
}
