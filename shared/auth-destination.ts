// Only a game route may survive authentication; external URLs never become redirects.
export function authDestination(pathname: string, search: string)
{
    const candidate = new URLSearchParams(search).get("next") ?? pathname;

    return /^\/games\/show\/[a-zA-Z0-9_-]{1,32}$/.test(candidate) ? candidate : "/";
}
