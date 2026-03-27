"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tournaments, blindStructures, prizeStructures } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_BLIND_STRUCTURE } from "@/lib/tournament-defaults";
import { tournamentResults } from "@/db/schema";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

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

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [tournament] = await db
    .insert(tournaments)
    .values({
      ...parsed.data,
      date: new Date(parsed.data.date),
      createdBy: auth.user.id,
    })
    .returning({ id: tournaments.id });

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

  if (!parsed.success) return { error: parsed.error.issues[0].message };

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
  redirect(`/torneios/${id}`);
}

export async function updateTournamentStatus(
  id: number,
  status: "pending" | "running" | "finished" | "cancelled"
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db
    .update(tournaments)
    .set({ status, updatedAt: new Date() })
    .where(eq(tournaments.id, id));

  revalidatePath(`/torneios/${id}`);
  revalidatePath("/torneios");
  return { success: true };
}

export async function deleteTournament(id: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

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
    isAddonLevel: boolean;
    isBigAnte: boolean;
  }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

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

export async function deletePrizeStructure(tournamentId: number) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(prizeStructures).where(eq(prizeStructures.tournamentId, tournamentId));

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function saveTournamentResults(
  tournamentId: number,
  results: { position: number; amountPaid: number; notes: string | null }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  await db.delete(tournamentResults).where(eq(tournamentResults.tournamentId, tournamentId));

  if (results.length > 0) {
    await db.insert(tournamentResults).values(
      results.map((r) => ({ tournamentId, ...r }))
    );
  }

  revalidatePath(`/torneios/${tournamentId}`);
  return { success: true };
}

export async function updatePrizeStructure(
  tournamentId: number,
  positions: { position: number; percentage: number }[]
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

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
