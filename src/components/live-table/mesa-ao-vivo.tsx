"use client";

import { useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { useTournamentRealtime } from "@/hooks/use-tournament-realtime";
import { useMesaData } from "@/hooks/use-mesa-data";
import { useCountdown } from "@/hooks/use-countdown";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { TimerDisplay } from "./timer-display";
import { TimerControls } from "./timer-controls";
import { BlindInfo } from "./blind-info";
import { TournamentStats } from "./tournament-stats";
import { QuickActions } from "./quick-actions";
import { StickyTimerBar } from "./sticky-timer-bar";
import { expireLevel, updateTournamentStatus } from "@/actions/tournaments";
import { getMesaLiveData } from "@/actions/mesa";
import { playLevelSound } from "@/lib/play-level-sound";
import { clockTone, ringTotalSecs, toIsoOrNull, type ClockState } from "@/lib/tournament-clock";
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
  playerId: number;
  name: string;
  nickname: string | null;
  status: string;
  finishPosition: number | null;
  buyInPaid: boolean;
  rebuyCount: number;
  addonCount: number;
  bonusChipUsed: boolean;
  currentBounty: number;
  bountiesCollected: number;
}

interface FinancialSummary {
  buy_in: number;
  rebuy: number;
  addon: number;
  prize: number;
}

interface Tournament extends ClockState {
  id: number;
  status: string;
  initialChips: number;
  rebuyChips: number;
  addonChips: number;
  buyInAmount: number;
  rebuyAmount: number;
  addonAmount: number;
  allowAddon: boolean;
  bonusChipAmount: number;
  prizePoolOverride: number | null;
  rankingFeeAmount: number;
  name: string;
  tournamentType: string;
  bountyPercentage: number;
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
  const liveTournament = useTournamentRealtime(tournament.id, tournament);
  const {
    participants: liveParticipants,
    financialSummary: liveFinancial,
    refetch: refetchMesa,
  } = useMesaData<Participant, FinancialSummary>(
    tournament.id,
    participants,
    financialSummary,
    () => getMesaLiveData(tournament.id)
  );
  const { remainingSeconds, isRunning } = useCountdown(liveTournament);
  useWakeLock(isRunning);

  const currentIndex = blindLevels.findIndex((b) => b.level === liveTournament.currentBlindLevel);
  const currentLevel = blindLevels[currentIndex] ?? blindLevels[0];
  const nextLevel = blindLevels[currentIndex + 1] ?? null;

  const totalSeconds = ringTotalSecs(liveTournament, blindLevels);
  const isBreak = liveTournament.breakActive || (currentLevel?.isBreak ?? false);
  const tone = clockTone(remainingSeconds, isRunning, isBreak);

  const autoAdvancedRef = useRef(false);
  const timerPanelRef = useRef<HTMLDivElement>(null);
  const [showStickyTimer, setShowStickyTimer] = useState(false);
  const [isPendingFinish, startFinishTransition] = useTransition();
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const el = timerPanelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyTimer(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0 && isRunning && isAdmin && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true;
      // Passa o timerStartedAt observado como trava de idempotencia: o
      // servidor decide entre avancar e encerrar o Intervalo avulso, e
      // reconhece quando outra aba/dispositivo admin ja processou este mesmo
      // Fim do nivel (o gravado mudou) para nao pular um nivel de blind.
      const expectedTimerStartedAt = toIsoOrNull(liveTournament.timerStartedAt);
      playLevelSound();
      startTransition(async () => {
        await expireLevel(tournament.id, expectedTimerStartedAt);
      });
    }
    if (remainingSeconds > 0) {
      autoAdvancedRef.current = false;
    }
  // timerStartedAt vira uma nova instância de Date a cada linha crua do
  // realtime; comparar pelo ISO evita re-rodar o efeito quando o instante
  // gravado na verdade não mudou (mesmo ajuste do use-countdown).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, isRunning, isAdmin, tournament.id, toIsoOrNull(liveTournament.timerStartedAt)]);

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
    <>
      {showStickyTimer && (
        <StickyTimerBar
          remainingSeconds={remainingSeconds}
          isRunning={isRunning}
          tone={tone}
          currentLevel={currentLevel}
          isAdmin={isAdmin}
          tournamentId={tournament.id}
          onScrollBack={() => timerPanelRef.current?.scrollIntoView({ behavior: "smooth" })}
        />
      )}

      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/torneios/${tournament.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">Mesa ao Vivo</p>
        </div>
      </div>

      {/* Timer + Blind Info */}
      <div ref={timerPanelRef} className="flex flex-col items-center gap-6 rounded-lg border p-8">
        <TimerDisplay
          remainingSeconds={remainingSeconds}
          tone={tone}
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
        participants={liveParticipants}
        tournament={liveTournament}
        financialSummary={liveFinancial}
      />

      {/* Quick Actions (admin only) */}
      {isAdmin && (
        <QuickActions
          participants={liveParticipants}
          tournament={liveTournament}
          onMutated={refetchMesa}
        />
      )}

      {/* Encerrar torneio (admin only) */}
      {isAdmin && (
        <div className="rounded-lg border border-destructive/30 p-4">
          {!confirmFinish ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium">Encerrar torneio</p>
                <p className="text-sm text-muted-foreground">Esta acao nao pode ser desfeita</p>
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
    </>
  );
}
