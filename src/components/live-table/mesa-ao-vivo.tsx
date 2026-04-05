"use client";

import { useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTournamentRealtime } from "@/hooks/use-tournament-realtime";
import { useParticipantsRealtime } from "@/hooks/use-participants-realtime";
import { useCountdown } from "@/hooks/use-countdown";
import { TimerDisplay } from "./timer-display";
import { TimerControls } from "./timer-controls";
import { BlindInfo } from "./blind-info";
import { TournamentStats } from "./tournament-stats";
import { QuickActions } from "./quick-actions";
import { advanceBlindLevel, updateTournamentStatus, endBreak } from "@/actions/tournaments";
import { playLevelSound } from "@/lib/play-level-sound";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

interface Participant {
  id: number;
  name: string;
  nickname: string | null;
  status: string;
  finishPosition: number | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonUsed: boolean;
}

interface FinancialSummary {
  buy_in: number;
  rebuy: number;
  addon: number;
  prize: number;
}

interface Tournament {
  id: number;
  currentBlindLevel: number;
  timerRunning: boolean;
  timerRemainingSecs: number | null;
  timerStartedAt: Date | string | null;
  status: string;
  initialChips: number;
  rebuyChips: number;
  addonChips: number;
  buyInAmount: number;
  rebuyAmount: number;
  addonAmount: number;
  allowAddon: boolean;
  prizePoolOverride: number | null;
  rankingFeeAmount: number;
  name: string;
  breakActive: boolean;
}

interface MesaAoVivoProps {
  tournament: Tournament;
  blindLevels: BlindLevel[];
  participants: Participant[];
  financialSummary: FinancialSummary;
  isAdmin: boolean;
}

export function MesaAoVivo({
  tournament,
  blindLevels,
  participants,
  financialSummary,
  isAdmin,
}: MesaAoVivoProps) {
  const router = useRouter();
  const liveTournament = useTournamentRealtime(tournament.id, tournament);
  useParticipantsRealtime(tournament.id);
  const { remainingSeconds, isRunning } = useCountdown(liveTournament);

  // Polling como fallback caso Realtime não entregue eventos
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [router]);

  const currentIndex = blindLevels.findIndex((b) => b.level === liveTournament.currentBlindLevel);
  const currentLevel = blindLevels[currentIndex] ?? blindLevels[0];
  const nextLevel = blindLevels[currentIndex + 1] ?? null;

  const totalSeconds = currentLevel ? currentLevel.durationMinutes * 60 : 0;

  const autoAdvancedRef = useRef(false);
  const [isPendingFinish, startFinishTransition] = useTransition();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (remainingSeconds === 0 && isRunning && isAdmin && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true;
      if (liveTournament.breakActive) {
        playLevelSound();
        startTransition(async () => {
          await endBreak(tournament.id);
        });
      } else {
        playLevelSound();
        startTransition(async () => {
          await advanceBlindLevel(tournament.id);
        });
      }
    }
    if (remainingSeconds > 0) {
      autoAdvancedRef.current = false;
    }
  }, [remainingSeconds, isRunning, isAdmin, tournament.id, liveTournament.breakActive]);

  if (!currentLevel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>Nenhuma estrutura de blinds configurada.</p>
        <Link href={`/torneios/${tournament.id}`} className="mt-2 text-sm underline">
          Voltar ao torneio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/torneios/${tournament.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-semibold">{tournament.name}</h1>
          <p className="text-xs text-muted-foreground">Mesa ao Vivo</p>
        </div>
      </div>

      {/* Timer + Blind Info */}
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
        <TimerDisplay
          remainingSeconds={remainingSeconds}
          isRunning={isRunning}
          isBreak={liveTournament.breakActive || currentLevel.isBreak}
          totalSeconds={totalSeconds}
        />

        <BlindInfo
          currentLevel={currentLevel}
          nextLevel={nextLevel}
          breakActive={liveTournament.breakActive}
        />

        {isAdmin && (
          <TimerControls
            tournamentId={tournament.id}
            isRunning={isRunning}
            currentLevelIndex={currentIndex}
            totalLevels={blindLevels.length}
            breakActive={liveTournament.breakActive}
          />
        )}
      </div>

      {/* Stats */}
      <TournamentStats
        participants={participants}
        tournament={liveTournament}
        financialSummary={financialSummary}
      />

      {/* Quick Actions (admin only) */}
      {isAdmin && (
        <QuickActions
          participants={participants}
          tournament={liveTournament}
        />
      )}

      {/* Encerrar torneio (admin only) */}
      {isAdmin && (
        <div className="rounded-lg border border-destructive/30 p-4">
          {!confirmFinish ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Encerrar torneio</p>
                <p className="text-xs text-muted-foreground">Esta acao nao pode ser desfeita</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmFinish(true)}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                Encerrar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Tem certeza que deseja encerrar o torneio?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    startFinishTransition(async () => {
                      const result = await updateTournamentStatus(tournament.id, "finished");
                      if (result && "error" in result) {
                        setConfirmFinish(false);
                      }
                    });
                  }}
                  disabled={isPendingFinish}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPendingFinish ? "Encerrando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFinish(false)}
                  disabled={isPendingFinish}
                  className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
