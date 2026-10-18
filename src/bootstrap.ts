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

export interface CarouselInstance {
    pause: () => void;
    cycle: () => void;
    next: () => void;
    prev: () => void;
    to: (index: number) => void;
    dispose: () => void;
}

export function createCarousel(element: HTMLElement)
{
    const bootstrap = (globalThis as typeof globalThis & {
        bootstrap?: { Carousel: new (node: HTMLElement, options: Record<string, unknown>) => CarouselInstance };
    }).bootstrap;

    return bootstrap ? new bootstrap.Carousel(element, {
        interval: 4500, ride: false, pause: false, touch: true, keyboard: true, wrap: true,
    }) : null;
}
