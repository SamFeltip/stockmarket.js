import { ConvexError } from "convex/values";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authDestination } from "../shared/auth-destination";
import { validUsername } from "../shared/names";
import { usernameHelp } from "./errors";
import { Alert, useAction, formText } from "./shared";

export function AuthPage({ signup = false }: { signup?: boolean })
{
    const { signIn } = useAuthActions();
    const { run, busy, error } = useAction();
    const navigate = useNavigate();
    const location = useLocation();
    const destination = authDestination(location.pathname, location.search);
    const authLink = `${signup ? "/login" : "/signup"}?next=${encodeURIComponent(destination)}`;

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
                                if (!validUsername(formText(form, "name")))
                                {
                                    throw new ConvexError(usernameHelp);
                                }

                                if (signup && formText(form, "password").length < 8)
                                {
                                    throw new Error("Invalid password");
                                }

                                await signIn("password", form);
                                await navigate(destination);
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

                        />
                        <p className="auth-switch text-center mb-3">
                            {signup ? "already have an account? " : "don’t have an account? "}
                            <Link to={authLink}>
                                {signup ? "Click here to log in" : "Click here to create one"}
                            </Link>
                        </p>
                        <button className="btn btn-primary w-100" type="submit" disabled={busy}>
                            {busy ? "Please wait…" : (signup ? "Sign up" : "Login")}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
