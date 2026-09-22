// Núcleo puro do Ledger de Knockout (CONTEXT.md, ADR 0001).
// Recebe um snapshot (regras, participantes, linhas do ledger, instante atual)
// e um Knockout ou um pedido de Desfazer, e devolve um plano: linhas a inserir,
// ids a apagar, um patch por participante. Sem banco, sem relógio.
import { computeBountyDistribution } from "@/lib/bounty";

export type TournamentType = "normal" | "bounty_builder";
export type ParticipantStatus = "registered" | "playing" | "eliminated" | "finished";
export type LedgerRowType = "bounty_earned" | "rebuy";

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
  rebuyCount: number;
  currentBounty: number;
  bountiesCollected: number;
  eliminatedByIds: number[];
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

export function isBountyBuilder(rules: LedgerRules) {
  return rules.tournamentType === "bounty_builder";
}

export function initialBounty(rules: LedgerRules) {
  if (!isBountyBuilder(rules)) return 0;
  return Math.floor(((rules.buyInAmount - rules.rankingFeeAmount) * rules.bountyPercentage) / 100);
}

export function rebuyBounty(rules: LedgerRules) {
  if (!isBountyBuilder(rules)) return 0;
  return Math.floor((rules.rebuyAmount * rules.bountyPercentage) / 100);
}

function uniqueIds(ids: number[]) {
  return Array.from(new Set(ids));
}

export function checkKnockout(snapshot: LedgerSnapshot, event: KnockoutEvent): { error: string } | null {
  const { rules, participants } = snapshot;
  const victim = participants.find((p) => p.id === event.victimId);
  if (!victim) return { error: "Participante nao encontrado" };

  if (event.kind === "rebuy") {
    if (!victim.buyInPaid) return { error: "Jogador ainda nao pagou buy-in" };
    if (victim.status !== "playing") return { error: "Jogador nao esta em jogo" };
    if (rules.rebuyAmount === 0) return { error: "Torneio nao permite rebuy" };
    if (rules.maxRebuys > 0 && victim.rebuyCount + event.count > rules.maxRebuys) {
      return { error: `Limite de rebuys atingido (max: ${rules.maxRebuys})` };
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
  private readonly eliminatedAt = new Map<number, Date | null>();

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

  setEliminatedAt(id: number, value: Date | null) {
    this.eliminatedAt.set(id, value);
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
      if (this.eliminatedAt.has(before.id)) set.eliminatedAt = this.eliminatedAt.get(before.id);
      if (Object.keys(set).length > 0) out.push({ participantId: before.id, set });
    }
    return out;
  }
}

function sameIds(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Divisão do Bounty da Vítima entre os Eliminadores. Sempre devolve uma linha
// por Eliminador, mesmo com Bounty zero ("sempre gravar").
function splitBounty(victim: LedgerParticipant, eliminatorPlayerIds: number[]): LedgerRowInsert[] {
  const shares = computeBountyDistribution(victim.id, victim.currentBounty, eliminatorPlayerIds, 0);
  return uniqueIds(eliminatorPlayerIds).map((playerId) => {
    const share = shares.find((s) => s.playerId === playerId);
    return {
      playerId,
      type: "bounty_earned",
      amount: share?.amount ?? 0,
      bountyChange: share?.bountyChange ?? 0,
      relatedParticipantId: victim.id,
    };
  });
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
  readonly deleteIds: number[] = [];
  readonly state: WorkingState;
  private readonly rows: LedgerRow[];

  constructor(snapshot: LedgerSnapshot) {
    this.state = new WorkingState(snapshot.participants);
    this.rows = snapshot.rows;
  }

  liveRows() {
    return this.rows.filter((r) => !this.deleteIds.includes(r.id));
  }

  groupsOf(victim: LedgerParticipant) {
    return groupsOfVictim(this.liveRows(), victim);
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

  revertBounty(victim: LedgerParticipant, group: EventGroup) {
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

  uncrown(champion: LedgerParticipant) {
    const latest = this.groupsOf(champion).at(-1);
    if (latest?.kind === "coronation") this.revertBounty(champion, latest);
    champion.status = "playing";
    champion.finishPosition = null;
  }
}

export function planUndo(snapshot: LedgerSnapshot, req: UndoRequest): KnockoutPlan {
  if (checkUndo(snapshot, req)) throw new LedgerStateChangedError();

  const builder = new UndoBuilder(snapshot);
  const { state } = builder;
  const victim = state.byId(req.victimId);
  let uncrowned = false;

  if (req.kind === "elimination") {
    if (victim.status === "finished") {
      builder.uncrown(victim);
      uncrowned = true;
    } else {
      const champion = state.all().find((p) => p.status === "finished");
      if (champion) {
        builder.uncrown(champion);
        uncrowned = true;
      }
      const latest = builder.groupsOf(victim).at(-1);
      if (latest?.kind === "elimination") builder.revertBounty(victim, latest);
      victim.status = "playing";
      victim.finishPosition = null;
      state.setEliminatedAt(victim.id, null);
      victim.eliminatedByIds = eliminatorsOf(builder.groupsOf(victim).at(-1));
    }
  } else {
    // Remove uma recompra do grupo mais recente; quando o grupo esvazia
    // (segundo toque de um duplo, ou rebuy simples) reverte o Knockout.
    victim.rebuyCount -= 1;
    const lastRebuy = builder
      .liveRows()
      .filter((r) => r.type === "rebuy" && r.playerId === victim.playerId)
      .at(-1);
    if (lastRebuy) {
      const group = builder.groupsOf(victim).find((g) => g.createdAt === lastRebuy.createdAt);
      builder.deleteIds.push(lastRebuy.id);
      if (group && group.rebuyRows.length === 1) {
        builder.revertBounty(victim, group);
        victim.eliminatedByIds = eliminatorsOf(builder.groupsOf(victim).at(-1));
      }
    }
  }

  return { inserts: [], deleteIds: builder.deleteIds, patches: state.patches(), crowned: false, uncrowned };
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
    for (const share of splitBounty(victim, event.eliminatorPlayerIds)) {
      const eliminator = state.byPlayer(share.playerId);
      eliminator.currentBounty += share.bountyChange;
      eliminator.bountiesCollected += share.amount;
      inserts.push(share);
    }
    victim.currentBounty = 0;
  }
  victim.eliminatedByIds = uniqueIds(event.eliminatorPlayerIds);

  if (event.kind === "elimination") {
    victim.status = "eliminated";
    victim.finishPosition = playingBefore.length;
    state.setEliminatedAt(victim.id, snapshot.now);

    if (playingBefore.length === 2) {
      const champion = playingBefore.find((p) => p.id !== victim.id)!;
      champion.status = "finished";
      champion.finishPosition = 1;
      crowned = true;
      if (isBountyBuilder(rules)) {
        inserts.push({
          playerId: champion.playerId,
          type: "bounty_earned",
          amount: champion.currentBounty,
          bountyChange: 0,
          relatedParticipantId: champion.id,
        });
        champion.bountiesCollected += champion.currentBounty;
        champion.currentBounty = 0;
      }
    }
  } else {
    victim.rebuyCount += event.count;
    if (isBountyBuilder(rules)) victim.currentBounty = rebuyBounty(rules);
    for (let i = 0; i < event.count; i++) {
      inserts.push({ playerId: victim.playerId, type: "rebuy", amount: rules.rebuyAmount, bountyChange: 0, relatedParticipantId: null });
    }
  }

  return { inserts, deleteIds: [], patches: state.patches(), crowned, uncrowned: false };
}
