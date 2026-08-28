/** Звук и вибрация. Всё необязательное: если браузер не даёт — молча пропускаем. */

let ctx;

function engine() {
    const Engine = window.AudioContext || window.webkitAudioContext;
    if (!Engine) return null;
    ctx ||= new Engine();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
}

export function tone(frequency, duration = 80, { type = 'square', gain = 0.035 } = {}) {
    const audio = engine();
    if (!audio) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration / 1000);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration / 1000);
}

/** Короткий глиссандо — для суперудара и победы. */
export function sweep(from, to, duration = 260) {
    const audio = engine();
    if (!audio) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, audio.currentTime + duration / 1000);
    amp.gain.setValueAtTime(0.03, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration / 1000);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration / 1000);
}

export function haptic(pattern) {
    try { navigator.vibrate?.(pattern); } catch { /* не поддерживается */ }
}

export function wakeAudioOnInteraction() {
    const resume = () => { if (ctx?.state === 'suspended') void ctx.resume().catch(() => {}); };
    ['pointerdown', 'touchstart', 'keydown', 'pageshow'].forEach((type) =>
        window.addEventListener(type, resume, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
}
