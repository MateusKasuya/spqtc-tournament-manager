# Fase 2 — Torneios CRUD + Layout Principal

## Visao geral

Esta fase implementa:
1. Layout principal do dashboard (sidebar desktop + bottom nav mobile)
2. Schemas de banco: `seasons`, `tournaments`, `blind_structures`, `prize_structures`
3. Migrations e RLS para as novas tabelas
4. CRUD completo de temporadas (admin only)
5. CRUD completo de torneios (admin cria/edita, todos veem)
6. Estrutura de blinds configuravel por torneio
7. Estrutura de premios com defaults + override

**Decisoes aplicadas (fase 0.5):**
- Layout: sidebar desktop + bottom nav mobile
- Premios: tabela fixa com override por torneio
- Roles: apenas admin cria/edita torneios

---

## Step 1: Schemas do banco (Drizzle)

### 1a. `src/db/schema/seasons.ts`

```typescript
import { pgTable, serial, text, date, boolean, timestamp } from "drizzle-orm/pg-core";

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // ex: "Temporada 2026"
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 1b. `src/db/schema/tournaments.ts`

```typescript
import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { seasons } from "./seasons";
import { users } from "./users";

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").references(() => seasons.id),
  name: text("name").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "finished", "cancelled"],
  }).notNull().default("pending"),
  buyInAmount: integer("buy_in_amount").notNull(), // centavos
  rebuyAmount: integer("rebuy_amount").notNull().default(0),
  addonAmount: integer("addon_amount").notNull().default(0),
  initialChips: integer("initial_chips").notNull(),
  rebuyChips: integer("rebuy_chips").notNull().default(0),
  addonChips: integer("addon_chips").notNull().default(0),
  maxRebuys: integer("max_rebuys").notNull().default(0),
  allowAddon: boolean("allow_addon").notNull().default(false),
  prizePoolOverride: integer("prize_pool_override"), // centavos, nullable
  currentBlindLevel: integer("current_blind_level").notNull().default(0),
  timerRunning: boolean("timer_running").notNull().default(false),
  timerRemainingSecs: integer("timer_remaining_secs"),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Nota:** precisa importar `uuid` de `drizzle-orm/pg-core`.

### 1c. `src/db/schema/blind_structures.ts`

```typescript
import { pgTable, serial, integer, boolean, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const blindStructures = pgTable("blind_structures", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  level: integer("level").notNull(), // ordinal: 1, 2, 3...
  smallBlind: integer("small_blind").notNull(),
  bigBlind: integer("big_blind").notNull(),
  ante: integer("ante").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull(),
  isBreak: boolean("is_break").notNull().default(false),
}, (table) => [
  unique().on(table.tournamentId, table.level),
]);
```

### 1d. `src/db/schema/prize_structures.ts`

```typescript
import { pgTable, serial, integer, numeric, unique } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const prizeStructures = pgTable("prize_structures", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  position: integer("position").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
}, (table) => [
  unique().on(table.tournamentId, table.position),
]);
```

### 1e. Atualizar `src/db/schema/index.ts`

```typescript
export { users } from "./users";
export { seasons } from "./seasons";
export { tournaments } from "./tournaments";
export { blindStructures } from "./blind_structures";
export { prizeStructures } from "./prize_structures";
```

---

## Step 2: Migration

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

Verificar no Supabase Dashboard que as tabelas foram criadas corretamente.

---

## Step 3: RLS nas novas tabelas (SQL no Supabase)

Executar no **Supabase Dashboard > SQL Editor**:

```sql
-- ========== SEASONS ==========
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver temporadas
CREATE POLICY "Seasons viewable by authenticated"
  ON public.seasons FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admin cria/edita/deleta temporadas
CREATE POLICY "Admins can insert seasons"
  ON public.seasons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update seasons"
  ON public.seasons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete seasons"
  ON public.seasons FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ========== TOURNAMENTS ==========
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments viewable by authenticated"
  ON public.tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert tournaments"
  ON public.tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update tournaments"
  ON public.tournaments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete tournaments"
  ON public.tournaments FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ========== BLIND STRUCTURES ==========
ALTER TABLE public.blind_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blind structures viewable by authenticated"
  ON public.blind_structures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage blind structures"
  ON public.blind_structures FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ========== PRIZE STRUCTURES ==========
ALTER TABLE public.prize_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prize structures viewable by authenticated"
  ON public.prize_structures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage prize structures"
  ON public.prize_structures FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## Step 4: Constantes e defaults de premios

Criar `src/lib/tournament-defaults.ts`:

```typescript
/**
 * Estrutura de premios padrao baseada no numero de jogadores.
 * Decisao fase 0.5: tabela fixa com override por torneio.
 */
