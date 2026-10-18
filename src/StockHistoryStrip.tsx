import { useEffect, useRef, useState } from "react";
import { createCarousel } from "./bootstrap";
import type { CarouselInstance } from "./bootstrap";
import { stockHistory } from "./stock-history";
import type { Board, Stock } from "./types";

function HistoryCard({ game, stock }: { game: Board["game"]; stock: Stock })
{
    const history = stockHistory(game, stock.key);

    return (
        <article className="history-card bg-white text-black rounded">
            <div className="history-chart">
                <div>
                    <img src={stock.imagePath} alt="" />
                    <h3>{stock.name}</h3>
                </div>
                <svg viewBox="0 0 180 60" role="img" aria-label={`${stock.name} price over all rounds`}>
                    <path d="M4 0V56H180" fill="none" stroke="#a8b2a4" />
                    <polyline points={history.points} fill="none" stroke="#378dde" strokeWidth="2" />
                </svg>
            </div>
            <dl className="history-stats">
                {[["Starting value", history.start], ["Max value", history.max], ["Min value", history.min]].map(([label, value]) => (
                    <div key={label}>
                        <dd>{`£${Number(value).toFixed(2)}`}</dd>
                        <dt>{label}</dt>
                    </div>
                ))}
            </dl>
        </article>
    );
}

export function StockHistoryStrip({ board }: { board: Board })
{
    const [perSlide, setPerSlide] = useState(1);
    const reference = useRef<HTMLDivElement>(null);
    const carousel = useRef<CarouselInstance | null>(null);
    const manual = useRef(false);
    const stocks = board.stocks.filter((stock) => stock.display);
    const groups = Array.from({ length: Math.ceil(stocks.length / perSlide) }, (_, index) =>
        stocks.slice(index * perSlide, (index + 1) * perSlide));

    useEffect(() =>
    {
        const desktop = matchMedia("(min-width: 992px)");
        const tablet = matchMedia("(min-width: 576px)");
        const resize = () => setPerSlide(desktop.matches ? 3 : (tablet.matches ? 2 : 1));

        resize();
        desktop.addEventListener("change", resize);
        tablet.addEventListener("change", resize);

        return () =>
        {
            desktop.removeEventListener("change", resize);
            tablet.removeEventListener("change", resize);
        };
    }, []);

    useEffect(() =>
    {
        const element = reference.current;
        if (!element)
        {
            return;
        }

        const instance = createCarousel(element);
        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
        let start: number | null = null;

        carousel.current = instance;

        function takeControl()
        {
            manual.current = true;
            instance?.pause();
        }

        function pointerDown(event: PointerEvent)
        {
            takeControl();

            if (event.pointerType === "mouse" && event.button === 0
              && !(event.target instanceof Element && event.target.closest("button")))
            {
                start = event.clientX;
                element?.setPointerCapture(event.pointerId);
            }
        }

        function pointerUp(event: PointerEvent)
        {
            if (start !== null && Math.abs(event.clientX - start) >= 40)
            {
                if (event.clientX < start)
                {
                    instance?.next();
                }
                else
                {
                    instance?.prev();
                }
            }

            start = null;
        }

        function finishSlide()
        {
            // Bootstrap may finish an in-progress autoplay transition after a gesture starts.
            queueMicrotask(() =>
            {
                if (manual.current && carousel.current === instance)
                {
                    instance?.pause();
                }
            });
        }

        function motionChanged()
        {
            if (reducedMotion.matches || manual.current)
            {
                instance?.pause();
            }
            else
            {
                instance?.cycle();
            }
        }

        motionChanged();
        element.addEventListener("pointerdown", pointerDown);
        element.addEventListener("pointerup", pointerUp);
        element.addEventListener("pointercancel", pointerUp);
        element.addEventListener("keydown", takeControl, true);
        element.addEventListener("focusin", takeControl);
        element.addEventListener("wheel", takeControl, { passive: true });
        element.addEventListener("slid.bs.carousel", finishSlide);
        reducedMotion.addEventListener("change", motionChanged);

        return () =>
        {
            element.removeEventListener("pointerdown", pointerDown);
            element.removeEventListener("pointerup", pointerUp);
            element.removeEventListener("pointercancel", pointerUp);
            element.removeEventListener("keydown", takeControl, true);
            element.removeEventListener("focusin", takeControl);
            element.removeEventListener("wheel", takeControl);
            element.removeEventListener("slid.bs.carousel", finishSlide);
            reducedMotion.removeEventListener("change", motionChanged);
            instance?.pause();
            instance?.dispose();
            carousel.current = null;
        };
    }, [perSlide, stocks.length]);

    return (
        <section className="stock-history-strip" aria-label="Final stock price histories">
            <h2 className="visually-hidden">Stock history</h2>
            <div
                key={perSlide}
                ref={reference}
                className="history-carousel carousel carousel-dark slide"
                aria-roledescription="carousel"
                aria-label="Stock histories"
            >
                <div className="carousel-inner">
                    {groups.map((group, index) => (
                        <div className={`carousel-item ${index === 0 ? "active" : ""}`} key={group[0].key}>
                            <div className="history-slides" style={{ gridTemplateColumns: `repeat(${perSlide}, minmax(0, 1fr))` }}>
                                {group.map((stock) => <HistoryCard key={stock.key} game={board.game} stock={stock} />)}
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="carousel-control-prev"
                    aria-label="Previous stocks"
                    onClick={() => carousel.current?.prev()}
                >
                    <span className="carousel-control-prev-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="carousel-control-next"
                    aria-label="Next stocks"
                    onClick={() => carousel.current?.next()}
                >
                    <span className="carousel-control-next-icon" aria-hidden="true" />
                </button>
                <div className="carousel-indicators">
                    {groups.map((group, index) => (
                        <button
                            key={group[0].key}
                            type="button"
                            data-bs-slide-to={index}
                            className={index === 0 ? "active" : ""}
                            aria-current={index === 0 ? "true" : undefined}
                            aria-label={`Show ${group.map((stock) => stock.name).join(", ")}`}
                            onClick={() => carousel.current?.to(index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
