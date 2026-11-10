// Trechos de regex para conferir texto da tela nas jornadas do e2e.

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Valor em reais como a tela mostra. Devolve a fonte da regex, para compor com
// outros trechos: Intl pt-BR separa "R$" do valor com espaço não separável.
export function brl(reais: number) {
  return `R\\$\\s${reais},00`;
}