export const DEFAULT_PRIZE_STRUCTURES: Record<string, { position: number; percentage: number }[]> = {
  "3-4": [
    { position: 1, percentage: 100 },
  ],
  "5-6": [
    { position: 1, percentage: 70 },
    { position: 2, percentage: 30 },
  ],
  "7-10": [
    { position: 1, percentage: 50 },
    { position: 2, percentage: 30 },
    { position: 3, percentage: 20 },
  ],
  "11-15": [
    { position: 1, percentage: 45 },
    { position: 2, percentage: 27 },
    { position: 3, percentage: 18 },
    { position: 4, percentage: 10 },
  ],
  "16-20": [
    { position: 1, percentage: 40 },
    { position: 2, percentage: 25 },
    { position: 3, percentage: 18 },
    { position: 4, percentage: 12 },
    { position: 5, percentage: 5 },
  ],
};

/**
 * Retorna a estrutura de premios padrao para um dado numero de jogadores.
 */
export function getDefaultPrizeStructure(playerCount: number) {
  if (playerCount <= 4) return DEFAULT_PRIZE_STRUCTURES["3-4"];
  if (playerCount <= 6) return DEFAULT_PRIZE_STRUCTURES["5-6"];
  if (playerCount <= 10) return DEFAULT_PRIZE_STRUCTURES["7-10"];
  if (playerCount <= 15) return DEFAULT_PRIZE_STRUCTURES["11-15"];
  return DEFAULT_PRIZE_STRUCTURES["16-20"];
}

/**
 * Template de blind structure padrao para torneios caseiros.
 * Cada nivel dura 15 minutos. Breaks a cada 4 niveis.
 */
export const DEFAULT_BLIND_STRUCTURE = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15, isBreak: false },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 15, isBreak: false },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 15, isBreak: false },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 15, isBreak: false },
  { level: 5, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true }, // Break
  { level: 6, smallBlind: 150, bigBlind: 300, ante: 25, durationMinutes: 15, isBreak: false },
  { level: 7, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 15, isBreak: false },
  { level: 8, smallBlind: 300, bigBlind: 600, ante: 75, durationMinutes: 15, isBreak: false },
  { level: 9, smallBlind: 400, bigBlind: 800, ante: 100, durationMinutes: 15, isBreak: false },
  { level: 10, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true }, // Break
  { level: 11, smallBlind: 500, bigBlind: 1000, ante: 100, durationMinutes: 15, isBreak: false },
  { level: 12, smallBlind: 600, bigBlind: 1200, ante: 200, durationMinutes: 15, isBreak: false },
  { level: 13, smallBlind: 800, bigBlind: 1600, ante: 200, durationMinutes: 15, isBreak: false },
  { level: 14, smallBlind: 1000, bigBlind: 2000, ante: 300, durationMinutes: 15, isBreak: false },
  { level: 15, smallBlind: 1500, bigBlind: 3000, ante: 400, durationMinutes: 15, isBreak: false },
];
```

---

## Step 5: Queries reutilizaveis

### 5a. `src/db/queries/seasons.ts`

```typescript
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getSeasons() {
  return db.select().from(seasons).orderBy(desc(seasons.createdAt));
}

export async function getActiveSeason() {
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  return season ?? null;
}

export async function getSeasonById(id: number) {
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, id));
  return season ?? null;
}
```

### 5b. `src/db/queries/tournaments.ts`

```typescript
import { db } from "@/db";
import { tournaments, seasons, blindStructures, prizeStructures } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getTournaments() {
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      date: tournaments.date,
      status: tournaments.status,
      buyInAmount: tournaments.buyInAmount,
      seasonId: tournaments.seasonId,
      seasonName: seasons.name,
    })
    .from(tournaments)
    .leftJoin(seasons, eq(tournaments.seasonId, seasons.id))
    .orderBy(desc(tournaments.date));
}

