import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PlayerProfileProps {
  player: { id: number; name: string; nickname: string | null };
  stats: {
    totalPoints: string | null;
    tournamentsPlayed: number;
    bestPosition: number | null;
    wins: number;
    totalPrize: string | null;
    totalRebuys: string | null;
  } | null;
  seasonHistory: {
    tournamentId: number;
    tournamentName: string;
    tournamentDate: Date;
    buyInAmount: number;
    rebuyAmount: number;
    addonAmount: number;
    finishPosition: number | null;
    pointsEarned: string;
    prizeAmount: number;
    rebuyCount: number;
    addonUsed: boolean;
  }[];
  seasonName: string | null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function PlayerProfile({ player, stats, seasonHistory, seasonName }: PlayerProfileProps) {
  const totalGastos = seasonHistory.reduce((sum, e) => {
    return sum + e.buyInAmount + e.rebuyCount * e.rebuyAmount + (e.addonUsed ? e.addonAmount : 0);
  }, 0);

  const totalPremio = seasonHistory.reduce((sum, e) => sum + e.prizeAmount, 0);
  const saldo = totalPremio - totalGastos;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/ranking" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {player.nickname ?? player.name}
          </h1>
          {player.nickname && (
            <p className="text-sm text-muted-foreground">{player.name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pontos totais" value={String(Number(stats?.totalPoints ?? 0))} />
        <StatCard label="Torneios" value={String(stats?.tournamentsPlayed ?? 0)} />
        <StatCard label="Vitorias" value={String(stats?.wins ?? 0)} />
        <StatCard
          label="Melhor posicao"
          value={stats?.bestPosition ? `${stats.bestPosition}°` : "-"}
        />
      </div>

      {seasonName && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{seasonName}</span>
              {totalGastos > 0 && (
                <span className={`text-sm font-semibold ${saldo >= 0 ? "text-green-500" : "text-destructive"}`}>
                  {saldo >= 0 ? "+" : ""}{formatCurrency(saldo)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seasonHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum torneio finalizado nesta temporada.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-center">Pos.</TableHead>
                      <TableHead className="text-center">Pts</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Premio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonHistory.map((entry) => {
                      const gastos = entry.buyInAmount + entry.rebuyCount * entry.rebuyAmount + (entry.addonUsed ? entry.addonAmount : 0);
                      return (
                        <TableRow key={entry.tournamentId}>
                          <TableCell>
                            <Link
                              href={`/torneios/${entry.tournamentId}`}
                              className="hover:underline"
                            >
                              <span className="text-sm">{entry.tournamentName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {format(new Date(entry.tournamentDate), "d MMM yyyy", { locale: ptBR })}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {entry.finishPosition ? `${entry.finishPosition}°` : "-"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {Number(entry.pointsEarned)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(gastos)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {entry.prizeAmount > 0
                              ? formatCurrency(entry.prizeAmount)
                              : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex justify-between text-xs text-muted-foreground mt-3 pt-3 border-t">
                  <span>Total gastos: {formatCurrency(totalGastos)}</span>
                  <span>Total premios: {formatCurrency(totalPremio)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
