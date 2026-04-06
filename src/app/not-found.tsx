import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground text-sm">Pagina nao encontrada.</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Ir para o dashboard
      </Link>
    </div>
  );
}
