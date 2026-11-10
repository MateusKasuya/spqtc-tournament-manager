import { Skeleton } from "@/components/ui/skeleton";

// Fica no grupo (lista) para cobrir só a lista. Em /torneios/ ele envolveria
// também /torneios/[id] e a Mesa, e no build de produção do Next 15.5 uma
// Server Action com revalidatePath sob esse <Suspense> pode nunca commitar: o
// React perde o ping da transição e o botão fica pendente até a próxima
// interação (vercel/next.js#98303). Não ponha loading.tsx acima de [id].

export default function TorneiosLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border px-4 py-3 flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
