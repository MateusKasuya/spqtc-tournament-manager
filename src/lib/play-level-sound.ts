let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return null;
      sharedCtx = new AC() as AudioContext;
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function scheduleBeep(ctx: AudioContext) {
  const frequencies = [880, 1109, 1319];
  let time = ctx.currentTime + 0.1;
  for (const freq of frequencies) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.start(time);
    osc.stop(time + 0.4);
    time += 0.3;
  }
}

export function playLevelSound() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => scheduleBeep(ctx)).catch(console.error);
  } else {
    scheduleBeep(ctx);
  }
}
