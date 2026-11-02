interface ModalInstance {
    hide: () => void;
}

export function modalInstance(element: HTMLElement)
{
    const bootstrap = (
        globalThis as typeof globalThis & {
            bootstrap?: { Modal: { getInstance: (node: HTMLElement) => ModalInstance | null } };
        }
    ).bootstrap;

    return bootstrap?.Modal.getInstance(element);
}

/** Close safely even while Bootstrap is still opening the dialog. */
export function hideModal(element: HTMLElement)
{
    const instance = modalInstance(element);
    if (!instance || !element.classList.contains("show"))
    {
        return;
    }

    const close = () => instance.hide();

    element.addEventListener("shown.bs.modal", close, { once: true });
    element.addEventListener("hidden.bs.modal", () =>
    {
        element.removeEventListener("shown.bs.modal", close);
    }, { once: true });
    close();
}

export interface CollapseInstance {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    dispose: () => void;
}

export function portfolioCollapse(element: HTMLElement)
{
    const bootstrap = (
        globalThis as typeof globalThis & {
            bootstrap?: {
                Collapse: {
                    getOrCreateInstance: (
                        node: HTMLElement,
                        options: Record<string, unknown>,
                    ) => CollapseInstance;
                };
            };
        }
    ).bootstrap;

    return bootstrap?.Collapse.getOrCreateInstance(element, {
        toggle: false,
        parent: element.closest(".results-leaderboard"),
    });
}

export function bootstrapTooltip(element: HTMLElement, title: string)
{
    const bootstrap = (
        globalThis as typeof globalThis & {
            bootstrap?: {
                Tooltip: {
                    getOrCreateInstance: (
                        node: HTMLElement,
                        options: { title: string; trigger: string; container: string },
                    ) => { dispose: () => void };
                };
            };
        }
    ).bootstrap;

    return bootstrap?.Tooltip.getOrCreateInstance(element, {
        title,
        trigger: "hover focus",
        container: "body",
    });
}

export function hideDropdown(element: HTMLElement)
{
    const bootstrap = (
        globalThis as typeof globalThis & {
            bootstrap?: {
                Dropdown: { getInstance: (node: HTMLElement) => { hide: () => void } | null };
            };
        }
    ).bootstrap;

    bootstrap?.Dropdown.getInstance(element)?.hide();
}
