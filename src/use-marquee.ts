import { useEffect } from "react";
import type { RefObject } from "react";

export function useMarquee(reference: RefObject<HTMLDivElement | null>)
{
    useEffect(() =>
    {
        const element = reference.current;
        const group = element?.querySelector<HTMLElement>(".history-group");
        if (!element || !group)
        {
            return;
        }

        const reduced = matchMedia("(prefers-reduced-motion: reduce)");
        let width = 0;
        let position = 0;
        let written = 0;
        let previousTime = 0;
        let idleUntil = 0;
        let hovered = false;
        let focused = false;
        let dragX: number | null = null;
        let frame = 0;

        function write()
        {
            if (width <= 0)
            {
                return;
            }

            // Keep the viewport in the middle copies; wrapping shows identical cards.
            position = width + ((position - width) % width + width) % width;
            element!.scrollLeft = position;
            written = element!.scrollLeft;
        }

        function resize()
        {
            const nextWidth = group!.getBoundingClientRect().width;
            const phase = width > 0 ? (position - width) / width : 0;

            width = nextWidth;
            position = width * (1 + phase);
            write();
        }

        function interact()
        {
            idleUntil = performance.now() + 4000;
        }

        function scroll()
        {
            if (Math.abs(element!.scrollLeft - written) > 0.5)
            {
                position = element!.scrollLeft;
                interact();

                if (position < width || position >= width * 2)
                {
                    write();
                }
            }
        }

        function pointerDown(event: PointerEvent)
        {
            interact();

            if (event.pointerType === "mouse" && event.button === 0)
            {
                dragX = event.clientX;
                element!.setPointerCapture(event.pointerId);
            }
        }

        function pointerMove(event: PointerEvent)
        {
            if (dragX === null)
            {
                return;
            }

            position = element!.scrollLeft + dragX - event.clientX;
            dragX = event.clientX;
            interact();
            write();
        }

        function pointerEnd()
        {
            dragX = null;
            interact();
        }

        function enter(event: PointerEvent)
        {
            hovered = event.pointerType === "mouse";
        }

        function leave()
        {
            hovered = false;
        }

        function focus()
        {
            focused = true;
        }

        function blur(event: FocusEvent)
        {
            focused = event.relatedTarget instanceof Node && element!.contains(event.relatedTarget);
        }

        function tick(time: number)
        {
            const elapsed = previousTime ? Math.min(time - previousTime, 64) : 0;

            previousTime = time;

            if (!reduced.matches && !hovered && !focused && dragX === null && time >= idleUntil)
            {
                position += elapsed * 0.04;
                write();
            }

            frame = requestAnimationFrame(tick);
        }

        const observer = new ResizeObserver(resize);

        observer.observe(group);
        resize();
        frame = requestAnimationFrame(tick);
        element.addEventListener("scroll", scroll, { passive: true });
        element.addEventListener("pointerdown", pointerDown);
        element.addEventListener("pointermove", pointerMove);
        element.addEventListener("pointerup", pointerEnd);
        element.addEventListener("pointercancel", pointerEnd);
        element.addEventListener("pointerenter", enter);
        element.addEventListener("pointerleave", leave);
        element.addEventListener("focusin", focus);
        element.addEventListener("focusout", blur);
        element.addEventListener("wheel", interact, { passive: true });
        element.addEventListener("keydown", interact);

        return () =>
        {
            cancelAnimationFrame(frame);
            observer.disconnect();
            element.removeEventListener("scroll", scroll);
            element.removeEventListener("pointerdown", pointerDown);
            element.removeEventListener("pointermove", pointerMove);
            element.removeEventListener("pointerup", pointerEnd);
            element.removeEventListener("pointercancel", pointerEnd);
            element.removeEventListener("pointerenter", enter);
            element.removeEventListener("pointerleave", leave);
            element.removeEventListener("focusin", focus);
            element.removeEventListener("focusout", blur);
            element.removeEventListener("wheel", interact);
            element.removeEventListener("keydown", interact);
        };
    }, [reference]);
}
