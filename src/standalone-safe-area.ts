// Let iOS expose safe-area insets only for the installed mobile app.
export function setupStandaloneSafeArea()
{
    const media = globalThis.matchMedia("(max-width: 991.98px) and (display-mode: standalone)");
    const viewport = document.querySelector<HTMLMetaElement>("meta[name=\"viewport\"]");
    if (!viewport)
    {
        return () => undefined;
    }

    const original = viewport.content;
    const covered = original.replaceAll(/,?\s*viewport-fit\s*=\s*[^,]+/gi, "");

    const update = () =>
    {
        viewport.content = media.matches ? `${covered}, viewport-fit=cover` : original;
    };

    update();
    media.addEventListener("change", update);

    return () =>
    {
        media.removeEventListener("change", update);
        viewport.content = original;
    };
}
