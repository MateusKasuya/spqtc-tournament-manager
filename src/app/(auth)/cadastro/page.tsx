"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/actions/auth";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CadastroPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setEmailSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen bg-felt-pattern">
      <div className="m-auto w-full max-w-sm px-4 py-12">
        <div className="mb-10 flex justify-center">
          <Logo variant="large" />
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl">
          <h2 className="mb-6 font-heading font-semibold uppercase tracking-wide text-lg text-foreground">
            Criar conta
          </h2>

          {emailSent ? (
            <div className="space-y-4">
              <p className="rounded-md bg-green-500/10 px-3 py-3 text-sm text-green-600">
                Conta criada! Verifique seu email para confirmar o cadastro antes de entrar.
              </p>
              <Link href="/login">
                <Button className="w-full bg-brand hover:bg-brand-muted text-brand-foreground font-heading uppercase tracking-wider">
                  Ir para o login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider">
                    Senha
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-brand hover:bg-brand-muted text-brand-foreground font-heading uppercase tracking-wider"
                  disabled={loading}
                >
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/login" className="text-brand hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
