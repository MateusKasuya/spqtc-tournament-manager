import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getTournamentById, getBlindStructure, getPrizeStructure, getTournamentResults } from "@/db/queries/tournaments";
import { getBlindTemplates } from "@/db/queries/blind-templates";
import { getPrizeTemplates } from "@/db/queries/prize-templates";
import { getSeasonById } from "@/db/queries/seasons";
import { StatusBadge } from "@/components/tournament/status-badge";
import { BlindStructureTable } from "@/components/tournament/blind-structure-table";
import { BlindStructureEditor } from "@/components/tournament/blind-structure-editor";
import { PrizeStructureEditor } from "@/components/tournament/prize-structure-editor";
import { TournamentResultsEditor } from "@/components/tournament/tournament-results-editor";
import { DeletePrizeStructureButton } from "@/components/tournament/delete-prize-structure-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatChips } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { DeleteTournamentButton } from "@/components/tournament/delete-tournament-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TorneioPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const [profile, tournament, blindLevels, prizePositions, blindTemplates, prizeTemplatesList, tournamentResultsData] = await Promise.all([
    getProfile(),
    getTournamentById(tournamentId),
    getBlindStructure(tournamentId),
    getPrizeStructure(tournamentId),
    getBlindTemplates(),
    getPrizeTemplates(),
    getTournamentResults(tournamentId),
  ]);

  if (!profile) redirect("/login");

  if (!tournament) notFound();

  const season = tournament.seasonId ? await getSeasonById(tournament.seasonId) : null;
  const isAdmin = profile?.role === "admin";
  const canEdit = isAdmin && !["finished", "cancelled"].includes(tournament.status);

  const prizeData = prizePositions.map((p) => ({
    position: p.position,
    percentage: Number(p.percentage),
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/torneios"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{tournament.name}</h1>
            {season && (
              <p className="text-sm text-muted-foreground">{season.name}</p>
            )}
          </div>
        </div>
        <StatusBadge
          status={tournament.status as "pending" | "running" | "finished" | "cancelled"}
        />
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href={`/torneios/${tournamentId}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Link>
          )}
          <DeleteTournamentButton tournamentId={tournamentId} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="blinds">Blinds</TabsTrigger>
          <TabsTrigger value="prizes">Premios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Data</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">
                {format(new Date(tournament.date), "d 'de' MMMM yyyy 'as' HH:mm", {
                  locale: ptBR,
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Buy-in</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">
                {formatCurrency(tournament.buyInAmount)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuracao financeira</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Rebuy</span>
              <span>{formatCurrency(tournament.rebuyAmount)}</span>
              <span className="text-muted-foreground">Add-on</span>
              <span>{tournament.allowAddon ? formatCurrency(tournament.addonAmount) : "Nao permitido"}</span>
              <span className="text-muted-foreground">Max rebuys</span>
              <span>{tournament.maxRebuys === 0 ? "Ilimitado" : tournament.maxRebuys}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fichas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Iniciais</span>
              <span>{formatChips(tournament.initialChips)}</span>
              <span className="text-muted-foreground">Rebuy</span>
              <span>{formatChips(tournament.rebuyChips)}</span>
              {tournament.allowAddon && (
                <>
                  <span className="text-muted-foreground">Add-on</span>
                  <span>{formatChips(tournament.addonChips)}</span>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blinds" className="mt-4 space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <BlindStructureEditor
                tournamentId={tournamentId}
                initialLevels={blindLevels}
                savedTemplates={blindTemplates}
              />
            </div>
          )}
          {blindLevels.length > 0 ? (
            <BlindStructureTable levels={blindLevels} />
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhuma estrutura de blinds configurada
            </p>
          )}
        </TabsContent>

        <TabsContent value="prizes" className="mt-4 space-y-6">
          {/* Preset de percentuais — editavel antes de finalizar */}
          {tournament.status !== "finished" && (
            <div className="space-y-3">
              {isAdmin && (
                <div className="flex justify-end gap-2">
                  {prizeData.length > 0 && (
                    <DeletePrizeStructureButton tournamentId={tournamentId} />
                  )}
                  <PrizeStructureEditor
                    tournamentId={tournamentId}
                    initialPositions={prizeData}
                    savedTemplates={prizeTemplatesList}
                  />
                </div>
              )}
              {prizeData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posicao</TableHead>
                      <TableHead>Percentual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prizeData.map((p) => (
                      <TableRow key={p.position}>
                        <TableCell className="font-medium">{p.position}º lugar</TableCell>
                        <TableCell>{p.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">
                  Nenhum preset de premios configurado
                </p>
              )}
            </div>
          )}

          {/* Resultado real — durante e apos o torneio */}
          {["running", "finished"].includes(tournament.status) && isAdmin && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Resultado</h3>
                <TournamentResultsEditor
                  tournamentId={tournamentId}
                  initialResults={tournamentResultsData}
                  prizeData={prizeData}
                  buyInAmount={tournament.buyInAmount}
                />
              </div>
              {tournamentResultsData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posicao</TableHead>
                      <TableHead>Valor pago</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tournamentResultsData.map((r) => (
                      <TableRow key={r.position}>
                        <TableCell className="font-medium">{r.position}º lugar</TableCell>
                        <TableCell>{formatCurrency(r.amountPaid)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">
                  Resultado ainda nao registrado
                </p>
              )}
            </div>
          )}

          {["running", "finished"].includes(tournament.status) && !isAdmin && tournamentResultsData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posicao</TableHead>
                  <TableHead>Valor pago</TableHead>
                  <TableHead>Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournamentResultsData.map((r) => (
                  <TableRow key={r.position}>
                    <TableCell className="font-medium">{r.position}º lugar</TableCell>
                    <TableCell>{formatCurrency(r.amountPaid)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
