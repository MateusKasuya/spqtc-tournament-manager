export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatChips(chips: number): string {
  return new Intl.NumberFormat("pt-BR").format(chips);
}
