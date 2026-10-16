import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { modalInstance } from "./bootstrap";
import { friendlyError } from "./errors";
import type { Insight, Stock } from "./types";

export const money = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export function useAction()
{
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function run(action: () => Promise<unknown>)
    {
        setError("");
        setBusy(true);

        try
        {
            await action();

            return true;
        }
        catch (error_)
        {
            setError(friendlyError(error_));

            return false;
        }
        finally
        {
            setBusy(false);
        }
    }

    return { run, busy, error };
}

export function Loading()
{
    return (
        <main className="d-flex justify-content-center align-items-center">
            <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </main>
    );
}

export function Alert({ message }: { message: string })
{
    return message ? <div className="alert alert-danger" role="alert">{message}</div> : null;
}

export function Modal({ id, title, children }: { id: string; title: string; children: ReactNode })
{
    const reference = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        const element = reference.current;

        return () =>
        {
            if (element)
            {
                modalInstance(element)?.hide();
            }
        };
    }, []);

    return (
        <div ref={reference} className="modal fade" id={id} tabIndex={-1} aria-labelledby={`${id}Label`} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h1 className="modal-title fs-5" id={`${id}Label`}>{title}</h1>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function Change({ value, button = false }: { value: number; button?: boolean })
{
    const tone = value > 0 ? "success" : (value < 0 ? "danger" : "secondary");

    return (
        <div className={button ? `btn btn-${tone}` : `total-insight text-${tone} d-flex flex-row align-items-center`}>
            {value === 0 ? <p>boring!</p> : (
                <>
                    <img
                        height={button ? 16 : 6}
                        className="pe-2"
                        src={`/static/imgs/icons/stock_${value > 0 ? "up" : "down"}${button ? "_black" : ""}.svg`}
                        alt="stock movement"
                    />
                    <span>
                        £
                        {value.toFixed(2)}
                    </span>
                </>
            )}
        </div>
    );
}

export function Insights({ insights, stocks }: { insights: Insight[]; stocks: Stock[] })
{
    return (
        <div className="overflow-auto" style={{ maxHeight: "35vh" }}>
            <div
                id="insight-list"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 10, display: "grid", gridTemplateRows: "min-content" }}
            >
                {insights.map((insight) =>
                {
                    const stock = stocks.find((item) => item.key === insight.stockKey);

                    return (
                        <div className="card" key={insight._id}>
                            <div className="card-body text-center">
                                {stock && <div className="d-flex justify-content-center"><img height={35} src={stock.imagePath} alt={stock.name} /></div>}
                                {insight.value !== 0 && (
                                    <div className="d-flex flex-row justify-content-center align-items-center">
                                        <img className="pe-2" height={16} src={`/static/imgs/icons/stock_${insight.value > 0 ? "up" : "down"}.svg`} alt="stock movement" />
                                        <h5 className={`text-${insight.value < 0 ? "danger" : "success"} mb-0`}>
                                            {stock?.display ? `£${insight.value.toFixed(2)}` : `${insight.value * 100}%`}
                                        </h5>
                                    </div>
                                )}
                                {insight.description && <p>{insight.description}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function formText(form: FormData, name: string)
{
    const value = form.get(name);

    return typeof value === "string" ? value : "";
}
