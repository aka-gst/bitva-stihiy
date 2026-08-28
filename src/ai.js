/**
 * Поведение противника. Чистый модуль: получает состояние и генератор
 * случайных чисел, возвращает план на раунд.
 *
 * Противник читает только завершённые раунды — он не подглядывает
 * в последовательность, которую игрок набирает прямо сейчас.
 */

import { ELEMENTS, counterTo, elementForRole } from './rules.js';

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
 * Читает ритм: какую роль игрок привычно ставит в конкретный слот цепочки.
 *
 * Детектор спама смотрит на стихии, а этот — на роли относительно коронки,
 * поэтому он видит узор даже когда коронка меняется от раунда к раунду.
 * Именно так ловится «через слот бью коронку, через слот отвечаю».
 *
 * @returns {Map<number, string>} слот → предсказанная роль
 */
export function detectRhythm(state, opponent) {
    const found = new Map();
    if (!opponent?.readsRhythm) return found;

    const rounds = state.roleRounds ?? [];
    // Двух наблюдений мало: случайная игра совпадёт дважды в половине случаев,
    // и противник начнёт «ловить ритм» там, где его нет.
    const need = Math.max(3, opponent.rhythmRounds ?? 3);
    if (rounds.length < need) return found;

    const threshold = opponent.rhythmThreshold ?? 0.8;
    for (let slot = 0; slot < state.slots; slot += 1) {
        const seen = rounds.map((round) => round[slot]).filter(Boolean);
        if (seen.length < need) continue;

        const counts = seen.reduce((acc, role) => {
            acc[role] = (acc[role] ?? 0) + 1;
            return acc;
        }, {});
        const [role, hits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (hits / seen.length >= threshold) found.set(slot, role);
    }
    return found;
}

/**
 * Заряженный посох видно — противник знает, что суперудар взведён.
 * Неизвестно только, в какой слот он придёт, и это единственное, что мешает
 * ему защититься. Игрок, который бьёт всегда в одно место, лишается и этого.
 *
 * @returns {number|null} слот, который противник будет защищать
 */
export function detectSuperSlot(state, opponent) {
    if (!opponent?.readsSuper || !state.superArmed) return null;

    const history = state.superSlots ?? [];
    const need = opponent.superRounds ?? 2;
    if (history.length < need) return null;

    const counts = history.reduce((acc, slot) => {
        acc[slot] = (acc[slot] ?? 0) + 1;
        return acc;
    }, {});
    const [slot, hits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return hits / history.length >= (opponent.superThreshold ?? 0.6) ? Number(slot) : null;
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
    const counterElement = spam ? counterTo(spam) : null;
    const punishing = detectCounterPlay(state, opponent);
    const rhythm = detectRhythm(state, opponent);
    const baitWeight = baitWeightFor(opponent, state);

    // Наказание за предсказуемость. В каждом наказанном слоте кара одна, но
    // чем большим числом способов игрок читается, тем больше слотов противник
    // на это тратит — отсюда максимум, а не сумма. Позиции случайны:
    // фиксированные слоты игрок бы просто выучил.
    const punishCount = Math.max(
        rhythm.size ? (opponent.rhythmSlots ?? opponent.punishSlots ?? 2) : 0,
        counterElement ? (opponent.counterSlots ?? 2) : 0,
        punishing ? (opponent.punishSlots ?? 2) : 0,
    );
    const punishAt = chooseSlots(punishCount, state.slots, rng);

    // Привычный слот для суперудара закрывается сверх бюджета: пылающий посох
    // противник видит, и не воспользоваться этим было бы странно.
    const defended = detectSuperSlot(state, opponent);
    if (defended !== null && defended < state.slots) punishAt.add(defended);

    const plan = [];
    for (let i = 0; i < state.slots; i += 1) {
        const signature = signatureAt(opponent, state, i);
        if (punishAt.has(i)) {
            // Приоритет самому точному знанию: пойманный ритм бьёт по
            // конкретному предсказанию, спам — по стихии, иначе общая приманка.
            const predicted = rhythm.get(i);
            const element = predicted
                ? counterTo(elementForRole(predicted, signature))
                : counterElement ?? counterTo(counterTo(signature));
            plan.push({ element, signature: element === signature, sig: signature });
            continue;
        }
        if (rng() < chance) {
            plan.push({ element: signature, signature: true, sig: signature });
            continue;
        }
        // Не-коронка: с вероятностью baitWeight это приманка — стихия, которая
        // бьёт очевидный ответ на коронку. Так «всегда контри коронку» перестаёт
        // быть бесплатной стратегией.
        const answer = counterTo(signature);
        const bait = counterTo(answer);
        const element = rng() < baitWeight ? bait : answer;
        plan.push({ element, signature: false, sig: signature });
    }
    return {
        plan,
        signature: signatureFor(opponent, state),
        counteredElement: spam,
        punishing,
        rhythmSlots: [...rhythm.keys()],
        defendedSlot: defended,
    };
}
