# Fase 0 — Bootstrap + Git

## Step 1: Inicializar projeto Next.js

```bash
cd /Users/mateuskasuya/Documents/spqc/tournament_manager
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

Se perguntar sobre sobrescrever, aceitar (diretório está quase vazio).

---

## Step 2: Instalar dependências

```bash
# Core
pnpm add drizzle-orm postgres @supabase/supabase-js @supabase/ssr zod

# Dev
pnpm add -D drizzle-kit
```

---

## Step 3: Inicializar shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

Opções:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

Instalar componentes:

```bash
pnpm dlx shadcn@latest add button card input label table dialog dropdown-menu separator badge avatar skeleton sonner tabs select textarea checkbox switch form popover command calendar
```

---

## Step 4: Criar arquivo de ambiente

Criar `.env.local` na raiz com as credenciais do Supabase (URL, anon key, database URL com senha). As credenciais foram fornecidas pelo usuário na conversa.

```
NEXT_PUBLIC_SUPABASE_URL=<fornecido pelo usuário>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<fornecido pelo usuário>
DATABASE_URL=<fornecido pelo usuário, com senha real>
```

**CRÍTICO:** Verificar se `.gitignore` inclui `.env.local`. Se não, adicionar.

---

## Step 5: Configurar Drizzle ORM

Criar `drizzle.config.ts` na raiz:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Criar `src/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
```

Criar `src/db/schema/index.ts`:

```typescript
// Schema definitions will be added in Phase 1+
// Each table gets its own file and is re-exported here
```

---

## Step 6: Configurar Supabase clients

Criar `src/lib/supabase/client.ts` — client do browser:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Criar `src/lib/supabase/server.ts` — client do servidor:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignorar se middleware refresh sessions
          }
        },
      },
    }
  );
}
```

Criar `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

---

## Step 7: Criar middleware do Next.js

Criar `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## Step 8: Configurar layout e página inicial

Atualizar `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SPQTC Tournament Manager",
  description: "Gerenciador de torneios de poker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

Atualizar `src/app/page.tsx`:

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">SPQTC Tournament Manager</h1>
        <p className="mt-2 text-muted-foreground">
          Gerenciador de torneios de poker
        </p>
      </div>
    </main>
  );
}
```

---

## Step 9: Criar estrutura de pastas

Criar diretórios vazios (com .gitkeep):

```
src/db/queries/
src/actions/
src/hooks/
src/types/
src/components/layout/
src/components/tournament/
src/components/live-table/
src/components/ranking/
src/components/providers/
```

---

## Step 10: Verificar se funciona

```bash
pnpm dev
```

Abrir http://localhost:3000 — deve mostrar "SPQTC Tournament Manager" centralizado. Parar o dev server após confirmar.

---

## Step 11: Git + GitHub

```bash
git init
git add .
git commit -m "chore: initial project setup with Next.js, Tailwind, shadcn/ui, Drizzle, Supabase"
gh repo create spqtc-tournament-manager --public --source=. --remote=origin
git push -u origin main
```

Se o branch padrão for `master` em vez de `main`, usar o que foi criado.

---

## Resultado esperado

- ✅ App roda em localhost:3000 com landing page
- ✅ Todas as dependências instaladas
- ✅ Supabase clients configurados (browser + server)
- ✅ Drizzle ORM configurado (sem tabelas ainda)
- ✅ shadcn/ui inicializado com componentes base
- ✅ Git inicializado e pushado para GitHub público
- ✅ .env.local com credenciais (NÃO commitado)
- ✅ Estrutura de pastas pronta para Fase 1

## O que NÃO está incluído na Fase 0
- ❌ Tabelas no banco (Fase 1+)
- ❌ Páginas de auth (Fase 1)
- ❌ UI além do placeholder
- ❌ Políticas RLS (Fase 1+)
