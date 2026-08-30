/** Звук и вибрация. Всё необязательное: если браузер не даёт — молча пропускаем. */

let ctx;

/**
 * Немой режим. Нужен двум разным людям: тому, кто снимает карточку для
 * витрины (съёмочный адрес обязан молчать сам, без отдельного тумблера), и
 * тому, у кого игра открыта в соседней вкладке и шумит.
 *
 * Глушим на входе в каждую функцию, а не отключаем узел: звук здесь
 * необязательный, и чем меньше состояния, тем меньше способов забыть его
 * вернуть.
 */
// Читаем адрес осторожно: без этой оговорки модуль падает при импорте вне
// браузера, а модуль, который нельзя импортировать в тестах, — слепое пятно.
let muted = (() => {
    try {
        const q = new URLSearchParams(globalThis.location?.search ?? '');
        return q.has('тихо') || q.has('quiet');
    } catch {
        return false;
    }
})();

export const setMuted = (value) => { muted = Boolean(value); };
export const isMuted = () => muted;

function engine() {
    if (muted) return null;
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
    if (muted) return;
    try { navigator.vibrate?.(pattern); } catch { /* не поддерживается */ }
}

export function wakeAudioOnInteraction() {
    const resume = () => { if (ctx?.state === 'suspended') void ctx.resume().catch(() => {}); };
    ['pointerdown', 'touchstart', 'keydown', 'pageshow'].forEach((type) =>
        window.addEventListener(type, resume, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
}
