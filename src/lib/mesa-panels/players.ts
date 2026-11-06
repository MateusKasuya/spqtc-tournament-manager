import { displayName } from "@/lib/display-name";
import { isBountyBuilder } from "@/lib/knockout-ledger";
import { isPlaying } from "./playing";
import type { MesaParticipant } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";

// Painel Jogadores. Quem é quem sai só do status do Participante (CONTEXT.md):
// Em jogo `playing`, Aguardando buy-in `registered`, Eliminação `eliminated`,
// campeão `finished`; com buy-in é o buy-in confirmado. Nunca pela Posição final,
// que uma distribuição de prêmios grava até em quem ainda está Em jogo.

export interface PlayersCounts {
  playing: number;
  buyIn: number;
  eliminated: number;
  awaitingBuyIn: number;
}

export interface PlayersPlayingEntry {
  id: number;
  name: string;
  rebuys: number;
  addons: number;
  bonus: boolean;
  // Só em Bounty Builder; `null` em torneio normal.
  bounty: number | null;
}

export interface PlayersEliminationEntry {
  id: number;
  name: string;
  // Como está gravada: repetida (#71) não é escondida nem corrigida.
  finishPosition: number | null;
}

export interface PlayersNamedEntry {
  id: number;
  name: string;
}

export interface PlayersPanel {
  counts: PlayersCounts;
  // Em ordem alfabética pelo nome de exibição.
  playing: PlayersPlayingEntry[];
  eliminations: PlayersEliminationEntry[];
  // Depois da Coroação; `null` antes dela ou quando ela é desfeita.
  champion: PlayersNamedEntry | null;
  // Em ordem alfabética pelo nome de exibição.
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

function named(p: MesaParticipant): PlayersNamedEntry {
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
    buyIn: participants.filter((p) => p.buyInPaid).length,
    eliminated: eliminated.length,
    awaitingBuyIn: awaiting.length,
  };
  return {
    card: { label: "Jogadores", value: `${counts.playing}`, supportLines: [`de ${counts.buyIn} com buy-in`] },
    panel: {
      counts,
      playing: playing
        .map((p) => ({
          ...named(p),
          rebuys: p.rebuyCount,
          addons: p.addonCount,
          bonus: p.bonusChipUsed,
          bounty: withBounty ? p.currentBounty : null,
        }))
        .sort(byDisplayName),
      eliminations: eliminated
        .map((p) => ({ ...named(p), finishPosition: p.finishPosition }))
        .sort((a, b) => positionOrder(a.finishPosition) - positionOrder(b.finishPosition)),
      champion: champion ? named(champion) : null,
      awaitingBuyIn: awaiting.map(named).sort(byDisplayName),
    },
  };
}
