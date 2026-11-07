import { describe, it, expect } from "vitest";
import { checkPayoutRecipients, checkRemoveParticipant } from "@/lib/participant-entries";

describe("checkPayoutRecipients", () => {
  const enrolled = [
    { playerId: 1, buyInPaid: true },
    { playerId: 2, buyInPaid: false },
  ];

  it("aceita quem esta inscrito com buy-in confirmado, e a lista vazia", () => {
    expect(checkPayoutRecipients([{ playerId: 1 }], enrolled)).toBeNull();
    expect(checkPayoutRecipients([], [])).toBeNull();
  });

  it("recusa quem aguarda buy-in", () => {
    expect(checkPayoutRecipients([{ playerId: 1 }, { playerId: 2 }], enrolled)).toEqual({
      error: "So recebe Premio quem tem buy-in confirmado",
    });
  });

  it("recusa quem nao esta inscrito", () => {
    expect(checkPayoutRecipients([{ playerId: 1 }, { playerId: 3 }], enrolled)).toEqual({
      error: "Jogador nao inscrito neste torneio",
    });
  });
});

describe("checkRemoveParticipant", () => {
  it("so remove quem aguarda buy-in", () => {
    expect(checkRemoveParticipant({ status: "registered" })).toBeNull();
    for (const status of ["playing", "eliminated", "finished"] as const) {
      expect(checkRemoveParticipant({ status })).toHaveProperty("error");
    }
  });
});
