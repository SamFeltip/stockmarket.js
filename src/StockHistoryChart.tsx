export function StockHistoryChart({ name, points }: { name: string; points: string })
{
    return (
        <svg viewBox="0 0 180 60" role="img" aria-label={`${name} price history`}>
            <path d="M4 0V56H180" fill="none" stroke="#a8b2a4" />
            <polyline points={points} fill="none" stroke="#378dde" strokeWidth="2" />
        </svg>
    );
}