export async function getTournamentsBySeasonId(seasonId: number) {
  return db
    .select()
    .from(tournaments)
    .where(eq(tournaments.seasonId, seasonId))
    .orderBy(desc(tournaments.date));
}

export async function getTournamentById(id: number) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id));
  return tournament ?? null;
}

export async function getBlindStructure(tournamentId: number) {
  return db
    .select()
    .from(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId))
    .orderBy(blindStructures.level);
}

export async function getPrizeStructure(tournamentId: number) {
  return db
    .select()
    .from(prizeStructures)
    .where(eq(prizeStructures.tournamentId, tournamentId))
    .orderBy(prizeStructures.position);
}
```

---

## Step 6: Server Actions

### 6a. `src/actions/seasons.ts`

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const seasonSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  startDate: z.string().min(1, "Data de inicio obrigatoria"),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
});

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const [profile] = await db
    .select()
    .from(require("@/db/schema").users)
    .where(eq(require("@/db/schema").users.id, user.id));

  if (profile?.role !== "admin") return { error: "Apenas admins podem fazer isso" };
  return { user };
}

export async function createSeason(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = seasonSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await db.insert(seasons).values({
    name: parsed.data.name,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate || null,
    isActive: parsed.data.isActive,
  });

  revalidatePath("/torneios");
  return { success: "Temporada criada!" };
}

export async function updateSeason(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = seasonSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await db
    .update(seasons)
    .set({
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null,
      isActive: parsed.data.isActive,
    })
    .where(eq(seasons.id, id));

  revalidatePath("/torneios");
  return { success: "Temporada atualizada!" };
}

export async function deleteSeason(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(seasons).where(eq(seasons.id, id));

  revalidatePath("/torneios");
  return { success: "Temporada excluida!" };
}
```

### 6b. `src/actions/tournaments.ts`

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tournaments, blindStructures, prizeStructures, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_BLIND_STRUCTURE } from "@/lib/tournament-defaults";

const tournamentSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  seasonId: z.number().nullable(),
  date: z.string().min(1, "Data obrigatoria"),
  buyInAmount: z.number().min(0, "Buy-in deve ser >= 0"),
  rebuyAmount: z.number().min(0).default(0),
  addonAmount: z.number().min(0).default(0),
  initialChips: z.number().min(1, "Fichas iniciais obrigatorias"),
  rebuyChips: z.number().min(0).default(0),
  addonChips: z.number().min(0).default(0),
  maxRebuys: z.number().min(0).default(0),
  allowAddon: z.boolean().default(false),
});

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id));

  if (profile?.role !== "admin") return { error: "Apenas admins podem fazer isso" };
  return { user };
}

