export const startingCash = 60_000;

export const sharesPerCompany = 200_000;

export const gameLengths = [6, 7, 8, 9, 10];

export const minimumPlayers = 2;

export function validGameLength(lastPeriod: number)
{
    return gameLengths.includes(lastPeriod + 1);
}
