import { describe, it, expect } from "vitest";
import { tournaments } from "@/db/schema";
import { applyTournamentEvent, MESA_CONFIG_COLUMNS, TOURNAMENT_RAW_COLUMNS } from "@/lib/mesa-snapshot";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const PREV = {
  id: 7,
  name: "Torneio",
  status: "running" as const,
  tournamentType: "normal" as const,
  buyInAmount: 10000,
  rebuyAmount: 5000,
  addonAmount: 5000,
  initialChips: 10000,
  rebuyChips: 10000,
  addonChips: 15000,
  bonusChipAmount: 0,
  allowAddon: true,
  rankingFeeAmount: 1000,
  currentBlindLevel: 1,
  timerRunning: false,
  timerRemainingSecs: 900,
  timerStartedAt: null,
  breakActive: false,
  levelRemainingSecs: null,
  breakTotalSecs: null,
};

describe("Mesa ao vivo: aplicar evento do torneio", () => {
  it("aplica campos do Relogio, Status do torneio e configuracao", () => {
    const next = applyTournamentEvent(PREV, {
      current_blind_level: 2,
      timer_running: true,
      status: "finished",
      name: "Torneio renomeado",
      rebuy_amount: 6000,
      addon_amount: 7000,
      ranking_fee_amount: 2000,
      allow_addon: false,
      bonus_chip_amount: 5000,
    });

    expect(next).toMatchObject({
      currentBlindLevel: 2,
      timerRunning: true,
      status: "finished",
      name: "Torneio renomeado",
      rebuyAmount: 6000,
      addonAmount: 7000,
      rankingFeeAmount: 2000,
      allowAddon: false,
      bonusChipAmount: 5000,
    });
  });

  it("campo ausente no evento mantem o valor anterior", () => {
    const next = applyTournamentEvent(PREV, { rebuy_amount: 6000 });

    expect(next).toEqual({ ...PREV, rebuyAmount: 6000 });
  });

  it("coluna fora da projecao e ignorada", () => {
    const next = applyTournamentEvent(PREV, {
      max_rebuys: 3,
      created_by: "00000000-0000-0000-0000-000000000001",
      updated_at: NOW.toISOString(),
      id: 99,
    });

    expect(next).toEqual(PREV);
  });

  it("o horario de inicio do Relogio chega como texto e vira data", () => {
    const next = applyTournamentEvent(PREV, { timer_started_at: NOW.toISOString() });

    expect(next.timerStartedAt).toBeInstanceOf(Date);
    expect(next.timerStartedAt).toEqual(NOW);
  });

  it("as colunas cruas da configuracao batem com o schema do torneio", () => {
    for (const [key, raw] of Object.entries(MESA_CONFIG_COLUMNS)) {
      expect(tournaments[key as keyof typeof MESA_CONFIG_COLUMNS].name).toBe(raw);
    }
  });

  it("a ressincronizacao pede id, configuracao e Relogio", () => {
    expect(TOURNAMENT_RAW_COLUMNS).toContain("id");
    expect(TOURNAMENT_RAW_COLUMNS).toContain("rebuy_amount");
    expect(TOURNAMENT_RAW_COLUMNS).toContain("timer_started_at");
    expect(TOURNAMENT_RAW_COLUMNS).not.toContain("max_rebuys");
  });
});
