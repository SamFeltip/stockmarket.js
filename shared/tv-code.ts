const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export async function generateTvCode(taken: (code: string) => Promise<boolean>, random = Math.random)
{
    for (let length = 4; length <= 29; length++)
    {
        for (let attempt = 0; attempt < 3; attempt++)
        {
            const suffix = Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
            const code = `tv-${suffix}`;
            if (!await taken(code))
            {
                return code;
            }
        }
    }

    throw new Error("Unable to find a lobby code. Please try again.");
}
