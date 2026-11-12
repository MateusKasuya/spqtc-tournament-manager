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

  it("campeao coroado fora da lista, com o 1o do acordo para outro, recebe a posicao livre seguinte", () => {
    const parts = [part(1, "finished", 1), part(2, "eliminated", 2, at(5)), part(3, "eliminated", 3, at(1))];
    const positions = finalPositionsAfterPayout(parts, [{ playerId: 20, position: 1 }]);
    expect(positions).toEqual(new Map([[1, 2], [2, 1], [3, 3]] as [number, number | null][]));
  });

  it("com 6 jogadores: acordo da 1a, 3a e 5a; Coroado e eliminados fora do acordo ficam com as livres na ordem das Eliminacoes", () => {
    // Redistribuicao no Encerrado. Ordem das Eliminacoes: 6, 5, 4, 3 e, na Coroacao, 2.
    const parts = [
      part(1, "finished", 1),
      part(2, "eliminated", 2, at(50)),
      part(3, "eliminated", 3, at(40)),
      part(4, "eliminated", 4, at(30)),
      part(5, "eliminated", 5, at(20)),
      part(6, "eliminated", 6, at(10)),
    ];
    const positions = finalPositionsAfterPayout(parts, [
      { playerId: 20, position: 1 },
      { playerId: 40, position: 3 },
      { playerId: 60, position: 5 },
    ]);
    expect(positions).toEqual(
      new Map([[1, 2], [2, 1], [3, 4], [4, 3], [5, 6], [6, 5]] as [number, number | null][])
    );
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
