interface ModalInstance {
    hide: () => void;
}

export function modalInstance(element: HTMLElement)
{
    const bootstrap = (globalThis as typeof globalThis & {
        bootstrap?: { Modal: { getInstance: (node: HTMLElement) => ModalInstance | null } };
    }).bootstrap;

    return bootstrap?.Modal.getInstance(element);
}

export interface CollapseInstance {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    dispose: () => void;
}

export function portfolioCollapse(element: HTMLElement)
{
    const bootstrap = (globalThis as typeof globalThis & {
        bootstrap?: { Collapse: {
            getOrCreateInstance: (node: HTMLElement, options: Record<string, unknown>) => CollapseInstance;
        } };
    }).bootstrap;

    return bootstrap?.Collapse.getOrCreateInstance(element, {
        toggle: false, parent: element.closest(".results-leaderboard"),
    });
}
