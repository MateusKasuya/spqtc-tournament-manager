# Fase 1 — Auth (Login, Registro, Roles, RLS)

## Pre-requisito: Downgrade Next.js para 15 estavel

O projeto esta no Next.js 16.2.1-canary.6. Decisao da fase 0.5: downgrade para 15 estavel.

```bash
pnpm add next@15 eslint-config-next@15
```

Verificar se `pnpm dev` ainda funciona apos o downgrade.

---

## Visao geral

Esta fase implementa:
1. Tabela `users` no banco (Drizzle schema + migration)
2. Trigger para sincronizar `auth.users` -> `public.users`
3. Paginas de login e registro (email + senha)
4. Server actions para auth
5. Rota de callback (confirmacao de email)
6. Middleware com protecao de rotas
7. Politicas RLS na tabela `users`
8. Pagina placeholder do dashboard (destino pos-login)

**Decisoes aplicadas (fase 0.5):**
- Auth: email + senha via Supabase Auth
- Roles: admin + player (default player)
- Registro aberto (qualquer pessoa cria conta)

---

## Step 1: Schema da tabela `users` (Drizzle)

Criar `src/db/schema/users.ts`:

```typescript
import { pgTable, uuid, text, timestamptz } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // ref auth.users.id
  email: text("email").notNull(),
  name: text("name").notNull(),
  nickname: text("nickname").unique(),
  role: text("role", { enum: ["admin", "player"] }).notNull().default("player"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamptz("created_at").defaultNow().notNull(),
});
```

Atualizar `src/db/schema/index.ts`:

```typescript
export { users } from "./users";
```

---

## Step 2: Migration

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

Verificar no Supabase Dashboard que a tabela `users` foi criada com as colunas corretas.

---

## Step 3: Trigger de sincronizacao (SQL no Supabase)

Executar no **Supabase Dashboard > SQL Editor**:

