import { describe, it, expect } from "vitest";
import { buildMesaPanels } from "@/lib/mesa-panels";
import { formatCurrency } from "@/lib/format";
import { makeInput, makeParticipant, makeSnapshot, makeTournament } from "./mesa-panels-fixture";

const bountyBuilder = () => makeTournament({ tournamentType: "bounty_builder" });

function bountyOf(participants: ReturnType<typeof makeParticipant>[]) {
  const snapshot = makeSnapshot({ tournament: bountyBuilder(), participants });
  const { bounty } = buildMesaPanels(makeInput({ snapshot }));
  if (!bounty) throw new Error("Bounty Builder deveria ter o painel Bounty");
  return bounty;
}

describe("card Bounty em jogo", () => {
  it("em Bounty Builder soma os Bounties dos Em jogo", () => {
    const bounty = bountyOf([
      makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
      makeParticipant({ currentBounty: 2501 }),
      makeParticipant({ status: "eliminated", currentBounty: 0, bountiesCollected: 1000 }),
    ]);

    expect(bounty.card).toEqual({ label: "Bounty em jogo", value: formatCurrency(8501), supportLines: [] });
  });

  it("em torneio normal nem o card nem o painel existem", () => {
    const snapshot = makeSnapshot({
      tournament: makeTournament({ tournamentType: "normal" }),
      participants: [makeParticipant({ currentBounty: 0 })],
    });

    expect(buildMesaPanels(makeInput({ snapshot })).bounty).toBeNull();
  });
});

describe("painel Bounty em jogo", () => {
  it("lista o Bounty de cada Em jogo do maior para o menor, pelo nome de exibição", () => {
    const ana = makeParticipant({ name: "Ana", nickname: null, currentBounty: 2000 });
    const beto = makeParticipant({ name: "Roberto", nickname: "Beto", currentBounty: 7000 });
    const caio = makeParticipant({ name: "Caio", currentBounty: 4000 });
    const fora = makeParticipant({ name: "Fora", status: "eliminated", currentBounty: 0, bountiesCollected: 500 });

    const { panel } = bountyOf([ana, beto, caio, fora]);

    expect(panel.inPlay.map((e) => [e.participantId, e.name, e.bounty])).toEqual([
      [beto.id, "Beto", 7000],
      [caio.id, "Caio", 4000],
      [ana.id, "Ana", 2000],
    ]);
    expect(panel.bountyInPlay).toBe(13000);
  });

  it("derrubar sozinho divide como o Knockout: metade para baixo em dinheiro, o resto no Bounty", () => {
    const par = makeParticipant({ currentBounty: 5000 });
    const impar = makeParticipant({ currentBounty: 2501 });

    const { panel } = bountyOf([par, impar]);

    expect(panel.inPlay.find((e) => e.participantId === par.id)?.soloKnockout).toEqual({ cash: 2500, bounty: 2500 });
    // Com Bounty ímpar em centavos, o Bounty leva 1 centavo a mais que o dinheiro.
    expect(panel.inPlay.find((e) => e.participantId === impar.id)?.soloKnockout).toEqual({ cash: 1250, bounty: 1251 });
  });

  it("lista o Bounty coletado do maior para o menor e sinaliza o do campeão", () => {
    const campeao = makeParticipant({
      name: "Campeao",
      status: "finished",
      finishPosition: 1,
      currentBounty: 0,
      bountiesCollected: 9000,
    });
    const vice = makeParticipant({ name: "Vice", status: "eliminated", finishPosition: 2, bountiesCollected: 3000 });
    const terceiro = makeParticipant({ name: "Terceiro", status: "eliminated", finishPosition: 3, bountiesCollected: 5000 });
    const semKnockout = makeParticipant({ name: "Zerado", status: "eliminated", finishPosition: 4, bountiesCollected: 0 });

    const { panel } = bountyOf([vice, campeao, terceiro, semKnockout]);

    expect(panel.collected).toEqual([
      { participantId: campeao.id, name: "Campeao", collected: 9000, champion: true },
      { participantId: terceiro.id, name: "Terceiro", collected: 5000, champion: false },
      { participantId: vice.id, name: "Vice", collected: 3000, champion: false },
    ]);
    expect(panel.collectedTotal).toBe(17000);
    // Depois da Coroação não há Bounty em jogo.
    expect(panel.inPlay).toEqual([]);
    expect(panel.bountyInPlay).toBe(0);
  });

  it("confere o Bounty armado com o Bounty em jogo mais os coletados, o mesmo do Prize pool", () => {
    const snapshot = makeSnapshot({
      tournament: bountyBuilder(),
      participants: [
        makeParticipant({ currentBounty: 6000, bountiesCollected: 4000 }),
        makeParticipant({ currentBounty: 2501 }),
        makeParticipant({ status: "eliminated", currentBounty: 0, bountiesCollected: 1499 }),
      ],
    });

    const { bounty, prizePool } = buildMesaPanels(makeInput({ snapshot }));

    expect(bounty?.panel.allocated).toBe(14000);
    expect(bounty?.panel.allocated).toBe(prizePool.panel.bountyAllocated);
    expect(bounty?.panel.allocated).toBe((bounty?.panel.bountyInPlay ?? 0) + (bounty?.panel.collectedTotal ?? 0));
  });
});
