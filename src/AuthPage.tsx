import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, useAction, formText } from "./shared";

export function AuthPage({ signup = false }: { signup?: boolean })
{
    const { signIn } = useAuthActions();
    const { run, busy, error } = useAction();
    const navigate = useNavigate();

    return (
        <main className="d-flex flex-column justify-content-center p-2">
            <div className="container rounded d-flex justify-content-center card card-green w-100" style={{ maxWidth: "40rem" }}>
                <div className="card-header text-center">
                    <h1 id={signup ? undefined : "stockmarket-header"}>
                        {signup ? "Sign up" : "Stockmarket!"}
                    </h1>
                </div>
                <div className="card-body">
                    <Alert message={error} />
                    <form
                        id={signup ? "signup" : "login"}
                        onSubmit={(event) =>
                        {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);

                            form.set("email", formText(form, "name").trim().toLowerCase());
                            form.set("flow", signup ? "signUp" : "signIn");
                            void run(async () =>
                            {
                                await signIn("password", form);
                                await navigate("/");
                            });
                        }}
                    >
                        {signup && (
                            <div className="d-grid gap-2 mb-2" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                                {[1, 2, 3, 4, 5].map((profile) => (
                                    <label key={profile} className="img-label rounded overflow-hidden" htmlFor={`image${profile}`}>
                                        <input className="image d-none" type="radio" id={`image${profile}`} name="profile" value={profile} defaultChecked={profile === 1} />
                                        <img className="w-100" src={`/static/imgs/${profile}profile.png`} alt={`Avatar ${profile}`} />
                                    </label>
                                ))}
                            </div>
                        )}
                        <input
                            id="name"
                            className="form-control mb-2"
                            type="text"
                            name="name"
                            placeholder="Username"
                            aria-label="Username"
                            autoComplete="username"
                            required
                            maxLength={32}
                            pattern="[a-zA-Z0-9_-]+"
                        />
                        <input
                            id="password"
                            className="form-control mb-4"
                            type="password"
                            name="password"
                            placeholder="Password"
                            aria-label="Password"
                            autoComplete={signup ? "new-password" : "current-password"}
                            required
                            minLength={signup ? 8 : 1}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <Link to={signup ? "/login" : "/signup"} className="btn btn-secondary">{signup ? "Log in" : "Create account"}</Link>
                            <button className="btn btn-primary" type="submit" disabled={busy}>{signup ? "Sign up" : "Login"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
