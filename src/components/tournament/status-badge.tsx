import { Badge } from "@/components/ui/badge";
import type { TournamentStatus } from "@/lib/tournament-status";

const STATUS_MAP = {
  pending: { label: "Pendente", variant: "outline" },
  running: { label: "Rodando", variant: "default" },
  finished: { label: "Encerrado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
} as const satisfies Record<TournamentStatus, { label: string; variant: string }>;

interface StatusBadgeProps {
  status: TournamentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = STATUS_MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
