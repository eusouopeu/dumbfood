// Bipe de alarme sem depender de arquivo de áudio: três tons curtos via Web Audio API.

export function tocarBip(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tocarTom = (atraso: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const inicio = ctx.currentTime + atraso;
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.3, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.35);
    };
    [0, 0.4, 0.8].forEach(tocarTom);
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Sem suporte a Web Audio: o alarme fica só visual/hático.
  }
}
