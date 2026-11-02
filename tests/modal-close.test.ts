import { afterEach, expect, it, vi } from "vitest";
import { hideModal } from "../src/bootstrap";

function dialog()
{
    return Object.assign(new EventTarget(), { classList: { contains: () => true } }) as unknown as HTMLElement;
}

afterEach(() => vi.unstubAllGlobals());

it("retries closing a dialog once its opening transition finishes and removes the retry listener", () =>
{
    const element = dialog();
    let opening = true;
    const hide = vi.fn(() =>
    {
        if (!opening)
        {
            element.dispatchEvent(new Event("hidden.bs.modal"));
        }
    });

    vi.stubGlobal("bootstrap", { Modal: { getInstance: () => ({ hide }) } });
    hideModal(element);
    expect(hide).toHaveBeenCalledTimes(1);
    opening = false;
    element.dispatchEvent(new Event("shown.bs.modal"));
    expect(hide).toHaveBeenCalledTimes(2);
    element.dispatchEvent(new Event("shown.bs.modal"));
    expect(hide).toHaveBeenCalledTimes(2);
});

it("closes an already open modal without leaving a handler that closes its next opening", () =>
{
    const element = dialog();
    const hide = vi.fn(() => element.dispatchEvent(new Event("hidden.bs.modal")));

    vi.stubGlobal("bootstrap", { Modal: { getInstance: () => ({ hide }) } });
    hideModal(element);
    expect(hide).toHaveBeenCalledTimes(1);
    element.dispatchEvent(new Event("shown.bs.modal"));
    expect(hide).toHaveBeenCalledTimes(1);
});
