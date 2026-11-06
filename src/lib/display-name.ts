// Nome de exibição da mesa: o apelido ou, sem apelido, o nome.
// Compartilhado pelas Ações rápidas e pelos painéis da mesa.
export function displayName(p: { name: string; nickname: string | null }): string {
  return p.nickname ?? p.name;
}
