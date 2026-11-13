// Núcleo puro do Ledger de Knockout (CONTEXT.md, ADR 0001).
// Recebe um snapshot (regras, participantes, linhas do ledger, instante atual)
// e um Knockout ou um pedido de Desfazer, e devolve um plano: linhas a inserir,
// ids a apagar, um patch por participante. Sem banco, sem relógio.
// Também é o único lugar das fórmulas de Bounty: inicial, de rebuy e a divisão.

import { STATUS_RULES, statusAllows, type TournamentStatus } from "@/lib/tournament-status";
import { allowsRebuy, canRebuy, hasConfirmedBuyIn, rebuyLimit } from "@/lib/tournament-entries";

export type TournamentType = "normal" | "bounty_builder";
export type ParticipantStatus = "registered" | "playing" | "eliminated" | "finished";
export type LedgerRowType = "bounty_earned" | "rebuy";

// Coroado (CONTEXT.md) pelo status do Participante: `finished` é quem a
// Coroação deixou em jogo, não o Status do torneio Encerrado. O Campeão sai da
// Posição final, não daqui.
export function isCrowned(participant: { status: ParticipantStatus }): boolean {
  return participant.status === "finished";
}

export interface LedgerRules {
  tournamentType: TournamentType;
  buyInAmount: number;
  rankingFeeAmount: number;
  rebuyAmount: number;
  maxRebuys: number;
  bountyPercentage: number;
}

export interface LedgerParticipant {
  id: number;
  playerId: number;
  status: ParticipantStatus;
  buyInPaid: boolean;
  finishPosition: number | null;
  // Posição que o Acordo em vigor deu (ADR 0005); nula fora do Acordo. Knockout e
  // Desfazer não a mudam: só Distribuir prêmios.
  dealPosition: number | null;
  rebuyCount: number;
  currentBounty: number;
  bountiesCollected: number;
  eliminatedByIds: number[];
  eliminatedAt: Date | null;
}

export interface LedgerRow {
  id: number;
  playerId: number;
  type: LedgerRowType;
  amount: number;
  bountyChange: number;
  relatedParticipantId: number | null;
  // Texto exato do banco: é a identidade do evento (ADR 0001).
  createdAt: string;
}

export interface LedgerSnapshot {
  // Knockout e Desfazer só com o torneio Rodando (STATUS_RULES.live).
  tournamentStatus: TournamentStatus;
  rules: LedgerRules;
  participants: LedgerParticipant[];
  rows: LedgerRow[];
  now: Date;
}

export type KnockoutEvent =
  | { kind: "elimination"; victimId: number; eliminatorPlayerIds: number[] }
  | { kind: "rebuy"; victimId: number; eliminatorPlayerIds: number[]; count: 1 | 2 };

export interface UndoRequest {
  kind: "elimination" | "rebuy";
  victimId: number;
}

export interface LedgerRowInsert {
  playerId: number;
  type: LedgerRowType;
  amount: number;
  bountyChange: number;
  relatedParticipantId: number | null;
}

export type ParticipantPatchFields = Partial<
  Pick<LedgerParticipant, "status" | "finishPosition" | "rebuyCount" | "currentBounty" | "bountiesCollected" | "eliminatedByIds">
> & { eliminatedAt?: Date | null };

export interface ParticipantPatch {
  participantId: number;
  set: ParticipantPatchFields;
}

export interface KnockoutPlan {
  inserts: LedgerRowInsert[];
  deleteIds: number[];
  patches: ParticipantPatch[];
  crowned: boolean;
  uncrowned: boolean;
}

export class KnockoutLedgerError extends Error {}
export class LedgerStateChangedError extends KnockoutLedgerError {
  constructor() {
    super("A mesa mudou, recarregue e tente de novo");
  }
}
export class LedgerUndoBlockedError extends KnockoutLedgerError {
  constructor() {
    super("Desfaca primeiro as eliminacoes posteriores");
  }
}
export class LedgerInvariantError extends KnockoutLedgerError {
  constructor() {
    super("Inconsistencia no ledger; nada foi alterado");
  }
}

export function isBountyBuilder(rules: Pick<LedgerRules, "tournamentType">) {
  return rules.tournamentType === "bounty_builder";
}

export function initialBounty(rules: Pick<LedgerRules, "tournamentType" | "buyInAmount" | "rankingFeeAmount" | "bountyPercentage">) {
  if (!isBountyBuilder(rules)) return 0;
  return Math.floor(((rules.buyInAmount - rules.rankingFeeAmount) * rules.bountyPercentage) / 100);
}

