"use client";

import { useState } from "react";
import Link from "next/link";
import { register } from "@/actions/auth";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
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

          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {success}
            </p>
          )}

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-muted-foreground text-xs uppercase tracking-wider">
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Seu nome"
                required
              />
            </div>
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-brand hover:text-brand/80 underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
