// Let iOS expose safe-area insets only for the installed mobile app.
export function setupStandaloneSafeArea()
{
    const mobile = globalThis.matchMedia("(max-width: 991.98px)");
    const standalone = globalThis.matchMedia("(display-mode: standalone)");
    const root = document.documentElement;
    const hadClass = root.classList.contains("mobile-standalone");
    const viewport = document.querySelector<HTMLMetaElement>("meta[name=\"viewport\"]");
    if (!viewport)
    {
        return () => undefined;
    }

    const original = viewport.content;
    const covered = original.replaceAll(/,?\s*viewport-fit\s*=\s*[^,]+/gi, "");

    const update = () =>
    {
        const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
        const enabled = mobile.matches && (standalone.matches || iosStandalone);

        root.classList.toggle("mobile-standalone", enabled);
        viewport.content = enabled ? `${covered}, viewport-fit=cover` : original;
    };

    update();
    mobile.addEventListener("change", update);
    standalone.addEventListener("change", update);

    return () =>
    {
        mobile.removeEventListener("change", update);
        standalone.removeEventListener("change", update);
        root.classList.toggle("mobile-standalone", hadClass);
        viewport.content = original;
    };
}
