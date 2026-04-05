/**
 * Seed script — Temporada 2026 (4 etapas)
 * Run: npx tsx --env-file=.env.local scripts/seed-2026.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { getPointsForPosition } from "../src/lib/points-table";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

const PLAYER_NICKNAMES = [
  "ALE", "CAMARGO", "CAPELLO", "DANILO", "DIGO", "DUDU",
  "FERNANDO", "GAGO", "GORDO", "GUERRA", "GUIDO", "GUILHERMINA",
  "HEITOR", "JABUR", "KASUYA", "KREL", "LEO", "MANDI",
  "NICOLAS", "PORFS", "PRETO", "ROMULO", "RUY", "SABUGO", "TARIK",
];

interface EtapaParticipant {
  nickname: string;
  position: number;
  rebuys: number;
  addonCount: number; // quantos addons o jogador comprou (1 ou 2)
  prize: number;      // em centavos
}

interface Etapa {
  name: string;
  date: Date;
  prizePoolOverride: number; // em centavos
  participants: EtapaParticipant[];
}

const ETAPAS: Etapa[] = [
  {
    name: "1ª Etapa 2026",
    date: new Date("2026-01-13T19:00:00-03:00"),
    prizePoolOverride: 204100,
    participants: [
      { nickname: "RUY",         position: 1,  rebuys: 0,  addonCount: 1, prize: 80000 },
      { nickname: "KREL",        position: 2,  rebuys: 2,  addonCount: 1, prize: 55000 },
      { nickname: "KASUYA",      position: 3,  rebuys: 3,  addonCount: 1, prize: 40000 },
      { nickname: "GUIDO",       position: 4,  rebuys: 3,  addonCount: 1, prize: 21000 },
      { nickname: "LEO",         position: 5,  rebuys: 2,  addonCount: 1, prize:  8000 },
      { nickname: "ROMULO",      position: 6,  rebuys: 3,  addonCount: 1, prize:     0 },
      { nickname: "MANDI",       position: 7,  rebuys: 0,  addonCount: 1, prize:     0 },
      { nickname: "GAGO",        position: 8,  rebuys: 0,  addonCount: 1, prize:     0 },
      { nickname: "PORFS",       position: 9,  rebuys: 6,  addonCount: 1, prize:     0 },
      { nickname: "ALE",         position: 10, rebuys: 1,  addonCount: 1, prize:     0 },
      { nickname: "DANILO",      position: 11, rebuys: 6,  addonCount: 1, prize:     0 },
      { nickname: "FERNANDO",    position: 12, rebuys: 4,  addonCount: 1, prize:     0 },
      { nickname: "GUILHERMINA", position: 13, rebuys: 4,  addonCount: 1, prize:     0 },
      { nickname: "CAMARGO",     position: 14, rebuys: 0,  addonCount: 1, prize:     0 },
      { nickname: "DIGO",        position: 15, rebuys: 4,  addonCount: 1, prize:     0 },
    ],
  },
  {
    name: "2ª Etapa 2026",
    date: new Date("2026-02-03T19:00:00-03:00"),
    prizePoolOverride: 210000,
    participants: [
      { nickname: "GAGO",   position: 1,  rebuys: 2,  addonCount: 1, prize: 90000 },
      { nickname: "KREL",   position: 2,  rebuys: 4,  addonCount: 2, prize: 55000 },
      { nickname: "KASUYA", position: 3,  rebuys: 0,  addonCount: 2, prize: 35000 },
      { nickname: "RUY",    position: 4,  rebuys: 0,  addonCount: 2, prize: 20000 },
      { nickname: "ROMULO", position: 5,  rebuys: 7,  addonCount: 2, prize: 10000 },
      { nickname: "TARIK",  position: 6,  rebuys: 3,  addonCount: 2, prize:     0 },
      { nickname: "HEITOR", position: 7,  rebuys: 0,  addonCount: 2, prize:     0 },
      { nickname: "MANDI",  position: 8,  rebuys: 1,  addonCount: 2, prize:     0 },
      { nickname: "PORFS",  position: 9,  rebuys: 5,  addonCount: 2, prize:     0 },
      { nickname: "DANILO", position: 10, rebuys: 6,  addonCount: 2, prize:     0 },
      { nickname: "DIGO",   position: 11, rebuys: 3,  addonCount: 2, prize:     0 },
      { nickname: "LEO",    position: 12, rebuys: 2,  addonCount: 1, prize:     0 },
      { nickname: "PRETO",  position: 13, rebuys: 0,  addonCount: 2, prize:     0 },
    ],
  },
  {
    name: "3ª Etapa 2026",
    date: new Date("2026-02-17T19:00:00-03:00"),
    prizePoolOverride: 180000,
    participants: [
      { nickname: "GUIDO",   position: 1,  rebuys: 3,  addonCount: 2, prize: 85000 },
      { nickname: "HEITOR",  position: 2,  rebuys: 3,  addonCount: 2, prize: 50000 },
      { nickname: "CAMARGO", position: 3,  rebuys: 0,  addonCount: 2, prize: 25000 },
      { nickname: "PORFS",   position: 4,  rebuys: 6,  addonCount: 2, prize: 15000 },
      { nickname: "DIGO",    position: 5,  rebuys: 0,  addonCount: 2, prize:  5000 },
      { nickname: "MANDI",   position: 6,  rebuys: 0,  addonCount: 2, prize:     0 },
      { nickname: "KREL",    position: 7,  rebuys: 1,  addonCount: 2, prize:     0 },
      { nickname: "KASUYA",  position: 8,  rebuys: 2,  addonCount: 2, prize:     0 },
      { nickname: "GAGO",    position: 9,  rebuys: 0,  addonCount: 2, prize:     0 },
      { nickname: "PRETO",   position: 10, rebuys: 0,  addonCount: 2, prize:     0 },
      { nickname: "RUY",     position: 11, rebuys: 0,  addonCount: 2, prize:     0 },
      { nickname: "LEO",     position: 12, rebuys: 10, addonCount: 1, prize:     0 },
    ],
  },
  {
    name: "4ª Etapa 2026",
    date: new Date("2026-03-10T19:00:00-03:00"),
    prizePoolOverride: 228000,
    participants: [
      { nickname: "GAGO",    position: 1,  rebuys: 3,  addonCount: 1, prize: 100000 },
      { nickname: "DIGO",    position: 2,  rebuys: 1,  addonCount: 1, prize:  60000 },
      { nickname: "KREL",    position: 3,  rebuys: 5,  addonCount: 1, prize:  40000 },
      { nickname: "GUIDO",   position: 4,  rebuys: 7,  addonCount: 1, prize:  20000 },
      { nickname: "GUERRA",  position: 5,  rebuys: 1,  addonCount: 1, prize:   8000 },
      { nickname: "DANILO",  position: 6,  rebuys: 0,  addonCount: 1, prize:      0 },
      { nickname: "HEITOR",  position: 7,  rebuys: 2,  addonCount: 1, prize:      0 },
      { nickname: "KASUYA",  position: 8,  rebuys: 2,  addonCount: 1, prize:      0 },
      { nickname: "RUY",     position: 9,  rebuys: 5,  addonCount: 1, prize:      0 },
      { nickname: "CAMARGO", position: 10, rebuys: 1,  addonCount: 1, prize:      0 },
      { nickname: "ROMULO",  position: 11, rebuys: 3,  addonCount: 1, prize:      0 },
      { nickname: "MANDI",   position: 12, rebuys: 5,  addonCount: 1, prize:      0 },
      { nickname: "CAPELLO", position: 13, rebuys: 7,  addonCount: 1, prize:      0 },
      { nickname: "PORFS",   position: 14, rebuys: 4,  addonCount: 1, prize:      0 },
      { nickname: "LEO",     position: 15, rebuys: 0,  addonCount: 1, prize:      0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreatePlayer(nickname: string): Promise<number> {
  const existing = await db
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(eq(schema.players.nickname, nickname))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(schema.players)
    .values({ name: nickname, nickname })
    .returning({ id: schema.players.id });

  return created.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Iniciando seed da Temporada 2026...\n");

  // 1. Verificar se temporada ja existe
  const existingSeason = await db
    .select({ id: schema.seasons.id })
    .from(schema.seasons)
    .where(eq(schema.seasons.name, "Temporada 2026"))
    .limit(1);

  if (existingSeason.length > 0) {
    console.error("ERRO: Temporada 2026 ja existe no banco. Abortando para evitar duplicatas.");
    process.exit(1);
  }

  // 2. Buscar admin para createdBy
  const adminUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);

  if (adminUser.length === 0) {
    console.error("ERRO: Nenhum usuario admin encontrado. Faca login como admin primeiro.");
    process.exit(1);
  }
  const adminId = adminUser[0].id;
  console.log(`Admin encontrado: ${adminId}`);

  // 3. Criar temporada
  await db.update(schema.seasons).set({ isActive: false });
  const [season] = await db
    .insert(schema.seasons)
    .values({
      name: "Temporada 2026",
      startDate: "2026-01-01",
      isActive: true,
    })
    .returning({ id: schema.seasons.id });
  console.log(`Temporada criada: id=${season.id}`);

  // 4. Criar todos os jogadores (upsert por nickname)
  const playerMap = new Map<string, number>();
  for (const nickname of PLAYER_NICKNAMES) {
    const id = await findOrCreatePlayer(nickname);
    playerMap.set(nickname, id);
  }
  console.log(`${playerMap.size} jogadores prontos`);

  // 5. Criar etapas
  for (let i = 0; i < ETAPAS.length; i++) {
    const etapa = ETAPAS[i];
    console.log(`\nCriando ${etapa.name}...`);

    const [tournament] = await db
      .insert(schema.tournaments)
      .values({
        seasonId: season.id,
        name: etapa.name,
        date: etapa.date,
        status: "finished",
        buyInAmount: 5000,
        rebuyAmount: 3000,
        addonAmount: 3000,
        initialChips: 10000,
        rebuyChips: 10000,
        addonChips: 10000,
        maxRebuys: 0,
        allowAddon: true,
        rankingFeeAmount: 2000,
        prizePoolOverride: etapa.prizePoolOverride,
        createdBy: adminId,
      })
      .returning({ id: schema.tournaments.id });

    console.log(`  Tournament id=${tournament.id}`);

    for (const p of etapa.participants) {
      const playerId = playerMap.get(p.nickname);
      if (!playerId) {
        console.warn(`  AVISO: jogador ${p.nickname} nao encontrado, pulando`);
        continue;
      }

      const points = getPointsForPosition(p.position);
      const status = p.position === 1 ? "finished" : "eliminated";

      // Inserir participante
      const [participant] = await db
        .insert(schema.participants)
        .values({
          tournamentId: tournament.id,
          playerId,
          buyInPaid: true,
          rebuyCount: p.rebuys,
          addonUsed: p.addonCount > 0,
          finishPosition: p.position,
          pointsEarned: String(points),
          prizeAmount: p.prize,
          status,
          eliminatedAt: p.position === 1 ? null : etapa.date,
        })
        .returning({ id: schema.participants.id });

      // Transacao buy-in
      await db.insert(schema.transactions).values({
        tournamentId: tournament.id,
        playerId,
        type: "buy_in",
        amount: 5000,
      });

      // Transacoes rebuy (1 por rebuy para precisao)
      for (let r = 0; r < p.rebuys; r++) {
        await db.insert(schema.transactions).values({
          tournamentId: tournament.id,
          playerId,
          type: "rebuy",
          amount: 3000,
        });
      }

      // Transacoes addon (1 por addon comprado)
      for (let a = 0; a < p.addonCount; a++) {
        await db.insert(schema.transactions).values({
          tournamentId: tournament.id,
          playerId,
          type: "addon",
          amount: 3000,
        });
      }

      // Transacao premio
      if (p.prize > 0) {
        await db.insert(schema.transactions).values({
          tournamentId: tournament.id,
          playerId,
          type: "prize",
          amount: p.prize,
        });
      }

      const gastos = 5000 + p.rebuys * 3000 + p.addonCount * 3000;
      const saldo = p.prize - gastos;
      console.log(
        `  ${p.nickname.padEnd(12)} pos=${p.position} pts=${points} gastos=R$${gastos / 100} premio=R$${p.prize / 100} saldo=${saldo >= 0 ? "+" : ""}R$${saldo / 100}`
      );
    }
  }

  console.log("\n✓ Seed concluido com sucesso!");
  await client.end();
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
