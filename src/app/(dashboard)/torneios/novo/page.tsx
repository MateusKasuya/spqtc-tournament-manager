import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getSeasons } from "@/db/queries/seasons";
import { TournamentForm } from "@/components/tournament/tournament-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NovoTorneioPage() {
  const [profile, seasons] = await Promise.all([getProfile(), getSeasons()]);

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/torneios");

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/torneios"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Novo Torneio</h1>
      </div>

      <TournamentForm seasons={seasons} />
    </div>
  );
}
