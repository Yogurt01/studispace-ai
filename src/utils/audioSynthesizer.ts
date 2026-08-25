// Zero-dependency, pure Web Audio API ambient soundscapes and study FX

class AudioEngine {
  private ctx: AudioContext | null = null;
  private ambientNodes: Map<
    string,
    {
      gainNode: GainNode;
      sources: Array<AudioNode>;
      intervalId?: number;
    }
  > = new Map();

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play crisp Neo-Brutalist notification sounds
  public playChime(type: "bell" | "success" | "wrong" | "flip" | "levelup" | "click") {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "flip") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "bell") {
        // Japanese Zen Bell / Focus completion
        const freqs = [520, 1040, 1560];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.25 / (i + 1), now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 2.5);
        });
      } else if (type === "success") {
        // Upbeat victory chords
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0, now);
          gain.gain.setValueAtTime(0.2, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.6);
        });
      } else if (type === "wrong") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "levelup") {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.12, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.5);
        });
      }
    } catch (e) {
      console.warn("Audio chime failed to play", e);
    }
  }

  // Set ambient track volume (0 to 1) or start/stop
  public setAmbient(id: string, playing: boolean, volume: number = 0.5) {
    try {
      const ctx = this.getContext();

      if (!playing) {
        const existing = this.ambientNodes.get(id);
        if (existing) {
          existing.gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          setTimeout(() => {
            existing.sources.forEach((s) => {
              try {
                if ("stop" in s && typeof (s as AudioScheduledSourceNode).stop === "function") {
                  (s as AudioScheduledSourceNode).stop();
                }
              } catch (_) {}
            });
            if (existing.intervalId) clearInterval(existing.intervalId);
            this.ambientNodes.delete(id);
          }, 350);
        }
        return;
      }

      // If already playing, just adjust volume
      const existing = this.ambientNodes.get(id);
      if (existing) {
        existing.gainNode.gain.setValueAtTime(
          Math.max(0.001, volume * 0.6),
          ctx.currentTime
        );
        return;
      }

      // Create new sound generator
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(
        Math.max(0.001, volume * 0.6),
        ctx.currentTime + 0.5
      );
      masterGain.connect(ctx.destination);

      const sources: AudioNode[] = [];
      let intervalId: number | undefined;

      if (id === "rain") {
        // Pink/brown filtered noise + subtle drop generator
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0,
          b1 = 0,
          b2 = 0,
          b3 = 0,
          b4 = 0,
          b5 = 0,
          b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.06;
          b6 = white * 0.115926;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1200;

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        sources.push(whiteNoise);
      } else if (id === "binaural") {
        // 40Hz Gamma focus binaural tone (200Hz left, 240Hz right)
        const merger = ctx.createChannelMerger(2);

        const oscL = ctx.createOscillator();
        oscL.type = "sine";
        oscL.frequency.value = 200;

        const oscR = ctx.createOscillator();
        oscR.type = "sine";
        oscR.frequency.value = 240;

        const gainL = ctx.createGain();
        gainL.gain.value = 0.3;
        const gainR = ctx.createGain();
        gainR.gain.value = 0.3;

        oscL.connect(gainL);
        oscR.connect(gainR);
        gainL.connect(merger, 0, 0);
        gainR.connect(merger, 0, 1);

        merger.connect(masterGain);
        oscL.start();
        oscR.start();
        sources.push(oscL, oscR);
      } else if (id === "whitenoise") {
        // Pure smooth white/pink noise
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        source.connect(filter);
        filter.connect(masterGain);
        source.start();
        sources.push(source);
      } else if (id === "vinyl") {
        // Lofi vinyl warm crackle & hum
        const hum = ctx.createOscillator();
        hum.type = "sine";
        hum.frequency.value = 60;
        const humGain = ctx.createGain();
        humGain.gain.value = 0.15;
        hum.connect(humGain);
        humGain.connect(masterGain);
        hum.start();
        sources.push(hum);

        // Crackle generator loop
        intervalId = window.setInterval(() => {
          if (Math.random() > 0.4) {
            const crackle = ctx.createOscillator();
            const crackleGain = ctx.createGain();
            crackle.type = "triangle";
            crackle.frequency.value = 1000 + Math.random() * 3000;
            crackleGain.gain.setValueAtTime(0.04 * Math.random(), ctx.currentTime);
            crackleGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
            crackle.connect(crackleGain);
            crackleGain.connect(masterGain);
            crackle.start();
            crackle.stop(ctx.currentTime + 0.03);
          }
        }, 120);
      } else if (id === "cafe") {
        // Low warm ambient murmur
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.value = 140;

        const osc2 = ctx.createOscillator();
        osc2.type = "triangle";
        osc2.frequency.value = 220;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 350;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);
        osc1.start();
        osc2.start();
        sources.push(osc1, osc2);
      } else if (id === "stream") {
        // Forest gentle water stream
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.08;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1600;
        filter.Q.value = 1.2;

        source.connect(filter);
        filter.connect(masterGain);
        source.start();
        sources.push(source);
      }

      this.ambientNodes.set(id, {
        gainNode: masterGain,
        sources,
        intervalId,
      });
    } catch (e) {
      console.warn("Ambient audio error", e);
    }
  }

  public stopAllAmbient() {
    this.ambientNodes.forEach((_, id) => {
      this.setAmbient(id, false);
    });
  }
}

export const soundEngine = new AudioEngine();
