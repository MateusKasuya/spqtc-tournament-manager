// Regra de edição do torneio (CONTEXT.md, "Status do torneio"): quais campos
// travam em cada Status. Núcleo puro: a action recusa com ele e o formulário
// desabilita os mesmos campos.

import { STATUS_RULES, statusAllows, type TournamentStatus } from "@/lib/tournament-status";

export const CHIP_FIELDS = ["initialChips", "rebuyChips", "addonChips", "bonusChipAmount"] as const;
// Travam no primeiro buy-in confirmado: a taxa, o tipo e o percentual fixam o
// Bounty inicial, e as telas de total pago multiplicam os valores atuais pelas
// contagens de cada participante.
export const ENTRY_RULE_FIELDS = [
  "buyInAmount",
  "rebuyAmount",
  "addonAmount",
  "rankingFeeAmount",
  "tournamentType",
  "bountyPercentage",
] as const;

export const ENTRY_RULES_AFTER_BUY_IN_ERROR =
  "Valores de buy-in, Rebuy e add-on, taxa de ranking, tipo e percentual de Bounty nao podem mudar depois do primeiro buy-in confirmado";

export interface EditLocks {
  chips: boolean;
  entryRules: boolean;
}

export function editLocks(status: TournamentStatus, hasConfirmedBuyIn: boolean): EditLocks {
  return {
    chips: !statusAllows(STATUS_RULES.chips, status),
    entryRules: !statusAllows(STATUS_RULES.entryRules, status) || hasConfirmedBuyIn,
  };
}

type EditableValues = Record<(typeof CHIP_FIELDS)[number] | (typeof ENTRY_RULE_FIELDS)[number], unknown>;

// Recusa do salvamento inteiro quando um campo travado muda de valor; reenviar o
// valor atual passa (o formulário manda todos os campos sempre).
export function lockedFieldError(
  status: TournamentStatus,
  hasConfirmedBuyIn: boolean,
  current: EditableValues,
  next: EditableValues
): string | null {
  const changed = (fields: readonly (keyof EditableValues)[]) => fields.some((f) => current[f] !== next[f]);

  const locks = editLocks(status, hasConfirmedBuyIn);
  if (locks.chips && changed(CHIP_FIELDS)) return STATUS_RULES.chips.error;
  if (locks.entryRules && changed(ENTRY_RULE_FIELDS)) {
    return statusAllows(STATUS_RULES.entryRules, status) ? ENTRY_RULES_AFTER_BUY_IN_ERROR : STATUS_RULES.entryRules.error;
  }
  return null;
}
