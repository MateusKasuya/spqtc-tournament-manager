export function playLevelSound() {
  try {
    const ctx = new AudioContext();
    const frequencies = [880, 1109, 1319];
    let time = ctx.currentTime;
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      osc.start(time);
      osc.stop(time + 0.3);
      time += 0.25;
    }
  } catch {
    // audiocontext nao disponivel
  }
}
