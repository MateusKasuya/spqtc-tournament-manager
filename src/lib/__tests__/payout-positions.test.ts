import { describe, it, expect } from "vitest";
import { finalPositionsAfterPayout, type PositionedParticipant } from "@/lib/payout-positions";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 7, 20, minute));

function part(id: number, status: PositionedParticipant["status"], finishPosition: number | null, eliminatedAt: Date | null = null): PositionedParticipant {
  return { id, playerId: id * 10, status, finishPosition, eliminatedAt };
}

describe("finalPositionsAfterPayout", () => {
  it("campeao coroado fora da lista mantem o 1o", () => {
    const parts = [part(1, "finished", 1), part(2, "eliminated", 2, at(5)), part(3, "eliminated", 3, at(1))];
    const positions = finalPositionsAfterPayout(parts, [{ playerId: 20, position: 2 }]);
    expect(positions).toEqual(new Map([[1, 1], [2, 2], [3, 3]] as [number, number | null][]));
  });

  it("Aguardando buy-in e Em jogo fora da lista ficam sem posicao", () => {
    const parts = [part(1, "playing", 1), part(2, "playing", 2), part(3, "registered", null)];
    const positions = finalPositionsAfterPayout(parts, [{ playerId: 10, position: 1 }]);
    expect(positions).toEqual(new Map([[1, 1], [2, null], [3, null]] as [number, number | null][]));
  });

  it("dado antigo sem carimbo de Eliminacao segue a posicao gravada, sem repetir a do acordo", () => {
    const parts = [part(1, "playing", 1), part(2, "eliminated", 2), part(3, "eliminated", 3)];
    const positions = finalPositionsAfterPayout(parts, [
      { playerId: 10, position: 1 },
      { playerId: 30, position: 2 },
    ]);
    expect(positions).toEqual(new Map([[1, 1], [2, 3], [3, 2]] as [number, number | null][]));
  });
});
