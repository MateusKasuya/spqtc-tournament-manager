import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatChips } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
  isBreak: boolean;
  isAddonLevel: boolean;
  isBigAnte: boolean;
}

interface BlindStructureTableProps {
  levels: BlindLevel[];
}

export function BlindStructureTable({ levels }: BlindStructureTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Nivel</TableHead>
          <TableHead>Big Blind</TableHead>
          <TableHead className="w-24">Big Ante</TableHead>
          <TableHead className="w-24">Duracao</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {levels.map((level) => (
          <TableRow
            key={level.level}
            className={cn(
              level.isBreak && "bg-muted/50 text-muted-foreground italic",
              level.isAddonLevel && "border-l-2 border-l-primary"
            )}
          >
            <TableCell className="font-medium">{level.level}</TableCell>
            <TableCell>
              {level.isBreak ? "—" : formatChips(level.bigBlind)}
            </TableCell>
            <TableCell>
              {level.isBreak ? "—" : level.isBigAnte ? "Sim" : "—"}
            </TableCell>
            <TableCell>
              <span>{level.isBreak ? `Break ${level.durationMinutes}min` : `${level.durationMinutes}min`}</span>
              {level.isAddonLevel && (
                <span className="ml-2 text-xs font-medium text-primary">Add-on</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
