import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Coins } from "lucide-react";

interface TournamentCardProps {
  tournament: {
    id: number;
    name: string;
    date: Date;
    status: "pending" | "running" | "finished" | "cancelled";
    buyInAmount: number;
    seasonName?: string | null;
  };
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  return (
    <Link href={`/torneios/${tournament.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{tournament.name}</CardTitle>
            <StatusBadge status={tournament.status} />
          </div>
          {tournament.seasonName && (
            <p className="text-xs text-muted-foreground">{tournament.seasonName}</p>
          )}
        </CardHeader>
        <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(new Date(tournament.date), "d MMM yyyy", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" />
            {formatCurrency(tournament.buyInAmount)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