export function rebuyBounty(rules: Pick<LedgerRules, "tournamentType" | "rebuyAmount" | "bountyPercentage">) {
  if (!isBountyBuilder(rules)) return 0;
  return Math.floor((rules.rebuyAmount * rules.bountyPercentage) / 100);
}

export interface BountyShare {
  playerId: number;
  amount: number;
  bountyChange: number;
}

// Divisão do Bounty da Vítima entre os Eliminadores: metade em dinheiro, metade
// em Bounty; o resto inteiro vai +1 aos primeiros índices, conservando o total.
// Sempre devolve uma parte por Eliminador, mesmo com Bounty zero.
export function splitBounty(victimBounty: number, eliminatorPlayerIds: number[]): BountyShare[] {
  if (victimBounty < 0) throw new LedgerInvariantError();
  const ids = uniqueIds(eliminatorPlayerIds);
  const n = ids.length;
  if (n === 0) return [];
  const halfPayment = Math.floor(victimBounty / 2);
  const halfAccrual = victimBounty - halfPayment;
  return ids.map((playerId, i) => ({
    playerId,
    amount: Math.floor(halfPayment / n) + (i < halfPayment % n ? 1 : 0),
    bountyChange: Math.floor(halfAccrual / n) + (i < halfAccrual % n ? 1 : 0),
  }));
}

function uniqueIds(ids: number[]) {
  return Array.from(new Set(ids));
}

// Posição final de quem caiu: única e sem buracos, da última Eliminação
// (logo abaixo de quem ainda joga) para a primeira. Preserva a ordem gravada:
// quem acabou de cair (sem posição) é o melhor dos que caíram, e posições
// repetidas por dados antigos se desempatam por quem caiu depois. O Coroado é 1
// e entra na base, então o primeiro colocado abaixo dele é 2.
export function renumberedFinalPositions(
  participants: Pick<LedgerParticipant, "id" | "status" | "finishPosition" | "eliminatedAt">[]
): Map<number, number> {
  const base = participants.filter((p) => p.status === "playing" || p.status === "finished").length;
  const eliminatedAtMs = (p: { eliminatedAt: Date | null }) => p.eliminatedAt?.getTime() ?? 0;
  const fallen = participants
    .filter((p) => p.status === "eliminated")
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0) || eliminatedAtMs(b) - eliminatedAtMs(a) || a.id - b.id);
  return new Map(fallen.map((p, i) => [p.id, base + 1 + i]));
}

export type DealPositionedParticipant = Pick<
  LedgerParticipant,
  "id" | "status" | "finishPosition" | "eliminatedAt" | "dealPosition"
>;

// Posição final de todos os Participantes (CONTEXT.md, ADR 0005): quem está no
// Acordo fica com a posição do Acordo; quem está fora é posicionado pela mesa
// (o Coroado em 1, quem caiu pela ordem inversa das Eliminações), pulando as
// posições do Acordo. Em jogo e Aguardando buy-in fora do Acordo ficam sem posição.
// Knockout, Desfazer, buy-in tardio e Distribuir prêmios aplicam esta mesma regra.
export function finalPositions(participants: DealPositionedParticipant[]): Map<number, number | null> {
  const dealPositions = new Set(participants.flatMap((p) => (p.dealPosition === null ? [] : [p.dealPosition])));
  const positionById = new Map<number, number | null>();
  const fallenOutsideDeal = new Set<number>();
  let crownedOutsideDeal: number | null = null;

  for (const p of participants) {
    if (p.dealPosition !== null) positionById.set(p.id, p.dealPosition);
    else if (isCrowned(p)) crownedOutsideDeal = p.id;
    else if (p.status === "eliminated") fallenOutsideDeal.add(p.id);
    else positionById.set(p.id, null);
  }

  // Um Acordo anterior pode ter gravado em quem caiu uma posição fora da ordem
  // das Eliminações; com toda Eliminação carimbada, a ordem sai só do carimbo.
  const allEliminationsStamped = participants.every((p) => p.status !== "eliminated" || p.eliminatedAt !== null);
  const eliminationPositions = renumberedFinalPositions(
    allEliminationsStamped ? participants.map((p) => ({ ...p, finishPosition: null })) : participants
  );

  let lastAssigned = 0;
  const assign = (id: number, tablePosition: number) => {
    let position = Math.max(tablePosition, lastAssigned + 1);
    while (dealPositions.has(position)) position++;
    positionById.set(id, position);
    lastAssigned = position;
  };
  if (crownedOutsideDeal !== null) assign(crownedOutsideDeal, 1);
  for (const [id, eliminationPosition] of eliminationPositions) {
    if (fallenOutsideDeal.has(id)) assign(id, eliminationPosition);
  }
  return positionById;
}

