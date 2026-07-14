export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatChips(chips: number): string {
  return new Intl.NumberFormat("pt-BR").format(chips);
}

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Pontos de ranking: inteiros ficam limpos (12) e frações usam vírgula (12,25).
export function formatPoints(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
