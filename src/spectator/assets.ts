export const asset = (path: string) => path;

export const portrait = (path?: string) => path || "/static/imgs/icons/Stock.svg";

const logos: Record<number, string> = {
    7: "thf.png", 8: "ub.png", 9: "legal_and_general.svg", 10: "thames.png",
    11: "S_and_S.png", 12: "natwest.png",
};

export const stockLogo = (key: number, path?: string) => path ?? `/static/imgs/stocks/${logos[key] ?? "logo.svg"}`;