```sql
-- Funcao que cria um registro em public.users quando alguem se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara apos INSERT em auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**O que isso faz:** quando um usuario se registra via Supabase Auth, automaticamente cria um registro espelho em `public.users` com o mesmo `id`, o `email`, e o `name` (pego dos metadados ou extraido do email).

---

## Step 4: Middleware com protecao de rotas

Criar `src/middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/login", "/register", "/api/auth/callback"];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Rotas publicas: nao precisa de auth
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response;
  }

  // Verificar se o usuario esta logado
  const supabase = createServerClientForMiddleware(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

// Helper: cria client Supabase dentro do middleware sem duplicar cookies
function createServerClientForMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  const { createServerClient } = require("@supabase/ssr");
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Nota para o executor:** na implementacao real, revisar se e melhor reutilizar o `updateSession` existente em vez de criar um segundo client. A ideia e: o `updateSession` ja faz refresh de sessao, e depois verificamos o user para decidir se redireciona. O approach exato pode ser simplificado — o importante e que:
1. Sessao e refreshed em toda request
2. Rotas protegidas redirecionam para `/login` se nao autenticado
3. Rotas publicas (`/login`, `/register`, `/api/auth/callback`) sao acessiveis sem login

---

## Step 5: Server Actions de Auth

Criar `src/actions/auth.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const registerSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export async function login(formData: FormData) {
  const supabase = await createClient();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email ou senha incorretos" };
  }

  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const supabase = await createClient();

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
    },
  });

  if (error) {
    return { error: "Erro ao criar conta. Tente novamente." };
  }

  // Supabase envia email de confirmacao automaticamente
  return { success: "Conta criada! Verifique seu email para confirmar." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

---

## Step 6: Rota de callback (confirmacao de email)

Criar `src/app/api/auth/callback/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Erro: redireciona para login com mensagem
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

---

## Step 7: Layout de auth

Criar `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
```

Layout centralizado e simples — card no meio da tela.

---

## Step 8: Pagina de Login

Criar `src/app/(auth)/login/page.tsx`:

Componentes usados: `Card`, `Input`, `Label`, `Button` (todos ja instalados via shadcn).

**Campos:**
- Email (input type email)
- Senha (input type password)
- Botao "Entrar"
- Link "Nao tem conta? Cadastre-se" -> `/register`

**Comportamento:**
- Chama server action `login`
- Se erro, mostra mensagem acima do form
- Se sucesso, redireciona para `/dashboard`
- Se vier `?error=auth` na URL (callback falhou), mostra mensagem generica

---

## Step 9: Pagina de Registro

Criar `src/app/(auth)/register/page.tsx`:

**Campos:**
- Nome (input type text)
- Email (input type email)
- Senha (input type password)
- Botao "Criar conta"
- Link "Ja tem conta? Entrar" -> `/login`

**Comportamento:**
- Chama server action `register`
- Se erro, mostra mensagem
- Se sucesso, mostra mensagem "Verifique seu email" (Supabase envia confirmacao)

---

## Step 10: Dashboard placeholder

Criar `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id));

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          Ola, {profile?.name ?? "Jogador"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Role: {profile?.role ?? "player"}
        </p>
        {/* Placeholder — layout e navegacao serao implementados na fase seguinte */}
      </div>
    </main>
  );
}
```

Criar `src/app/(dashboard)/layout.tsx` (placeholder simples, layout real vem depois):

```typescript
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

---

## Step 11: Politicas RLS (SQL no Supabase)

Executar no **Supabase Dashboard > SQL Editor**:

```sql
-- Habilitar RLS na tabela users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Qualquer usuario autenticado pode ver todos os usuarios (ranking, lista de jogadores)
CREATE POLICY "Users are viewable by authenticated users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Usuario pode editar apenas seu proprio perfil
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Apenas o trigger (SECURITY DEFINER) insere — ninguem insere diretamente
-- Nenhuma policy de INSERT para usuarios normais

-- Admin pode atualizar qualquer usuario (ex: mudar role)
CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Step 12: Configurar Supabase Auth (Dashboard)

No **Supabase Dashboard > Authentication > Providers**:
- Verificar que **Email** esta habilitado
- **Confirm email**: manter habilitado (seguranca)
- **Site URL**: `http://localhost:3000` (dev) — atualizar para URL de producao no deploy

No **Supabase Dashboard > Authentication > URL Configuration**:
- **Redirect URLs**: adicionar `http://localhost:3000/api/auth/callback`

---

## Step 13: Promover primeiro admin (SQL)

Apos criar sua conta via registro, executar no SQL Editor:

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'SEU_EMAIL_AQUI';
```

---

## Step 14: Redirecionar pagina raiz

Atualizar `src/app/page.tsx` para redirecionar:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
```

---

## Step 15: Verificacao final

1. `pnpm dev` — app roda sem erros
2. Acessar `localhost:3000` — redireciona para `/login`
3. Clicar em "Cadastre-se" — vai para `/register`
4. Criar conta com email + senha + nome
5. Verificar email (clicar no link de confirmacao)
6. Fazer login — redireciona para `/dashboard`
7. Dashboard mostra nome e role do usuario
8. Verificar no Supabase Dashboard que `auth.users` e `public.users` ambos tem o registro
9. Promover para admin via SQL e verificar que dashboard mostra "admin"

---

## Resultado esperado

- ✅ Tabela `users` criada com Drizzle + migration
- ✅ Trigger sincroniza auth.users -> public.users automaticamente
- ✅ Pagina de login funcional (email + senha)
- ✅ Pagina de registro funcional (cria conta + email de confirmacao)
- ✅ Callback route processa confirmacao de email
- ✅ Middleware protege rotas — redireciona para login se nao autenticado
- ✅ RLS ativo: usuarios veem todos, editam apenas proprio perfil, admin edita qualquer um
- ✅ Dashboard placeholder mostra nome e role do usuario logado
- ✅ Roles admin/player funcionando

## O que NAO esta incluido na Fase 1
- ❌ Layout com sidebar/bottom nav (Fase 2+)
- ❌ Pagina de perfil/edicao de usuario
- ❌ Google OAuth (pode ser adicionado depois)
- ❌ Tabelas de seasons/tournaments/etc (Fase 2+)
