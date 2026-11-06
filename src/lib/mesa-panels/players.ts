import { displayName } from "@/lib/display-name";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import { isPlaying } from "./playing";
import type { MesaParticipant } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";

// Painel Jogadores. Quem é quem sai só do status do Participante (CONTEXT.md),
// nunca da Posição final: Em jogo `playing`, Aguardando buy-in `registered`,
// Eliminação `eliminated`, campeão `finished`; com buy-in é o buy-in confirmado.

export interface PlayersCounts {
  playing: number;
  withBuyIn: number;
  eliminated: number;
  awaitingBuyIn: number;
}

export interface PlayersNamedEntry {
  id: number;
  name: string;
}

export interface PlayersPlayingEntry extends PlayersNamedEntry {
  rebuys: number;
  addons: number;
  bonus: boolean;
  // Só em Bounty Builder; `null` em torneio normal.
  bounty: number | null;
}

export interface PlayersEliminationEntry extends PlayersNamedEntry {
  // Como está gravada: repetida (#71) não é escondida nem corrigida.
  finishPosition: number | null;
}

export interface PlayersPanel {
  counts: PlayersCounts;
  // Esta lista e a de Aguardando buy-in: em ordem alfabética pelo nome de exibição.
  playing: PlayersPlayingEntry[];
  eliminations: PlayersEliminationEntry[];
  // Depois da Coroação; `null` antes dela ou quando ela é desfeita.
  champion: PlayersNamedEntry | null;
  awaitingBuyIn: PlayersNamedEntry[];
}

export interface PlayersSlice {
  card: CardFace;
  panel: PlayersPanel;
}

// Ordem alfabética do português: "Érica" fica entre "Bigode" e "Fabio".
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function byDisplayName(a: { name: string }, b: { name: string }): number {
  return collator.compare(a.name, b.name);
}

function toNamedEntry(p: MesaParticipant): PlayersNamedEntry {
  return { id: p.id, name: displayName(p) };
}

// A mais recente primeiro; sem posição (não deveria ocorrer) vai para o fim. O
// sort é estável: no empate fica a ordem da leitura da mesa (ordem de inscrição).
function positionOrder(finishPosition: number | null): number {
  return finishPosition ?? Number.MAX_SAFE_INTEGER;
}

export function derivePlayers({ snapshot }: MesaPanelsInput): PlayersSlice {
  const { participants, tournament } = snapshot;
  const withBounty = isBountyBuilder(tournament);
  const playing = participants.filter(isPlaying);
  const eliminated = participants.filter((p) => p.status === "eliminated");
  const awaiting = participants.filter((p) => p.status === "registered");
  // `finished` do Participante, que não é o Status do torneio Encerrado.
  const champion = participants.find((p) => p.status === "finished");
  const counts: PlayersCounts = {
    playing: playing.length,
    withBuyIn: participants.filter((p) => p.buyInPaid).length,
    eliminated: eliminated.length,
    awaitingBuyIn: awaiting.length,
  };
  return {
    card: { label: "Jogadores", value: `${counts.playing}`, supportLines: [`de ${counts.withBuyIn} com buy-in`] },
    panel: {
      counts,
      playing: playing
        .map((p) => ({
          ...toNamedEntry(p),
          rebuys: p.rebuyCount,
          addons: p.addonCount,
          bonus: p.bonusChipUsed,
          bounty: withBounty ? p.currentBounty : null,
        }))
        .sort(byDisplayName),
      eliminations: eliminated
        .map((p) => ({ ...toNamedEntry(p), finishPosition: p.finishPosition }))
        .sort((a, b) => positionOrder(a.finishPosition) - positionOrder(b.finishPosition)),
      champion: champion ? toNamedEntry(champion) : null,
      awaitingBuyIn: awaiting.map(toNamedEntry).sort(byDisplayName),
    },
  };
}
