/**
 * Поведение противника. Чистый модуль: получает состояние и генератор
 * случайных чисел, возвращает план на раунд.
 *
 * Противник читает только завершённые раунды — он не подглядывает
 * в последовательность, которую игрок набирает прямо сейчас.
 */

import { ELEMENTS, counterTo } from './rules.js';

/** Порог здоровья и подмена коронки в ярости. */
export function isEnraged(opponent, state) {
    const at = opponent?.enrageAt ?? 0;
    return at > 0 && state.hp.enemy <= at;
}

/** Ведущая коронка раунда с учётом фазы боя. */
export function signatureFor(opponent, state) {
    const base = opponent?.element ?? ELEMENTS[0];
    if (!opponent) return base;

    // Двуликий: коронка сдвигается по кругу каждый раунд.
    if (opponent.shiftsEachRound) {
        const order = opponent.cycle ?? ELEMENTS;
        return order[(state.round - 1) % order.length];
    }
    // В ярости противник может сменить стихию — узор, выученный игроком, ломается.
    if (isEnraged(opponent, state) && opponent.enrageElement) {
        return opponent.enrageElement;
    }
    return base;
}

/**
 * Маски раунда. Противник со `switchAt` меняет коронку посреди цепочки:
 * одинаковых пяти жестов уже не хватит, нужен составной план.
 */
export function masksFor(opponent, state) {
    const lead = signatureFor(opponent, state);
    const switchAt = opponent?.switchAt ?? null;
    if (!switchAt) return { lead, second: null, switchAt: null };
    const order = opponent.cycle ?? ELEMENTS;
    const second = order[(order.indexOf(lead) + 1) % order.length];
    return { lead, second, switchAt };
}

/** Коронка для конкретного слота раунда. */
export function signatureAt(opponent, state, index) {
    const { lead, second, switchAt } = masksFor(opponent, state);
    return second !== null && index >= switchAt ? second : lead;
}

/** Шанс коронки на текущий раунд. */
export function signatureChanceFor(opponent, state) {
    const base = opponent?.signatureChance ?? 0.7;
    if (isEnraged(opponent, state)) {
        return Math.max(base, opponent.enrageSignatureChance ?? base);
    }
    return base;
}

/**
 * Разгадан ли узор игрока: какая стихия доминирует в завершённых раундах.
 * @returns {string|null} стихия, которую противник будет контрить
 */
export function detectSpam(state, opponent) {
    const sample = opponent?.spamWindow ?? 6;
    const threshold = opponent?.spamThreshold ?? 0.6;
    if (!opponent?.readsPatterns) return null;

    const history = state.history.slice(-10);
    if (history.length < sample) return null;

    const counts = history.reduce((acc, move) => {
        acc[move] = (acc[move] ?? 0) + 1;
        return acc;
    }, {});
    const [dominant, hits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    return hits / history.length >= threshold ? dominant : null;
}

/** Случайный набор позиций в раунде — чтобы наказание нельзя было выучить. */
function chooseSlots(count, total, rng) {
    const chosen = new Set();
    const limit = Math.min(count, total);
    let guard = 0;
    while (chosen.size < limit && guard < total * 8) {
        chosen.add(Math.floor(rng() * total) % total);
        guard += 1;
    }
    return chosen;
}

/**
 * Замечает, что игрок методично бьёт по коронке.
 *
 * Это главный сигнал для противника: «всегда контри коронку» — очевидная
 * стратегия, и без ответа на неё бой превращается в метроном.
 * @returns {boolean}
 */
export function detectCounterPlay(state, opponent) {
    if (!opponent?.readsPatterns) return false;
    const sample = opponent.readWindow ?? 5;
    if (state.sigSeen < sample) return false;
    return state.sigParried / state.sigSeen >= (opponent.readThreshold ?? 0.7);
}

/** Доля приманок с учётом того, читает ли игрок коронку. */
export function baitWeightFor(opponent, state) {
    const base = isEnraged(opponent, state)
        ? Math.max(opponent?.baitWeight ?? 0.5, opponent?.enrageBaitWeight ?? 0)
        : opponent?.baitWeight ?? 0.5;
    return detectCounterPlay(state, opponent)
        ? Math.max(base, opponent.punishBaitWeight ?? 0.85)
        : base;
}

/**
 * План противника на раунд.
 * @returns {{plan: {element:string, signature:boolean}[], signature: string,
 *            counteredElement: string|null, punishing: boolean}}
 */
export function planEnemyRound(state, rng) {
    const opponent = state.opponent;
    const chance = signatureChanceFor(opponent, state);
    const spam = detectSpam(state, opponent);
    const counterSlots = spam ? (opponent.counterSlots ?? 2) : 0;
    const counterElement = spam ? counterTo(spam) : null;
    const punishing = detectCounterPlay(state, opponent);
    const baitWeight = baitWeightFor(opponent, state);

    // Наказание за предсказуемость. Однообразный жест бьётся прямым контром,
    // методичная контр-игра — приманкой под ожидаемый ответ. Одно или другое:
    // складывать оба наказания в одном раунде — двойная кара за одну ошибку.
    // Позиции случайны — фиксированные слоты игрок бы просто выучил.
    const punishCount = counterElement ? counterSlots : punishing ? (opponent.punishSlots ?? 2) : 0;
    const punishAt = chooseSlots(punishCount, state.slots, rng);

    const plan = [];
    for (let i = 0; i < state.slots; i += 1) {
        const signature = signatureAt(opponent, state, i);
        if (punishAt.has(i)) {
            const element = counterElement ?? counterTo(counterTo(signature));
            plan.push({ element, signature: element === signature });
            continue;
        }
        if (rng() < chance) {
            plan.push({ element: signature, signature: true });
            continue;
        }
        // Не-коронка: с вероятностью baitWeight это приманка — стихия, которая
        // бьёт очевидный ответ на коронку. Так «всегда контри коронку» перестаёт
        // быть бесплатной стратегией.
        const answer = counterTo(signature);
        const bait = counterTo(answer);
        const element = rng() < baitWeight ? bait : answer;
        plan.push({ element, signature: false });
    }
    return { plan, signature: signatureFor(opponent, state), counteredElement: spam, punishing };
}
