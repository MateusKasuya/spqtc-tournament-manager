import { vi, beforeAll, afterEach } from "vitest";
import { migrateTestDb, resetTestDb, testDb } from "@/test/db";
import { users, tournaments, players, participants } from "@/db/schema";

vi.mock("@/db", async () => ({ db: (await import("@/test/db")).testDb }));

export const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "00000000-0000-0000-0000-000000000001" } })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "00000000-0000-0000-0000-000000000001" } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { role: "admin" } })),
        })),
      })),
    })),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

beforeAll(async () => { await migrateTestDb(); });
afterEach(async () => { await resetTestDb(); });

export async function seedUser() {
  await testDb.insert(users).values({
    id: TEST_USER_ID, email: "t@t.com", name: "Test", role: "admin",
  }).onConflictDoNothing();
}

export async function seedTournament(overrides: Partial<typeof tournaments.$inferInsert> = {}) {
  await seedUser();
  const [t] = await testDb.insert(tournaments).values({
    name: "T", date: new Date(), buyInAmount: 100, initialChips: 10000,
    createdBy: TEST_USER_ID, ...overrides,
  }).returning();
  return t.id;
}

export async function seedPlayer(name = "P") {
  const [p] = await testDb.insert(players).values({ name }).returning();
  return p.id;
}

export async function seedParticipant(
  tournamentId: number,
  playerId: number,
  overrides: Partial<typeof participants.$inferInsert> = {}
) {
  const [p] = await testDb.insert(participants)
    .values({ tournamentId, playerId, ...overrides }).returning();
  return p.id;
}

// N jogadores distintos, todos status "playing" — retorna os participantIds em ordem
export async function seedPlayingParticipants(tournamentId: number, count: number) {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const playerId = await seedPlayer(`P${i}`);
    ids.push(await seedParticipant(tournamentId, playerId, { status: "playing", buyInPaid: true }));
  }
  return ids;
}

export function makeLevels(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    level: i + 1, smallBlind: (i + 1) * 10, bigBlind: (i + 1) * 20,
    ante: 0, durationMinutes: 15, isBreak: false, isAddonLevel: false, isBigAnte: false,
  }));
}
