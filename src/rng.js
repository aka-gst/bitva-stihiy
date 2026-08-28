/** Детерминированный генератор — чтобы бой можно было воспроизвести в тестах. */
export function makeRng(seed = 1) {
    let a = seed >>> 0 || 1;
    return function rng() {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Случайный элемент массива. */
export const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];
