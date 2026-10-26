import { Component, lazy, Suspense, useEffect } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { AuthPage } from "./AuthPage";
import { Home, GameList, Users, CatalogEditor } from "./Pages";
import { CreateGame } from "./CreateGame";
import { GamePage } from "./GamePage";
import { friendlyError } from "./errors";
import { Loading } from "./shared";

const SpectatorPage = lazy(async () => import("./spectator/SpectatorPage"));

class Boundary extends Component<{ children: ReactNode }, { message: string }>
{
    state = { message: "" };
    static getDerivedStateFromError(error: Error)
    {
        return { message: friendlyError(error) };
    }

    componentDidCatch(_error: Error, _info: ErrorInfo)
    { /* Error is displayed by the route boundary. */ }

    render()
    {
        if (this.state.message)
        {
            return (
                <main className="d-flex justify-content-center align-items-center gap-3 p-3">
                    <div className="alert alert-danger" role="alert">{this.state.message}</div>
                    <Link className="btn btn-primary" to="/">Go Back</Link>
                </main>
            );
        }

        return this.props.children;
    }
}

function Logout()
{
    const { signOut } = useAuthActions();

    useEffect(() =>
    {
        void signOut();
    }, [signOut]);

    return <Loading />;
}

function ProtectedRoutes()
{
    const user = useQuery(api.users.me);
    if (!user)
    {
        return <Loading />;
    }

    return (
        <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/games/new" element={<CreateGame />} />
            <Route path="/games/show/:code" element={<GamePage />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/show/:id" element={<Users single />} />
            <Route path="/insights" element={<CatalogEditor />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export function App()
{
    const { isAuthenticated, isLoading } = useConvexAuth();
    const location = useLocation();
    if (isLoading)
    {
        return <Loading />;
    }

    return (
        <Boundary key={location.key}>
            <Routes>
                <Route path="/spectate/:code" element={<Suspense fallback={<Loading />}><SpectatorPage /></Suspense>} />
                <Route
                    path="*"
                    element={isAuthenticated ? <ProtectedRoutes /> : (
                        <Routes>
                            <Route path="/signup" element={<AuthPage signup />} />
                            <Route path="*" element={<AuthPage />} />
                        </Routes>
                    )}
                />
            </Routes>
        </Boundary>
    );
}
