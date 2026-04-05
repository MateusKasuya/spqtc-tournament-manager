import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getSeasons } from "@/db/queries/seasons";
import { SeasonFormDialog } from "@/components/tournament/season-form-dialog";
import { ToggleSeasonButton } from "@/components/season/toggle-season-button";
import { DeleteSeasonButton } from "@/components/season/delete-season-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function TemporadasPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const seasons = await getSeasons();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Temporadas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {seasons.length} temporada{seasons.length !== 1 ? "s" : ""} cadastrada{seasons.length !== 1 ? "s" : ""}
          </p>
        </div>
        <SeasonFormDialog onCreated={undefined}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova temporada
          </Button>
        </SeasonFormDialog>
      </div>

      {seasons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma temporada cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{season.name}</p>
                  {season.isActive && (
                    <Badge variant="default" className="text-xs">Ativa</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desde {format(new Date(season.startDate), "d MMM yyyy", { locale: ptBR })}
                  {season.endDate && (
                    <> até {format(new Date(season.endDate), "d MMM yyyy", { locale: ptBR })}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!season.isActive && (
                  <ToggleSeasonButton seasonId={season.id} />
                )}
                <DeleteSeasonButton seasonId={season.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
