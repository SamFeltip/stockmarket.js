export function validUsername(name: string)
{
    const trimmed = name.trim();

    return trimmed.length > 0 && trimmed.length <= 32 && !/[\u0000-\u001F\u007F]/.test(trimmed);
}
