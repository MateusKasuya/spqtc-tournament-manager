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
  "rankingFeeAmount",
  "tournamentType",
  "bountyPercentage",
] as const;

export const ENTRY_RULES_AFTER_BUY_IN_ERROR =
  "Valores de buy-in, Rebuy e add-on, taxa de ranking, tipo e percentual de Bounty nao podem mudar depois do primeiro buy-in confirmado";

export interface EditLocks {
  chips: boolean;
  entryRules: boolean;
  // Valor do add-on: trava com as regras de entrada, salvo enquanto o add-on
  // não é permitido e ninguém fez add-on (não há total pago a reescrever).
  addonAmount: boolean;
}

// Fatos do torneio que a trava lê além do Status e da permissão de add-on.
export interface EditLockFacts {
  hasConfirmedBuyIn: boolean;
  hasAddon: boolean;
}

interface LockedTournament {
  status: TournamentStatus;
  allowAddon: boolean;
}

export function editLocks(tournament: LockedTournament, facts: EditLockFacts): EditLocks {
  const entryRules = !statusAllows(STATUS_RULES.entryRules, tournament.status) || facts.hasConfirmedBuyIn;
  return {
    chips: !statusAllows(STATUS_RULES.chips, tournament.status),
    entryRules,
    addonAmount: entryRules && (tournament.allowAddon || facts.hasAddon),
  };
}

type EditableField = (typeof CHIP_FIELDS)[number] | (typeof ENTRY_RULE_FIELDS)[number] | "addonAmount";
type EditableValues = Record<EditableField, unknown>;

// Recusa do salvamento inteiro quando um campo travado muda de valor; reenviar o
// valor atual passa (o formulário manda todos os campos sempre).
export function lockedFieldError(
  current: LockedTournament & EditableValues,
  facts: EditLockFacts,
  next: EditableValues
): string | null {
  const changed = (fields: readonly EditableField[]) => fields.some((f) => current[f] !== next[f]);

  const locks = editLocks(current, facts);
  if (locks.chips && changed(CHIP_FIELDS)) return STATUS_RULES.chips.error;
  if ((locks.entryRules && changed(ENTRY_RULE_FIELDS)) || (locks.addonAmount && changed(["addonAmount"]))) {
    return statusAllows(STATUS_RULES.entryRules, current.status)
      ? ENTRY_RULES_AFTER_BUY_IN_ERROR
      : STATUS_RULES.entryRules.error;
  }
  return null;
}
