// Núcleo puro do snapshot da mesa ao vivo: aplica um evento de UPDATE do torneio
// (linha crua do realtime) ao snapshot anterior. Sem banco: roda no cliente.

import { CLOCK_RAW_COLUMNS, fromRawRow, type ClockRawRow, type ClockState } from "@/lib/tournament-clock";

// Configuração do torneio que a mesa usa: propriedade → coluna crua. Fonte única
// da projeção: `mesaTournamentColumns` (banco) e o select da ressincronização
// derivam daqui. O Relógio tem a própria projeção (`CLOCK_RAW_COLUMNS`).
export const MESA_CONFIG_COLUMNS = {
  name: "name",
  status: "status",
  tournamentType: "tournament_type",
  buyInAmount: "buy_in_amount",
  rebuyAmount: "rebuy_amount",
  addonAmount: "addon_amount",
  initialChips: "initial_chips",
  rebuyChips: "rebuy_chips",
  addonChips: "addon_chips",
  bonusChipAmount: "bonus_chip_amount",
  allowAddon: "allow_addon",
  rankingFeeAmount: "ranking_fee_amount",
} as const;

export type MesaConfigKey = keyof typeof MESA_CONFIG_COLUMNS;

export const TOURNAMENT_RAW_COLUMNS = [
  "id",
  ...Object.values(MESA_CONFIG_COLUMNS),
  ...CLOCK_RAW_COLUMNS,
] as const;

type TournamentFields = ClockState & Record<MesaConfigKey, unknown>;

// Campo ausente mantém o anterior; coluna fora da projeção é ignorada.
export function applyTournamentEvent<T extends TournamentFields>(prev: T, row: Record<string, unknown>): T {
  const next: T = { ...prev, ...fromRawRow(prev, row as Partial<ClockRawRow>) };
  for (const key of Object.keys(MESA_CONFIG_COLUMNS) as MesaConfigKey[]) {
    const value = row[MESA_CONFIG_COLUMNS[key]];
    if (value !== undefined) (next as TournamentFields)[key] = value;
  }
  return next;
}