export async function createTournament(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const seasonIdRaw = formData.get("seasonId");
  const parsed = tournamentSchema.safeParse({
    name: formData.get("name"),
    seasonId: seasonIdRaw ? Number(seasonIdRaw) : null,
    date: formData.get("date"),
    buyInAmount: Number(formData.get("buyInAmount")),
    rebuyAmount: Number(formData.get("rebuyAmount") ?? 0),
    addonAmount: Number(formData.get("addonAmount") ?? 0),
    initialChips: Number(formData.get("initialChips")),
    rebuyChips: Number(formData.get("rebuyChips") ?? 0),
    addonChips: Number(formData.get("addonChips") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
  });

  if (!parsed.success) return { error: parsed.error.errors[0].message };

  // Inserir torneio
  const [tournament] = await db
    .insert(tournaments)
    .values({
      ...parsed.data,
      date: new Date(parsed.data.date),
      createdBy: auth.user.id,
    })
    .returning({ id: tournaments.id });

  // Inserir blind structure padrao
  await db.insert(blindStructures).values(
    DEFAULT_BLIND_STRUCTURE.map((level) => ({
      tournamentId: tournament.id,
      ...level,
    }))
  );

  revalidatePath("/torneios");
  redirect(`/torneios/${tournament.id}`);
}

export async function updateTournament(id: number, formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const seasonIdRaw = formData.get("seasonId");
  const parsed = tournamentSchema.safeParse({
    name: formData.get("name"),
    seasonId: seasonIdRaw ? Number(seasonIdRaw) : null,
    date: formData.get("date"),
    buyInAmount: Number(formData.get("buyInAmount")),
    rebuyAmount: Number(formData.get("rebuyAmount") ?? 0),
    addonAmount: Number(formData.get("addonAmount") ?? 0),
    initialChips: Number(formData.get("initialChips")),
    rebuyChips: Number(formData.get("rebuyChips") ?? 0),
    addonChips: Number(formData.get("addonChips") ?? 0),
    maxRebuys: Number(formData.get("maxRebuys") ?? 0),
    allowAddon: formData.get("allowAddon") === "true",
  });

  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await db
    .update(tournaments)
    .set({
      ...parsed.data,
      date: new Date(parsed.data.date),
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, id));

  revalidatePath(`/torneios/${id}`);
  revalidatePath("/torneios");
  return { success: "Torneio atualizado!" };
}

export async function deleteTournament(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  // CASCADE deleta blind_structures e prize_structures automaticamente
  await db.delete(tournaments).where(eq(tournaments.id, id));

  revalidatePath("/torneios");
  redirect("/torneios");
}

export async function updateBlindStructure(
  tournamentId: number,
  levels: {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    durationMinutes: number;
    isBreak: boolean;
  }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  // Deletar existentes e reinserir (mais simples que upsert)
  await db
    .delete(blindStructures)
    .where(eq(blindStructures.tournamentId, tournamentId));

  if (levels.length > 0) {
    await db.insert(blindStructures).values(
      levels.map((l) => ({ tournamentId, ...l }))
    );
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: "Estrutura de blinds atualizada!" };
}

export async function updatePrizeStructure(
  tournamentId: number,
  positions: { position: number; percentage: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  // Validar que percentuais somam ~100
  const total = positions.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { error: `Percentuais devem somar 100% (atual: ${total}%)` };
  }

  await db
    .delete(prizeStructures)
    .where(eq(prizeStructures.tournamentId, tournamentId));

  if (positions.length > 0) {
    await db.insert(prizeStructures).values(
      positions.map((p) => ({
        tournamentId,
        position: p.position,
        percentage: String(p.percentage),
      }))
    );
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: "Estrutura de premios atualizada!" };
}
```

---

## Step 7: Layout principal do dashboard

### 7a. Navegacao — itens de menu

Criar `src/lib/navigation.ts`:

```typescript
import {
  LayoutDashboard,
  Trophy,
  Medal,
  Users,
  BarChart3,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Torneios", href: "/torneios", icon: Trophy },
  { label: "Ranking", href: "/ranking", icon: Medal },
  { label: "Jogadores", href: "/jogadores", icon: Users },
  { label: "Relatorios", href: "/relatorios", icon: BarChart3 },
] as const;
```

### 7b. Sidebar (desktop) — `src/components/layout/sidebar.tsx`

**Comportamento:**
- Visivel apenas em `md:` breakpoint e acima
- Largura fixa (~240px)
- Mostra logo no topo, itens de nav com icones, usuario + logout no rodape
- Item ativo tem highlight visual (baseado no pathname)

**Conteudo:**
```
+-------------------+
| [Logo] SPQTC      |
|-------------------|
| ▸ Dashboard       |
| ▸ Torneios        |
| ▸ Ranking         |
| ▸ Jogadores       |
| ▸ Relatorios      |
|                   |
|                   |
|-------------------|
| 👤 Nome           |
| [Sair]            |
+-------------------+
```

Usar `usePathname()` do Next.js para highlight do item ativo. Componente client (`"use client"`).

### 7c. Bottom nav (mobile) — `src/components/layout/bottom-nav.tsx`

**Comportamento:**
- Visivel apenas abaixo do `md:` breakpoint
- Fixo na parte inferior da tela
- 5 itens com icone + label compacto
- Item ativo tem cor diferenciada

Componente client (`"use client"`).

### 7d. Header mobile — `src/components/layout/mobile-header.tsx`

**Comportamento:**
- Visivel apenas no mobile (abaixo de `md:`)
- Mostra logo centralizado + avatar do usuario no canto direito
- Dropdown no avatar: nome, role, botao "Sair"

### 7e. Atualizar `src/app/(dashboard)/layout.tsx`

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <Sidebar user={profile} />

      {/* Conteudo principal */}
      <main className="flex-1 pb-16 md:pb-0">
        {/* Header mobile */}
        <MobileHeader user={profile} />

        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <BottomNav />
    </div>
  );
}
```

---

## Step 8: Paginas de torneios

### 8a. Lista de torneios — `src/app/(dashboard)/torneios/page.tsx`

**Conteudo:**
- Titulo "Torneios"
- Botao "Novo Torneio" (visivel apenas para admin)
- Filtro por temporada (select) e status (tabs: Todos, Pendente, Em andamento, Finalizado)
- Lista/cards de torneios com: nome, data, status (badge colorido), buy-in
- Clique no card vai para `/torneios/[id]`

**Se nao tem torneios:** mensagem empty state "Nenhum torneio encontrado"

### 8b. Criar torneio — `src/app/(dashboard)/torneios/novo/page.tsx`

**Acesso:** apenas admin (verificar role no server component, redirect se player).

**Formulario dividido em secoes (ou steps):**

**Secao 1: Informacoes basicas**
- Nome do torneio (text)
- Temporada (select, listando temporadas existentes + opcao "Sem temporada")
- Data e hora (datetime-local input)

**Secao 2: Configuracao financeira**
- Buy-in (input numerico em reais, converte para centavos ao salvar)
- Rebuy: valor e fichas (inputs numericos)
- Add-on: valor e fichas (inputs numericos)
- Max rebuys (input numerico)
- Permitir add-on (switch)

**Secao 3: Fichas**
- Fichas iniciais (input numerico)
- Fichas de rebuy (input numerico, pre-preenche com fichas iniciais)
- Fichas de add-on (input numerico)

**Nota sobre blinds e premios:** A blind structure e criada automaticamente com o template padrao. A prize structure sera definida ao finalizar o torneio (quando se sabe o numero de jogadores). Ambas podem ser editadas na pagina de detalhes do torneio.

**Botao:** "Criar Torneio" — chama server action `createTournament`, redireciona para `/torneios/[id]`

### 8c. Detalhes do torneio — `src/app/(dashboard)/torneios/[id]/page.tsx`

**Layout com tabs:**

**Tab "Visao Geral":**
- Informacoes basicas: nome, data, temporada, status
- Configuracao financeira: buy-in, rebuy, add-on
- Fichas: iniciais, rebuy, add-on
- Botoes admin: "Editar", "Excluir" (com confirmacao)

**Tab "Blinds":**
- Tabela mostrando todos os niveis: Level, Small Blind, Big Blind, Ante, Duracao, Break
- Botao admin: "Editar Blinds" — abre dialog/pagina para editar a estrutura inteira
- Highlights em breaks (cor diferenciada)

**Tab "Premios":**
- Se ja tem prize_structures definidas: mostra tabela (Posicao, Percentual)
- Se nao tem: mostra defaults baseados no numero de participantes + botao "Personalizar"
- Botao admin: "Editar Premios" — abre dialog para definir percentuais por posicao

**Status badge colorido:**
- `pending` → amarelo "Pendente"
- `running` → verde "Em andamento"
- `finished` → azul "Finalizado"
- `cancelled` → vermelho "Cancelado"

### 8d. Editar torneio — `src/app/(dashboard)/torneios/[id]/editar/page.tsx`

**Acesso:** apenas admin. Reutiliza o mesmo formulario do "novo" pre-preenchido com os dados existentes. Chama `updateTournament`.

**Restricao:** Nao permite editar torneio com status `finished` ou `cancelled`.

---

## Step 9: Componentes de torneio

Criar em `src/components/tournament/`:

### 9a. `tournament-card.tsx`
- Card compacto para lista de torneios
- Mostra: nome, data formatada (date-fns), status badge, buy-in formatado (R$)
- Clicavel — link para `/torneios/[id]`

### 9b. `tournament-form.tsx`
- Formulario reutilizavel (criar e editar)
- Props: `initialData?` (para edicao), `seasons` (lista de temporadas para o select)
- Usa componentes shadcn: Input, Select, Switch, Button, Label
- Validacao client-side basica + mensagens de erro do server action

### 9c. `blind-structure-table.tsx`
- Tabela read-only dos niveis de blind
- Props: `levels` (array)
- Destaca breaks com background diferente

### 9d. `blind-structure-editor.tsx`
- Dialog ou pagina para editar estrutura de blinds
- Permite adicionar/remover/reordenar niveis
- Campos por nivel: SB, BB, Ante, Duracao, Break checkbox
- Botao "Usar template padrao" reseta para DEFAULT_BLIND_STRUCTURE
- Botao "Salvar" chama `updateBlindStructure`

### 9e. `prize-structure-editor.tsx`
- Dialog para editar percentuais de premios
- Campos por posicao: Posicao (readonly), Percentual (input)
- Permite adicionar/remover posicoes
- Validacao: soma deve ser 100%
- Botao "Usar padrao" preenche com base no DEFAULT_PRIZE_STRUCTURES
- Botao "Salvar" chama `updatePrizeStructure`

### 9f. `status-badge.tsx`
- Badge colorido para status do torneio
- Recebe `status` como prop, mapeia para cor e label em pt-BR

---

## Step 10: Atualizar Dashboard

Atualizar `src/app/(dashboard)/dashboard/page.tsx`:

**Conteudo:**
- Saudacao: "Ola, {nome}!"
- Card: "Temporada Atual" — nome e periodo (ou "Nenhuma temporada ativa")
- Card: "Proximo Torneio" — nome, data e buy-in do proximo torneio pendente
- Card: "Ultimo Torneio" — nome, data e vencedor do ultimo torneio finalizado
- Botao rapido (admin): "Criar Torneio"

Buscar dados usando as queries de `src/db/queries/`.

---

## Step 11: Helpers de formatacao

Criar `src/lib/format.ts`:

```typescript
/**
 * Formata centavos para reais (ex: 5000 -> "R$ 50,00")
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Formata chips (ex: 10000 -> "10.000")
 */
export function formatChips(chips: number): string {
  return new Intl.NumberFormat("pt-BR").format(chips);
}
```

---

## Step 12: Verificacao final

1. `pnpm dev` — app roda sem erros
2. Login como admin
3. Dashboard mostra layout com sidebar (desktop) e bottom nav (mobile)
4. Navegacao entre paginas funciona (highlight no item ativo)
5. Criar uma temporada
6. Criar um torneio associado a temporada
7. Ver torneio — tabs de visao geral, blinds e premios
8. Editar torneio — dados pre-preenchidos, salva corretamente
9. Editar blinds — salva corretamente
10. Excluir torneio — confirmacao + redireciona para lista
11. Login como player — NAO ve botoes de criar/editar/excluir
12. Dashboard mostra cards de proximo torneio e temporada ativa
13. Testar responsividade: sidebar some no mobile, bottom nav aparece

---

## Resultado esperado

- ✅ Layout principal com sidebar desktop + bottom nav mobile
- ✅ Tabelas seasons, tournaments, blind_structures, prize_structures criadas
- ✅ RLS: todos veem, apenas admin gerencia
- ✅ CRUD de temporadas (admin only)
- ✅ CRUD de torneios com blind structure padrao
- ✅ Edicao de blind structures por torneio
- ✅ Edicao de prize structures por torneio (com defaults)
- ✅ Dashboard atualizado com cards informativos
- ✅ Formatacao de valores em pt-BR (R$, fichas)
- ✅ UI responsiva e funcional

## O que NAO esta incluido na Fase 2

- ❌ Inscricao de participantes em torneios (Fase 3)
- ❌ Controle financeiro: pagamentos de buy-in, rebuy, addon (Fase 3)
- ❌ Eliminacao de jogadores e posicoes finais (Fase 3)
- ❌ Timer ao vivo e controle de blinds em tempo real (Fase 4)
- ❌ Ranking e pontuacao (Fase 5)
- ❌ Paginas de jogadores e perfil
