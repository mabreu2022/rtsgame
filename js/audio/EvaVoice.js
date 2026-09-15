export class EvaVoice {
      constructor() {
        this.synth = window.speechSynthesis;
        this.enabled = true;
        this.lastSpokenTimes = {};
      }

      speak(text, minInterval = 0) {
        if (!this.enabled || !this.synth) return;

        const now = performance.now();
        if (minInterval > 0 && this.lastSpokenTimes[text]) {
          if (now - this.lastSpokenTimes[text] < minInterval) return;
        }
        this.lastSpokenTimes[text] = now;

        // Limpa falas anteriores em fila
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.15;
        utterance.lang = 'en-US';

        const voices = this.synth.getVoices();
        const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Victoria')));
        if (femaleVoice) utterance.voice = femaleVoice;

        this.synth.speak(utterance);
      }
    }