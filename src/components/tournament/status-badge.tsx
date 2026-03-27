import { Badge } from "@/components/ui/badge";

const STATUS_MAP = {
  pending: { label: "Pendente", variant: "outline" as const },
  running: { label: "Em andamento", variant: "default" as const },
  finished: { label: "Finalizado", variant: "secondary" as const },
  cancelled: { label: "Cancelado", variant: "destructive" as const },
};

interface StatusBadgeProps {
  status: keyof typeof STATUS_MAP;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return <Badge variant={variant}>{label}</Badge>;
}
