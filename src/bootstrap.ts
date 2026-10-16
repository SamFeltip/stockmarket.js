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