// Recusa do Status do torneio: relido no lock, pega um Encerrar ou Cancelar que
// entrou entre a checagem de fora e a transação.
function statusRefusal(snapshot: LedgerSnapshot): { error: string } | null {
  return statusAllows(STATUS_RULES.live, snapshot.tournamentStatus) ? null : { error: STATUS_RULES.live.error };
}

export function checkKnockout(snapshot: LedgerSnapshot, event: KnockoutEvent): { error: string } | null {
  const refused = statusRefusal(snapshot);
  if (refused) return refused;
  const { rules, participants } = snapshot;
  const victim = participants.find((p) => p.id === event.victimId);
  if (!victim) return { error: "Participante nao encontrado" };

  if (event.kind === "rebuy") {
    if (!hasConfirmedBuyIn(victim)) return { error: "Jogador ainda nao pagou buy-in" };
    if (victim.status !== "playing") return { error: "Jogador nao esta em jogo" };
    if (!canRebuy(victim, rules, event.count)) {
      return allowsRebuy(rules)
        ? { error: `Limite de rebuys atingido (max: ${rebuyLimit(rules)})` }
        : { error: "Torneio nao permite rebuy" };
    }
  } else if (victim.status !== "playing") {
    return { error: "Jogador nao esta em jogo" };
  }

  const eliminators = uniqueIds(event.eliminatorPlayerIds);
  if (isBountyBuilder(rules) && eliminators.length === 0) {
    return { error: "Selecione quem eliminou o jogador" };
  }
  for (const playerId of eliminators) {
    if (playerId === victim.playerId) return { error: "Jogador nao pode eliminar a si mesmo" };
    const eliminator = participants.find((p) => p.playerId === playerId);
    if (!eliminator || eliminator.status !== "playing") return { error: "Eliminador nao esta em jogo" };
  }
  return null;
}

export function checkUndo(snapshot: LedgerSnapshot, req: UndoRequest): { error: string } | null {
  const refused = statusRefusal(snapshot);
  if (refused) return refused;
  const victim = snapshot.participants.find((p) => p.id === req.victimId);
  if (!victim) return { error: "Participante nao encontrado" };
  if (req.kind === "elimination") {
    if (victim.status !== "eliminated" && victim.status !== "finished") return { error: "Jogador nao esta eliminado" };
  } else {
    if (victim.rebuyCount <= 0) return { error: "Nenhum rebuy para desfazer" };
    if (victim.status !== "playing") return { error: "Desfaca a eliminacao antes de desfazer o rebuy" };
  }
  return null;
}

// Cópia de trabalho dos participantes: o plano é construído mutando a cópia e
// o patch de cada participante sai do diff com o original (fold automático).
class WorkingState {
  private readonly work = new Map<number, LedgerParticipant>();

  constructor(private readonly original: LedgerParticipant[]) {
    for (const p of original) this.work.set(p.id, { ...p, eliminatedByIds: [...p.eliminatedByIds] });
  }

  byId(id: number) {
    const p = this.work.get(id);
    if (!p) throw new LedgerInvariantError();
    return p;
  }

  byPlayer(playerId: number) {
    for (const p of this.work.values()) if (p.playerId === playerId) return p;
    throw new LedgerInvariantError();
  }

  all() {
    return Array.from(this.work.values());
  }

  renumber() {
    for (const [id, position] of finalPositions(this.all())) this.byId(id).finishPosition = position;
  }

  patches(): ParticipantPatch[] {
    const out: ParticipantPatch[] = [];
    for (const before of this.original) {
      const after = this.byId(before.id);
      if (after.currentBounty < 0 || after.bountiesCollected < 0 || after.rebuyCount < 0) {
        throw new LedgerInvariantError();
      }
      const set: ParticipantPatchFields = {};
      if (after.status !== before.status) set.status = after.status;
      if (after.finishPosition !== before.finishPosition) set.finishPosition = after.finishPosition;
      if (after.rebuyCount !== before.rebuyCount) set.rebuyCount = after.rebuyCount;
      if (after.currentBounty !== before.currentBounty) set.currentBounty = after.currentBounty;
      if (after.bountiesCollected !== before.bountiesCollected) set.bountiesCollected = after.bountiesCollected;
      if (!sameIds(after.eliminatedByIds, before.eliminatedByIds)) set.eliminatedByIds = after.eliminatedByIds;
      if (after.eliminatedAt?.getTime() !== before.eliminatedAt?.getTime()) set.eliminatedAt = after.eliminatedAt;
      if (Object.keys(set).length > 0) out.push({ participantId: before.id, set });
    }
    return out;
  }
}

