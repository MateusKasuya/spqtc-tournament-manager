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
  // Fichas de add-on: travam com as outras fichas, salvo enquanto o add-on não é
  // permitido e ninguém fez add-on (não há add-on a recalcular).
  addonChips: boolean;
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
  const chips = !statusAllows(STATUS_RULES.chips, tournament.status);
  const addonInUse = tournament.allowAddon || facts.hasAddon;
  return {
    chips,
    entryRules,
    addonAmount: entryRules && addonInUse,
    addonChips: chips && addonInUse,
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
  if (
    (locks.chips && changed(CHIP_FIELDS.filter((f) => f !== "addonChips"))) ||
    (locks.addonChips && changed(["addonChips"]))
  ) {
    return STATUS_RULES.chips.error;
  }
  if ((locks.entryRules && changed(ENTRY_RULE_FIELDS)) || (locks.addonAmount && changed(["addonAmount"]))) {
    return statusAllows(STATUS_RULES.entryRules, current.status)
      ? ENTRY_RULES_AFTER_BUY_IN_ERROR
      : STATUS_RULES.entryRules.error;
  }
  return null;
}

export const BUY_IN_BELOW_RANKING_FEE_ERROR = "Buy-in nao pode ser menor que a taxa de ranking";

// Tudo o que entra no Bounty inicial: (buy-in - taxa) x percentual, em Bounty Builder.
interface BountyRules {
  buyInAmount: number;
  rankingFeeAmount: number;
  tournamentType: string;
  bountyPercentage: number;
}

const BOUNTY_RULE_FIELDS = ["buyInAmount", "rankingFeeAmount", "tournamentType", "bountyPercentage"] as const;

// Buy-in ≥ taxa de ranking (a diferença é o que sobra para Bounty e Prize pool).
// Sem `current` é a criação e a regra vale sempre. Na edição só vale quando muda
// algo que entra no Bounty inicial (buy-in, taxa, tipo ou percentual): assim um
// torneio antigo gravado abaixo da taxa continua editável nos outros campos, mas
// não vira Bounty Builder nem muda o percentual sem corrigir o buy-in, o que
// gravaria um Bounty negativo no primeiro buy-in.
export function buyInBelowRankingFeeError(next: BountyRules, current?: BountyRules): string | null {
  if (next.buyInAmount >= next.rankingFeeAmount) return null;
  const unchanged = current !== undefined && BOUNTY_RULE_FIELDS.every((f) => current[f] === next[f]);
  return unchanged ? null : BUY_IN_BELOW_RANKING_FEE_ERROR;
}
