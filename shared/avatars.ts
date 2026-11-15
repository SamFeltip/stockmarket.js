export const avatarPaths = [
    "/static/imgs/1profile.png",
    "/static/imgs/2profile.png",
    "/static/imgs/3profile.png",
    "/static/imgs/4profile.png",
    "/static/imgs/5profile.png",
    "/static/imgs/aiony.jpg",
    "/static/imgs/charles.jpg",
    "/static/imgs/ian.jpg",
    // Keep the old selection ID valid for forms opened before the duplicate was removed.
    "/static/imgs/5profile.png",
    "/static/imgs/jurica.jpg",
    "/static/imgs/michael.jpg",
    "/static/imgs/pexels-37435072.jpg",
    "/static/imgs/pexels-21294958.jpg",
] as const;

export const avatarOptions = avatarPaths.flatMap((path, index) =>
    avatarPaths.indexOf(path) === index ? [{ path, id: index + 1 }] : []);
