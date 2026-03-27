import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { getTournamentById, getBlindStructure, getPrizeStructure } from "@/db/queries/tournaments";
import { getBlindTemplates } from "@/db/queries/blind-templates";
import { getPrizeTemplates } from "@/db/queries/prize-templates";
import { getSeasonById } from "@/db/queries/seasons";
import { getParticipants } from "@/db/queries/participants";
import { getTournamentFinancialSummary } from "@/db/queries/transactions";
import { getAllUsers } from "@/db/queries/users";
import { StatusBadge } from "@/components/tournament/status-badge";
import { BlindStructureTable } from "@/components/tournament/blind-structure-table";
import { BlindStructureEditor } from "@/components/tournament/blind-structure-editor";
import { PrizeStructureEditor } from "@/components/tournament/prize-structure-editor";
import { DeletePrizeStructureButton } from "@/components/tournament/delete-prize-structure-button";
import { ParticipantList } from "@/components/tournament/participant-list";
import { AddParticipantDialog } from "@/components/tournament/add-participant-dialog";
import { FinancialSummary } from "@/components/tournament/financial-summary";
import { PayoutDialog } from "@/components/tournament/payout-dialog";
import { DeleteTournamentButton } from "@/components/tournament/delete-tournament-button";
import { CopyInviteLinkButton } from "@/components/tournament/copy-invite-link-button";
import { SelfRegisterButton } from "@/components/tournament/self-register-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatCurrency, formatChips } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TorneioPage({ params }: PageProps) {
  const { id } = await params;
  const tournamentId = Number(id);
  if (isNaN(tournamentId)) notFound();

  const [profile, tournament, blindLevels, prizePositions, blindTemplates, prizeTemplatesList, participantsList, financialSummary, allUsers] = await Promise.all([
    getProfile(),
    getTournamentById(tournamentId),
    getBlindStructure(tournamentId),
    getPrizeStructure(tournamentId),
    getBlindTemplates(),
    getPrizeTemplates(),
    getParticipants(tournamentId),
    getTournamentFinancialSummary(tournamentId),
    getAllUsers(),
  ]);

  if (!profile) redirect("/login");
  if (!tournament) notFound();

  const season = tournament.seasonId ? await getSeasonById(tournament.seasonId) : null;
  const isAdmin = profile?.role === "admin";
  const canEdit = isAdmin && !["finished", "cancelled"].includes(tournament.status);
  const isActive = ["pending", "running"].includes(tournament.status);

  const prizeData = prizePositions.map((p) => ({
    position: p.position,
    percentage: Number(p.percentage),
  }));

  const participantUserIds = new Set(participantsList.map((p) => p.userId));
  const availableUsers = allUsers.filter((u) => !participantUserIds.has(u.id));
  const isRegistered = participantUserIds.has(profile.id);

  const prizePool = tournament.prizePoolOverride ??
    (financialSummary.buy_in + financialSummary.rebuy + financialSummary.addon);

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

      {!isAdmin && isActive && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">
              {isRegistered ? "Voce esta inscrito neste torneio" : "Quer participar?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRegistered
                ? "O admin confirmara seu buy-in no dia do evento"
                : "Inscreva-se agora. O admin confirmara seu buy-in no dia do evento"}
            </p>
          </div>
          {isRegistered ? (
            <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1 shrink-0 dark:text-green-400 dark:bg-green-950 dark:border-green-800">
              Inscrito
            </span>
          ) : (
            <div className="shrink-0">
              <SelfRegisterButton tournamentId={tournamentId} />
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              href={`/torneios/${tournamentId}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Link>
          )}
          {isActive && <CopyInviteLinkButton tournamentId={tournamentId} />}
          <DeleteTournamentButton tournamentId={tournamentId} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="players">
            Jogadores
            {participantsList.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {participantsList.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="blinds">Blinds</TabsTrigger>
          <TabsTrigger value="prizes">Premios</TabsTrigger>
        </TabsList>

        {/* Visao Geral */}
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

          <FinancialSummary
            summary={financialSummary}
            prizePoolOverride={tournament.prizePoolOverride}
          />
        </TabsContent>

        {/* Jogadores */}
        <TabsContent value="players" className="mt-4 space-y-4">
          {isAdmin && isActive && (
            <div className="flex justify-end">
              <AddParticipantDialog
                tournamentId={tournamentId}
                availableUsers={availableUsers}
              />
            </div>
          )}
          <ParticipantList
            participants={participantsList.map((p) => ({
              ...p,
              status: p.status as string,
              finishPosition: p.finishPosition ?? null,
            }))}
            isAdmin={isAdmin && isActive}
            allowAddon={tournament.allowAddon}
            buyInAmount={tournament.buyInAmount}
            rebuyAmount={tournament.rebuyAmount}
            addonAmount={tournament.addonAmount}
          />
        </TabsContent>

        {/* Blinds */}
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

        {/* Premios */}
        <TabsContent value="prizes" className="mt-4 space-y-6">
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
                      <TableHead>Valor estimado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prizeData.map((p) => (
                      <TableRow key={p.position}>
                        <TableCell className="font-medium">{p.position}º lugar</TableCell>
                        <TableCell>{p.percentage}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatCurrency(Math.round(prizePool * p.percentage / 100))}
                        </TableCell>
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

          {["running", "finished"].includes(tournament.status) && isAdmin && prizeData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Distribuicao de premios</h3>
                <PayoutDialog
                  tournamentId={tournamentId}
                  prizePool={prizePool}
                  prizePositions={prizeData}
                  participants={participantsList.map((p) => ({
                    userId: p.userId,
                    name: p.name,
                    nickname: p.nickname,
                    finishPosition: p.finishPosition ?? null,
                  }))}
                />
              </div>

              {participantsList.some((p) => p.prizeAmount > 0) && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posicao</TableHead>
                      <TableHead>Jogador</TableHead>
                      <TableHead>Premio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantsList
                      .filter((p) => p.prizeAmount > 0)
                      .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.finishPosition}º lugar</TableCell>
                          <TableCell>{p.nickname ? `${p.name} (${p.nickname})` : p.name}</TableCell>
                          <TableCell>{formatCurrency(p.prizeAmount)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {["running", "finished"].includes(tournament.status) && !isAdmin && participantsList.some((p) => p.prizeAmount > 0) && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posicao</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Premio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsList
                  .filter((p) => p.prizeAmount > 0)
                  .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99))
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.finishPosition}º lugar</TableCell>
                      <TableCell>{p.nickname ? `${p.name} (${p.nickname})` : p.name}</TableCell>
                      <TableCell>{formatCurrency(p.prizeAmount)}</TableCell>
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
