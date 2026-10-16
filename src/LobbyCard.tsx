import type { ReactNode } from "react";

export function LobbyCard({ title, children }: { title: string; children: ReactNode })
{
    return (
        <main className="d-flex flex-column justify-content-center p-2 lobby-page">
            <div className="container-fluid rounded card card-green lobby-card">
                <header className="card-header text-center pt-4">
                    <h1 id="stockmarket-header">Stockmarket!</h1>
                    <h2>{title}</h2>
                </header>
                <div className="card-body p-3 p-sm-4">
                    {children}
                </div>
            </div>
        </main>
    );
}
