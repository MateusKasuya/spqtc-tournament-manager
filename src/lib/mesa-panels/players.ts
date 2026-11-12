import { displayName } from "@/lib/display-name";
import { isBountyBuilder, isCrowned } from "@/lib/knockout-ledger";
import { countWithBuyIn, isPlaying } from "./playing";
import { compareFinishPosition } from "./finish-position";
import { deriveMoneyLine, type MoneyLine } from "./money-line";
import type { MesaParticipant } from "@/db/queries/mesa";
import type { CardFace, MesaPanelsInput } from "./types";

// Painel Jogadores. Quem é quem sai do status do Participante (CONTEXT.md), não
// da Posição final: Em jogo `playing`, Aguardando buy-in `registered`,
// Eliminação `eliminated`, Coroado `finished`; com buy-in é o buy-in confirmado.
// A exceção é o Campeão, que sai da Posição final depois da Coroação.

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
  // A Fronteira do dinheiro do painel do Prize pool, a mesma conta; `null` quando
  // ela não aparece (Prêmios pagos, ninguém Em jogo ou sem Posições premiadas).
  moneyLine: MoneyLine | null;
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

// Na face só os estados antes do dinheiro; No dinheiro ela não diz nada disso.
function moneyLineSupportLine(moneyLine: MoneyLine | null): string | null {
  if (moneyLine?.state === "bubble") return "Bolha";
  if (moneyLine?.state === "beforeMoney") return `faltam ${moneyLine.remaining} p/ o dinheiro`;
  return null;
}

// Um acordo pode dar a posição 1 a outro que não o Coroado, mesmo a quem já caiu.
function findChampion(participants: MesaParticipant[]): MesaParticipant | undefined {
  const crowned = participants.find(isCrowned);
  if (!crowned) return undefined;
  // Sem ninguém na posição 1 o dado está inconsistente; o Coroado é o palpite.
  return participants.find((p) => p.finishPosition === 1) ?? crowned;
}

export function derivePlayers({ snapshot }: MesaPanelsInput): PlayersSlice {
  const { participants, tournament } = snapshot;
  const withBounty = isBountyBuilder(tournament);
  const playing = participants.filter(isPlaying);
  const eliminated = participants.filter((p) => p.status === "eliminated");
  const awaiting = participants.filter((p) => p.status === "registered");
  const champion = findChampion(participants);
  const counts: PlayersCounts = {
    playing: playing.length,
    withBuyIn: countWithBuyIn(participants),
    eliminated: eliminated.length,
    awaitingBuyIn: awaiting.length,
  };
  const moneyLine = deriveMoneyLine(snapshot);
  const moneyLineText = moneyLineSupportLine(moneyLine);
  return {
    card: {
      label: "Jogadores",
      value: `${counts.playing}`,
      supportLines: [`de ${counts.withBuyIn} com buy-in`, ...(moneyLineText ? [moneyLineText] : [])],
    },
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
        // A mais recente primeiro; sem posição (não deveria ocorrer) vai para o fim.
        .sort(compareFinishPosition),
      champion: champion ? toNamedEntry(champion) : null,
      awaitingBuyIn: awaiting.map(toNamedEntry).sort(byDisplayName),
      moneyLine,
    },
  };
}
