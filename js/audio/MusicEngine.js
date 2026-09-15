export class IndustrialMusicEngine {
      constructor(soundSynth) {
        this.synth = soundSynth;
        this.isPlaying = false;
        this.tempo = 126;
        this.stepTime = (60 / this.tempo) / 4; // 16th note in seconds (~0.119s)
        this.currentStep = 0;
        this.timer = null;
        this.masterGain = null;
      }

      init() {
        const ctx = this.synth.ensureCtx();
        if (!this.masterGain && ctx) {
          this.masterGain = ctx.createGain();
          this.masterGain.gain.setValueAtTime(0.22, ctx.currentTime);
          this.masterGain.connect(ctx.destination);
        }
      }

      start() {
        if (this.isPlaying) return;
        this.init();
        this.isPlaying = true;
        this.currentStep = 0;
        this.scheduleNext();
      }

      stop() {
        this.isPlaying = false;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      }

      toggle() {
        if (this.isPlaying) {
          this.stop();
          return false;
        } else {
          this.start();
          return true;
        }
      }

      scheduleNext() {
        if (!this.isPlaying) return;
        const ctx = this.synth.ensureCtx();
        const now = ctx.currentTime;

        this.playStep(this.currentStep, now + 0.02);
        this.currentStep = (this.currentStep + 1) % 16;

        this.timer = setTimeout(() => {
          this.scheduleNext();
        }, this.stepTime * 1000);
      }

      playStep(step, time) {
        const ctx = this.synth.ensureCtx();
        if (!ctx || !this.masterGain) return;

        // 1. Bumbo Industrial (Batidas nos tempos 0, 4, 8, 12 + contratempo 10)
        if (step === 0 || step === 4 || step === 8 || step === 12 || step === 10) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(140, time);
          osc.frequency.exponentialRampToValueAtTime(36, time + 0.08);
          gain.gain.setValueAtTime(step === 0 || step === 8 ? 0.38 : 0.28, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(time);
          osc.stop(time + 0.12);
        }

        // 2. Caixa Snare Industrial (Tempos 4 e 12)
        if (step === 4 || step === 12) {
          const bufferSize = ctx.sampleRate * 0.12;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-4 * (i / bufferSize));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1100, time);
          filter.Q.setValueAtTime(1.2, time);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.24, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          noise.start(time);
        }

        // 3. Chimbal Hi-Hat (em todas as semicolcheias pares)
        if (step % 2 === 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(7500, time);
          gain.gain.setValueAtTime(step % 4 === 2 ? 0.05 : 0.025, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(time);
          osc.stop(time + 0.03);
        }

        // 4. Linha de Baixo Rítmica em Ré Menor (D1: 36.7Hz, F1: 43.6Hz, G1: 49Hz, G#1: 51.9Hz)
        const bassFreqs = [
          36.7, 36.7, 36.7, 43.6, // D, D, D, F
          36.7, 36.7, 49.0, 36.7, // D, D, G, D
          36.7, 36.7, 51.9, 55.0, // D, D, G#, A
          36.7, 32.7, 36.7, 36.7  // D, C, D, D
        ];
        const freq = bassFreqs[step];

        const bassOsc = ctx.createOscillator();
        const bassFilter = ctx.createBiquadFilter();
        const bassGain = ctx.createGain();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(freq, time);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(450, time);
        bassFilter.frequency.exponentialRampToValueAtTime(120, time + 0.09);
        bassFilter.Q.setValueAtTime(3.5, time);

        bassGain.gain.setValueAtTime(0.2, time);
        bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.095);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.masterGain);

        bassOsc.start(time);
        bassOsc.stop(time + 0.1);

        // 5. Stabs de Guitarra / Sintetizador Industrial (Tempos 0 e 8)
        if (step === 0 || step === 8) {
          [73.4, 110.0, 146.8].forEach(chordFreq => { // Acorde D Power Chord
            const chordOsc = ctx.createOscillator();
            const chordGain = ctx.createGain();
            chordOsc.type = 'sawtooth';
            chordOsc.frequency.setValueAtTime(chordFreq, time);
            chordGain.gain.setValueAtTime(0.08, time);
            chordGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
            chordOsc.connect(chordGain);
            chordGain.connect(this.masterGain);
            chordOsc.start(time);
            chordOsc.stop(time + 0.18);
          });
        }
      }
    }

    /* =========================================================================
       2. MOTOR DE TERRENO E SHROUD / NÉVOA DE GUERRA (FOG OF WAR)
       ========================================================================= */