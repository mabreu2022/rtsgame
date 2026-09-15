export class IndustrialMusicEngine {
  constructor(soundSynth) {
    this.synth = soundSynth;
    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.currentStep = 0;
    this.timer = null;
    this.masterGain = null;
    this.volume = 0.65; // 65% volume default

    // Catálogo de 4 Trilhas Sonoras Originais com Estética C&C
    this.tracks = [
      {
        id: 'hell_march',
        title: '1. HELL MARCH // TIBERIAN METAL',
        genre: 'Industrial Metal',
        tempo: 126,
        description: 'Bateria industrial pesada, contratempos e stabs elétricos em Ré menor.'
      },
      {
        id: 'act_on_instinct',
        title: '2. ACT ON INSTINCT // TACTICAL GROOVE',
        genre: 'Militar Funk-Rock',
        tempo: 116,
        description: 'Groove tático de baixo pulsante em Lá menor e sintetizadores de ataque.'
      },
      {
        id: 'lone_trooper',
        title: '3. LONE TROOPER // DARK AMBIENT',
        genre: 'Cinemático Espacial',
        tempo: 94,
        description: 'Pads profundos, sub-graves de atmosfera sci-fi e tensão tática.'
      },
      {
        id: 'mechanical_rush',
        title: '4. MECHANICAL RUSH // HIGH VELOCITY',
        genre: 'Fast Acid Warfare',
        tempo: 138,
        description: 'Ritmo acelerado, bumbos duplos e arpejos agressivos para combate intenso.'
      }
    ];

    this.stepTime = (60 / this.tracks[0].tempo) / 4;
  }

  init() {
    const ctx = this.synth.ensureCtx();
    if (!this.masterGain && ctx) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume * 0.35, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
  }

  setVolume(fraction) {
    this.volume = Math.max(0, Math.min(1, fraction));
    if (this.masterGain && this.synth.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume * 0.35, this.synth.ctx.currentTime);
    }
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    this.isPlaying = true;
    this.currentStep = 0;
    this.stepTime = (60 / this.tracks[this.currentTrackIndex].tempo) / 4;
    this.updateHUDTrackDisplay();
    this.scheduleNext();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updateHUDTrackDisplay();
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

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.stepTime = (60 / this.tracks[this.currentTrackIndex].tempo) / 4;
    this.currentStep = 0;
    this.updateHUDTrackDisplay();
    if (!this.isPlaying) this.start();
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.stepTime = (60 / this.tracks[this.currentTrackIndex].tempo) / 4;
    this.currentStep = 0;
    this.updateHUDTrackDisplay();
    if (!this.isPlaying) this.start();
  }

  updateHUDTrackDisplay() {
    const cur = this.tracks[this.currentTrackIndex];
    const trackTxt = document.getElementById('currentTrackTitle');
    const playBtn = document.getElementById('btnMusicPlay');
    const vu = document.getElementById('vu-meter');

    if (trackTxt) trackTxt.innerText = cur.title;
    if (playBtn) playBtn.innerText = this.isPlaying ? '⏸' : '▶';
    if (vu) {
      if (this.isPlaying) vu.classList.add('active');
      else vu.classList.remove('active');
    }

    const legacyBtn = document.getElementById('btnMusicToggle');
    if (legacyBtn) {
      legacyBtn.innerText = this.isPlaying ? `🎵 TRILHA: ${cur.title}` : '🔇 TRILHA: DESLIGADA';
      legacyBtn.style.borderColor = this.isPlaying ? 'var(--hud-cyan)' : '#445566';
      legacyBtn.style.color = this.isPlaying ? '#fff' : '#8899aa';
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

    switch (this.currentTrackIndex) {
      case 0:
        this.playHellMarch(ctx, step, time);
        break;
      case 1:
        this.playActOnInstinct(ctx, step, time);
        break;
      case 2:
        this.playLoneTrooper(ctx, step, time);
        break;
      case 3:
        this.playMechanicalRush(ctx, step, time);
        break;
    }
  }

  // FAIXA 1: HELL MARCH (Heavy Industrial Metal 126 BPM)
  playHellMarch(ctx, step, time) {
    // 1. Kick com punch duplo
    if (step === 0 || step === 4 || step === 8 || step === 12 || step === 10) {
      this.triggerPunchyKick(ctx, time, step === 0 || step === 8 ? 0.45 : 0.32);
    }
    // 2. Snare saturada nos tempos 4 e 12
    if (step === 4 || step === 12) {
      this.triggerIndustrialSnare(ctx, time, 0.3);
    }
    // 3. Hi-Hat metálico em semicolcheias
    if (step % 2 === 0) {
      this.triggerHiHat(ctx, time, step % 4 === 2 ? 0.06 : 0.03, 8500, 0.2);
    }
    // 4. Baixo Distorcido em Ré menor
    const dMinorBass = [36.7, 36.7, 36.7, 43.6, 36.7, 36.7, 49.0, 36.7, 36.7, 36.7, 51.9, 55.0, 36.7, 32.7, 36.7, 36.7];
    this.triggerResonantBass(ctx, time, dMinorBass[step], 480, 0.22);

    // 5. Power Chord Stabs nos tempos 0 e 8
    if (step === 0 || step === 8) {
      this.triggerPowerChord(ctx, time, [73.4, 110.0, 146.8], 0.16);
    }
  }

  // FAIXA 2: ACT ON INSTINCT (Militar Funk-Rock 116 BPM)
  playActOnInstinct(ctx, step, time) {
    // Kick ritmado funk
    if (step === 0 || step === 6 || step === 8 || step === 14) {
      this.triggerPunchyKick(ctx, time, 0.38);
    }
    // Snare com estalo rápido nos tempos 4 e 12
    if (step === 4 || step === 12) {
      this.triggerIndustrialSnare(ctx, time, 0.26);
    }
    // Hi-hat com swing
    if (step % 2 === 0) {
      this.triggerHiHat(ctx, time, step === 2 || step === 10 ? 0.08 : 0.03, 7000, -0.2);
    }
    // Linha de baixo melódica em Lá menor
    const aMinorBass = [55.0, 55.0, 65.4, 73.4, 55.0, 82.4, 73.4, 65.4, 55.0, 55.0, 98.0, 82.4, 73.4, 65.4, 55.0, 49.0];
    this.triggerResonantBass(ctx, time, aMinorBass[step], 650, 0.24);

    // Lead Synth arpejado nos contratempos
    if (step === 2 || step === 6 || step === 10 || step === 14) {
      const leadNotes = [220.0, 261.6, 293.7, 329.6];
      this.triggerLeadSynth(ctx, time, leadNotes[Math.floor(step / 4)], 0.12);
    }
  }

  // FAIXA 3: LONE TROOPER (Dark Ambient 94 BPM)
  playLoneTrooper(ctx, step, time) {
    // Kick sub-grave profundo nos tempos 0 e 8
    if (step === 0 || step === 8) {
      this.triggerSubKick(ctx, time, 0.5);
    }
    // Rimshot / Snare suave com eco no tempo 4 e 12
    if (step === 4 || step === 12) {
      this.triggerSoftSnare(ctx, time, 0.18);
    }
    // Hi-hat espacial esparso
    if (step % 4 === 2) {
      this.triggerHiHat(ctx, time, 0.04, 6000, 0.3);
    }
    // Baixo Pulsante Lento em Dó menor
    const cMinorBass = [32.7, 32.7, 38.9, 32.7, 49.0, 49.0, 43.6, 32.7, 32.7, 32.7, 58.3, 49.0, 38.9, 32.7, 32.7, 29.1];
    this.triggerResonantBass(ctx, time, cMinorBass[step], 280, 0.28);

    // Pad Atmosférico
    if (step === 0) {
      this.triggerAtmosphericPad(ctx, time, [130.8, 155.6, 196.0], 0.14);
    }
  }

  // FAIXA 4: MECHANICAL RUSH (High Velocity Acid Warfare 138 BPM)
  playMechanicalRush(ctx, step, time) {
    // Bumbo Duplo rápido (pedal duplo de metal)
    if (step % 2 === 0) {
      this.triggerPunchyKick(ctx, time, step % 4 === 0 ? 0.42 : 0.28);
    }
    // Snare nos tempos 4 e 12
    if (step === 4 || step === 12) {
      this.triggerIndustrialSnare(ctx, time, 0.34);
    }
    // Hi-Hat contínuo em alta velocidade
    this.triggerHiHat(ctx, time, step % 2 === 0 ? 0.04 : 0.02, 9000, 0.1);

    // Acid Bass Sequencer rápido
    const acidNotes = [41.2, 49.0, 55.0, 61.7, 82.4, 73.4, 61.7, 49.0, 41.2, 61.7, 73.4, 82.4, 110.0, 98.0, 82.4, 61.7];
    this.triggerAcidBass(ctx, time, acidNotes[step], 0.2);

    // Alarme de Combate sintetizado
    if (step === 0 || step === 8) {
      this.triggerLeadSynth(ctx, time, 440.0, 0.15);
    }
  }

  // SÍNTESE DE TIMBRES ACÚSTICOS E ELETRÔNICOS

  triggerPunchyKick(ctx, time, gainLevel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Curva de pitch de impacto transitório
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  triggerSubKick(ctx, time, gainLevel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.22);
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  triggerIndustrialSnare(ctx, time, gainLevel) {
    const bufferSize = ctx.sampleRate * 0.14;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-5 * (i / bufferSize));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1250, time);
    filter.Q.setValueAtTime(1.5, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  triggerSoftSnare(ctx, time, gainLevel) {
    const bufferSize = ctx.sampleRate * 0.18;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / bufferSize));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  triggerHiHat(ctx, time, gainLevel, freq = 8000, pan = 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, time);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      osc.connect(gain);
      gain.connect(this.masterGain);
    }

    osc.start(time);
    osc.stop(time + 0.035);
  }

  triggerResonantBass(ctx, time, freq, cutoff, gainLevel) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(90, time + 0.1);
    filter.Q.setValueAtTime(3.8, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.11);
  }

  triggerAcidBass(ctx, time, freq, gainLevel) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + 0.08);
    filter.Q.setValueAtTime(6.0, time); // Acid squelch

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.085);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.085);
  }

  triggerLeadSynth(ctx, time, freq, gainLevel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  triggerPowerChord(ctx, time, freqs, gainLevel) {
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * (idx === 1 ? 1.004 : (idx === 2 ? 0.996 : 1.0)), time);

      gain.gain.setValueAtTime(gainLevel, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.18);
    });
  }

  triggerAtmosphericPad(ctx, time, freqs, gainLevel) {
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.linearRampToValueAtTime(700, time + 1.2);

      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(gainLevel, time + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 2.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 2.2);
    });
  }
}