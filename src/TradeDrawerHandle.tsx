import { useRef } from "react";
import { modalInstance } from "./bootstrap";

export function TradeDrawerHandle()
{
    const drag = useRef<{ y: number; time: number; dialog: HTMLElement; modal: HTMLElement } | null>(null);

    function reset()
    {
        if (drag.current)
        {
            drag.current.dialog.style.removeProperty("transition");
            drag.current.dialog.style.removeProperty("transform");
            drag.current = null;
        }
    }

    return (
        <button
            type="button"
            className="trade-drawer-handle"
            aria-label="Drag down to close trade drawer"
            onClick={(event) =>
            {
                if (event.detail === 0)
                {
                    const modal = event.currentTarget.closest<HTMLElement>(".modal");
                    if (modal)
                    {
                        modalInstance(modal)?.hide();
                    }
                }
            }}
            onPointerDown={(event) =>
            {
                if (event.button !== 0 || !event.isPrimary)
                {
                    return;
                }

                const modal = event.currentTarget.closest<HTMLElement>(".modal");
                const dialog = modal?.querySelector<HTMLElement>(".modal-dialog");
                if (!modal || !dialog)
                {
                    return;
                }

                drag.current = { y: event.clientY, time: performance.now(), dialog, modal };
                dialog.style.transition = "none";
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
            }}
            onPointerMove={(event) =>
            {
                if (!drag.current)
                {
                    return;
                }

                const distance = Math.max(0, event.clientY - drag.current.y);

                drag.current.dialog.style.transform = `translateY(${distance}px)`;
            }}
            onPointerUp={(event) =>
            {
                if (!drag.current)
                {
                    return;
                }

                const { y, time, modal, dialog } = drag.current;
                const distance = Math.max(0, event.clientY - y);
                const speed = distance / Math.max(1, performance.now() - time);
                const threshold = Math.min(80, dialog.offsetHeight * 0.15);
                if (distance >= threshold || (distance > 12 && speed > 0.5))
                {
                    modalInstance(modal)?.hide();
                }

                reset();
            }}
            onPointerCancel={reset}
            onLostPointerCapture={reset}
        >
            <span />
        </button>
    );
}