function sameIds(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function bountyRowsFor(victim: LedgerParticipant, eliminatorPlayerIds: number[]): LedgerRowInsert[] {
  return splitBounty(victim.currentBounty, eliminatorPlayerIds).map((share) => ({
    ...share,
    type: "bounty_earned",
    relatedParticipantId: victim.id,
  }));
}

// Um Knockout (ou Coroação) de uma Vítima: as linhas que compartilham o mesmo
// created_at (texto). Eliminação: só bounty_earned dos Eliminadores. Rebuy: as
// mesmas mais as linhas de rebuy da Vítima. Coroação: uma autocoleta.
interface EventGroup {
  createdAt: string;
  maxId: number;
  kind: "elimination" | "rebuy" | "coronation";
  bountyRows: LedgerRow[];
  rebuyRows: LedgerRow[];
}

function groupsOfVictim(rows: LedgerRow[], victim: LedgerParticipant): EventGroup[] {
  const byCreatedAt = new Map<string, EventGroup>();
  for (const row of rows) {
    const isBounty = row.type === "bounty_earned" && row.relatedParticipantId === victim.id;
    const isRebuy = row.type === "rebuy" && row.playerId === victim.playerId;
    if (!isBounty && !isRebuy) continue;
    let group = byCreatedAt.get(row.createdAt);
    if (!group) {
      group = { createdAt: row.createdAt, maxId: 0, kind: "elimination", bountyRows: [], rebuyRows: [] };
      byCreatedAt.set(row.createdAt, group);
    }
    (isRebuy ? group.rebuyRows : group.bountyRows).push(row);
    group.maxId = Math.max(group.maxId, row.id);
  }
  const groups = Array.from(byCreatedAt.values());
  for (const g of groups) {
    if (g.rebuyRows.length > 0) g.kind = "rebuy";
    else if (g.bountyRows.some((r) => r.playerId === victim.playerId)) g.kind = "coronation";
  }
  return groups.sort((a, b) => a.maxId - b.maxId);
}

function eliminatorsOf(group: EventGroup | undefined) {
  return group ? group.bountyRows.map((r) => r.playerId) : [];
}

// Reversão por delta de um evento: cada Eliminador devolve exatamente o que a
// sua linha registrou; a Vítima recebe o que tinha antes mais o que acumulou
// depois como Eliminadora (linhas posteriores), nunca a configuração do torneio.
class UndoBuilder {
  private readonly deleteIds: number[] = [];
  private readonly state: WorkingState;
  private readonly rows: LedgerRow[];
  private readonly rules: LedgerRules;
  private uncrowned = false;

  constructor(snapshot: LedgerSnapshot) {
    this.state = new WorkingState(snapshot.participants);
    this.rows = snapshot.rows;
    this.rules = snapshot.rules;
  }

  // Desfazer no Coroado só descoroa. Ao desfazer a eliminação de uma Vítima
  // com alguém coroado, descoroa antes de reverter a Vítima.
  undoElimination(victimId: number) {
    const victim = this.state.byId(victimId);
    if (isCrowned(victim)) {
      this.uncrown(victim);
      this.state.renumber();
      return;
    }
    const crowned = this.state.all().find(isCrowned);
    if (crowned) this.uncrown(crowned);

    const latest = this.groupsOf(victim).at(-1);
    if (latest?.kind === "elimination") this.revertBounty(victim, latest);
    victim.status = "playing";
    victim.eliminatedAt = null;
    this.restoreEliminators(victim);
    this.state.renumber();
  }

  // Remove uma linha de rebuy do grupo mais recente; quando o grupo esvazia
  // (segundo toque de um duplo, ou rebuy simples) reverte o Knockout.
  undoRebuy(victimId: number) {
    const victim = this.state.byId(victimId);
    victim.rebuyCount -= 1;
    const lastRebuy = this.liveRows()
      .filter((r) => r.type === "rebuy" && r.playerId === victim.playerId)
      .at(-1);
    if (!lastRebuy) return;
    const group = this.groupsOf(victim).find((g) => g.createdAt === lastRebuy.createdAt);
    this.deleteIds.push(lastRebuy.id);
    if (group && group.rebuyRows.length === 1) {
      this.revertBounty(victim, group);
      this.restoreEliminators(victim);
    }
  }

  plan(): KnockoutPlan {
    return { inserts: [], deleteIds: this.deleteIds, patches: this.state.patches(), crowned: false, uncrowned: this.uncrowned };
  }

  private liveRows() {
    return this.rows.filter((r) => !this.deleteIds.includes(r.id));
  }

  private groupsOf(victim: LedgerParticipant) {
    return groupsOfVictim(this.liveRows(), victim);
  }

  // A lista de Eliminadores volta à do Knockout anterior em vigor.
  private restoreEliminators(victim: LedgerParticipant) {
    if (isBountyBuilder(this.rules)) victim.eliminatedByIds = eliminatorsOf(this.groupsOf(victim).at(-1));
  }

  private assertNoLaterKnockoutOf(participant: LedgerParticipant, afterId: number) {
    const blocked = this.liveRows().some(
      (r) =>
        r.id > afterId &&
        ((r.type === "bounty_earned" && r.relatedParticipantId === participant.id && r.playerId !== participant.playerId) ||
          (r.type === "rebuy" && r.playerId === participant.playerId))
    );
    if (blocked) throw new LedgerUndoBlockedError();
  }

  private revertBounty(victim: LedgerParticipant, group: EventGroup) {
    for (const row of group.bountyRows) {
      const eliminator = this.state.byPlayer(row.playerId);
      if (eliminator.id !== victim.id) this.assertNoLaterKnockoutOf(eliminator, group.maxId);
      eliminator.currentBounty -= row.bountyChange;
      eliminator.bountiesCollected -= row.amount;
    }
    const before = group.bountyRows.reduce((sum, r) => sum + r.amount + r.bountyChange, 0);
    const accruedAfter = this.liveRows()
      .filter((r) => r.id > group.maxId && r.type === "bounty_earned" && r.playerId === victim.playerId)
      .reduce((sum, r) => sum + r.bountyChange, 0);
    victim.currentBounty = before + accruedAfter;
    this.deleteIds.push(...group.bountyRows.map((r) => r.id));
  }

  private uncrown(crowned: LedgerParticipant) {
    const latest = this.groupsOf(crowned).at(-1);
    if (latest?.kind === "coronation") this.revertBounty(crowned, latest);
    crowned.status = "playing";
    this.uncrowned = true;
  }
}

export function planUndo(snapshot: LedgerSnapshot, req: UndoRequest): KnockoutPlan {
  if (checkUndo(snapshot, req)) throw new LedgerStateChangedError();
  const builder = new UndoBuilder(snapshot);
  if (req.kind === "elimination") builder.undoElimination(req.victimId);
  else builder.undoRebuy(req.victimId);
  return builder.plan();
}

export function planKnockout(snapshot: LedgerSnapshot, event: KnockoutEvent): KnockoutPlan {
  if (checkKnockout(snapshot, event)) throw new LedgerStateChangedError();

  const { rules } = snapshot;
  const state = new WorkingState(snapshot.participants);
  const victim = state.byId(event.victimId);
  const playingBefore = state.all().filter((p) => p.status === "playing");
  const inserts: LedgerRowInsert[] = [];
  let crowned = false;

  if (isBountyBuilder(rules)) {
    for (const share of bountyRowsFor(victim, event.eliminatorPlayerIds)) {
      const eliminator = state.byPlayer(share.playerId);
      eliminator.currentBounty += share.bountyChange;
      eliminator.bountiesCollected += share.amount;
      inserts.push(share);
    }
    victim.currentBounty = 0;
    victim.eliminatedByIds = uniqueIds(event.eliminatorPlayerIds);
  }

  if (event.kind === "elimination") {
    victim.status = "eliminated";
    // Sem posição, a Vítima é a melhor dos que caíram quando a ordem sai das
    // posições gravadas (dados antigos sem carimbo de Eliminação).
    victim.finishPosition = null;
    victim.eliminatedAt = snapshot.now;

    if (playingBefore.length === 2) {
      const lastPlaying = playingBefore.find((p) => p.id !== victim.id)!;
      lastPlaying.status = "finished";
      crowned = true;
      if (isBountyBuilder(rules)) {
        inserts.push({
          playerId: lastPlaying.playerId,
          type: "bounty_earned",
          amount: lastPlaying.currentBounty,
          bountyChange: 0,
          relatedParticipantId: lastPlaying.id,
        });
        lastPlaying.bountiesCollected += lastPlaying.currentBounty;
        lastPlaying.currentBounty = 0;
      }
    }
  } else {
    victim.rebuyCount += event.count;
    if (isBountyBuilder(rules)) victim.currentBounty = rebuyBounty(rules);
    for (let i = 0; i < event.count; i++) {
      inserts.push({ playerId: victim.playerId, type: "rebuy", amount: rules.rebuyAmount, bountyChange: 0, relatedParticipantId: null });
    }
  }

  if (event.kind === "elimination") state.renumber();
  return { inserts, deleteIds: [], patches: state.patches(), crowned, uncrowned: false };
}
