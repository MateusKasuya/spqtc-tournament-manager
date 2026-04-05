import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import Link from "next/link";

interface RankingEntry {
  playerId: number;
  playerName: string;
  playerNickname: string | null;
  totalPoints: string | null;
  tournamentsPlayed: number;
  bestPosition: number | null;
  wins: number;
}

interface TournamentPoint {
  playerId: number;
  tournamentId: number;
  finishPosition: number | null;
  pointsEarned: string;
}

interface SeasonTournament {
  id: number;
  name: string;
  date: Date;
}

interface RankingTableProps {
  ranking: RankingEntry[];
  pointsByTournament: TournamentPoint[];
  seasonTournaments: SeasonTournament[];
}

function PositionIcon({ position }: { position: number }) {
  if (position === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (position === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (position === 3) return <Award className="h-4 w-4 text-amber-600" />;
  return <span className="text-muted-foreground text-sm font-mono">{position}°</span>;
}

export function RankingTable({ ranking, pointsByTournament, seasonTournaments }: RankingTableProps) {
  if (ranking.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Nenhum torneio finalizado nesta temporada.</p>
        </CardContent>
      </Card>
    );
  }

  // Mapa: playerId -> tournamentId -> points
  const pointsMap = new Map<number, Map<number, number>>();
  for (const pt of pointsByTournament) {
    if (!pointsMap.has(pt.playerId)) {
      pointsMap.set(pt.playerId, new Map());
    }
    pointsMap.get(pt.playerId)!.set(pt.tournamentId, Number(pt.pointsEarned));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classificacao</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">#</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead className="text-center font-bold">Pts</TableHead>
                {seasonTournaments.map((t, i) => (
                  <TableHead key={t.id} className="text-center text-xs">
                    {i + 1}ª
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((entry, index) => {
                const playerPoints = pointsMap.get(entry.playerId);
                return (
                  <TableRow key={entry.playerId}>
                    <TableCell className="pl-4">
                      <PositionIcon position={index + 1} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/jogadores/${entry.playerId}`}
                        className="hover:underline"
                      >
                        <span className="font-medium">
                          {entry.playerNickname ?? entry.playerName}
                        </span>
                        {entry.playerNickname && (
                          <span className="block text-xs text-muted-foreground">
                            {entry.playerName}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {Number(entry.totalPoints ?? 0)}
                    </TableCell>
                    {seasonTournaments.map((t) => {
                      const pts = playerPoints?.get(t.id);
                      return (
                        <TableCell key={t.id} className="text-center text-sm">
                          {pts !== undefined ? pts : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
