import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./patch.css";

const root = document.querySelector("#root");
if (!root)
{
    throw new Error("Missing application root");
}

const url: unknown = import.meta.env.VITE_CONVEX_URL;
if (typeof url === "string" && url)
{
    const client = new ConvexReactClient(url);

    createRoot(root).render(
        <StrictMode>
            <ConvexAuthProvider client={client}>
                <BrowserRouter><App /></BrowserRouter>
            </ConvexAuthProvider>
        </StrictMode>,
    );
}
else
{
    createRoot(root).render(
        <main className="d-flex align-items-center justify-content-center p-4">
            <div className="card card-green p-4">
                <h1 id="stockmarket-header">Stockmarket!</h1>
                <p>Connect your Convex deployment to start playing.</p>
                <p>Set VITE_CONVEX_URL in .env.local, then restart the frontend.</p>
            </div>
        </main>,
    );
}
