// Vaultlight — audio: everything is synthesised with WebAudio, no audio
// files. A low night drone under the game, a soft tick as a camera sweeps,
// a rising alarm beep, lockpick clicks, and a short arpeggio when the job
// pays off. Created on the first user gesture so browsers allow it.

export function createAudio() {
  let context = null;
  let drone = null;
  let master = null;
  let lastTick = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Night drone: two detuned low sines through a slow tremolo.
      drone = context.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 55;
      const drone2 = context.createOscillator();
      drone2.type = 'sine';
      drone2.frequency.value = 55.7;
      const droneGain = context.createGain();
      droneGain.gain.value = 0.035;
      drone.connect(droneGain);
      drone2.connect(droneGain);
      droneGain.connect(master);
      drone.start();
      drone2.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function blip(frequency, seconds, type = 'sine', volume = 0.12) {
    if (!context) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + seconds);
  }

  return {
    /** Call from any user gesture; starts the drone. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },

    /** Soft tick while a camera sweeps past (throttled). */
    tick(now) {
      if (!context || now - lastTick < 0.45) return;
      lastTick = now;
      blip(1200, 0.03, 'square', 0.02);
    },

    /** Alarm beep; pitch climbs with the alarm meter. */
    alarmBeep(alarm) {
      if (!context) return;
      blip(420 + alarm * 4, 0.09, 'square', 0.05);
    },

    /** Lockpick click. */
    pickClick() {
      blip(1800, 0.04, 'square', 0.06);
    },

    /** A case cracking open. */
    caseCrack() {
      blip(660, 0.12, 'triangle', 0.12);
      blip(990, 0.18, 'triangle', 0.1);
    },

    /** Smoke pellet hiss. */
    smoke() {
      blip(300, 0.4, 'sawtooth', 0.05);
    },

    /** EMP zap. */
    emp() {
      blip(1400, 0.25, 'sawtooth', 0.08);
      blip(700, 0.3, 'sawtooth', 0.06);
    },

    /** The diamond is in hand. */
    diamond() {
      [880, 1108, 1318, 1760].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.22, 'triangle', 0.12), i * 90);
      });
    },

    /** Caught: a low sting. */
    caught() {
      blip(220, 0.5, 'sawtooth', 0.14);
      blip(110, 0.8, 'sawtooth', 0.12);
    },

    /** Escaped: a short getaway arpeggio. */
    escaped() {
      [523, 659, 784, 1046, 1318].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.25, 'triangle', 0.12), i * 110);
      });
    },
  };
}
