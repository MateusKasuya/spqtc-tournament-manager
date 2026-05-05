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
  const frequencies = [880, 1109, 1319, 1568, 1760, 1568, 1319, 1109, 880];
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

// Call from a user gesture (click/tap) to unlock Web Audio on Safari/iOS.
// Resumes the suspended AudioContext and plays a near-silent ping so iOS
// fully releases the audio session.
export function unlockAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  const playSilentPing = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    osc.frequency.value = 440;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(playSilentPing).catch(console.error);
  } else {
    playSilentPing();
  }
}
