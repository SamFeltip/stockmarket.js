/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Native scroll regions must be focusable for keyboard browsing. */
import { useRef } from "react";
import type { ReactNode } from "react";
import { useMarquee } from "./use-marquee";

export function Marquee({ label, children }: { label: string; children: ReactNode })
{
    const reference = useRef<HTMLDivElement>(null);

    useMarquee(reference);

    return (
        <div ref={reference} className="history-viewport overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
            <div className="history-track d-flex">
                {[0, 1, 2, 3].map((copy) => (
                    <div className="history-group d-flex gap-3" key={copy} aria-hidden={copy > 0 ? true : undefined}>
                        {children}
                    </div>
                ))}
            </div>
        </div>
    );
}
