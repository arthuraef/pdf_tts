/**
 * Injetor de Micro-Respirações Humanas (breathInjector.ts)
 * Gera matematicamente via Web Audio API uma amostra sutil e realista
 * de inspiração de ar humana (250ms) a custo zero de download (0 KB de asset).
 */

export class BreathInjector {
  private breathBuffer: AudioBuffer | null = null;

  /**
   * Sintetiza proceduralmente o som de respiração na inicialização do AudioContext.
   */
  public getOrCreateBreathBuffer(audioCtx: AudioContext): AudioBuffer {
    if (this.breathBuffer && this.breathBuffer.sampleRate === audioCtx.sampleRate) {
      return this.breathBuffer;
    }

    const duration = 0.25; // 250 milissegundos
    const sampleRate = audioCtx.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    // Gera ruído rosa/filtrado com envelope de ataque suave e decaimento
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount;

      // Envelope: sobe suavemente até 40% do tempo e depois decai
      let envelope = 0;
      if (t < 0.4) {
        envelope = Math.sin((t / 0.4) * (Math.PI / 2));
      } else {
        envelope = Math.cos(((t - 0.4) / 0.6) * (Math.PI / 2));
      }

      // Ruído branco
      const white = Math.random() * 2 - 1;

      // Filtro rosa simplificado de 3 polos
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const pink = b0 + b1 + b2 + white * 0.1848;

      // Volume moderado (12% do pico)
      data[i] = pink * 0.12 * envelope;
    }

    this.breathBuffer = buffer;
    return buffer;
  }

  /**
   * Toca a micro-respiração de forma ultra-suave e filtrada.
   */
  public playBreath(audioCtx: AudioContext, destination: AudioNode): void {
    try {
      const buffer = this.getOrCreateBreathBuffer(audioCtx);
      const source = audioCtx.createBufferSource();
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, audioCtx.currentTime); // Apenas frequências baixas/médias de ar suave

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime); // Volume ultra-discreto (2%), sem estalo

      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(destination);

      source.start();
    } catch (err) {
      // Falha suave sem interromper a fala
      console.warn('Erro ao reproduzir micro-respiração:', err);
    }
  }
}

export const breathInjector = new BreathInjector();
