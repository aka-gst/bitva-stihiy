/**
 * Комбо — узоры внутри цепочки.
 *
 * Всё сводится к одному правилу: **сила узора — это число повторов в нём**.
 * Три одинаковых бьют на 3, две одинаковых на 2, все разные дают 1 и заряд.
 * Цена одна для всех: выиграть 2 обмена из трёх внутри узора.
 *
 * Так было не всегда. Сначала форм было три из пяти возможных, и AAB с ABB
 * не значили ничего — три хода подряд то давали что-то, то нет. Потом форм
 * стало пять, у каждой своя награда и своя цена: правило без исключений, но
 * таблицу из пяти строк приходилось держать в голове, и узоры так и остались
 * непонятны со стороны. Теперь правило одно и выводится само.
 *
 * Натяжение осталось прежним и стало прямее: повторяешься — бьёшь сильнее,
 * но именно повторы противник читает и наказывает, а четвёртый повтор в той
 * же пятёрке уже перегрев. Одна ось, на ней и награда, и риск.
 *
 * Считаются именно победы, а не «не поражения»: иначе цепочка из ничьих
 * давала бы урон, ничего не добившись.
 */

import { ELEMENT } from './rules.js';

export const COMBO_LENGTH = 3;

/** Цена одна для всех узоров: разной её держать не за что. */
export const COMBO_NEEDS = 2;

export const COMBOS = {
    surge: {
        id: 'surge',
        name: 'ВАЛ',
        shape: 'AAA',
        hint: 'три одинаковых',
        repeats: 3,
        damage: 3,
        charge: 0,
        needs: COMBO_NEEDS,
        describe: (element) => `${ELEMENT[element].glyph} Вал ${ELEMENT[element].genitive}: +3 урона`,
    },
    bond: {
        id: 'bond',
        name: 'СВЯЗКА',
        shape: 'две одинаковых',
        hint: 'две одинаковых и одна другая — в любом порядке',
        repeats: 2,
        damage: 2,
        charge: 0,
        needs: COMBO_NEEDS,
        describe: (element) => `${ELEMENT[element].glyph} Связка ${ELEMENT[element].genitive}: +2 урона`,
    },
    prism: {
        id: 'prism',
        name: 'ПРИЗМА',
        shape: 'ABC',
        hint: 'три разные',
        repeats: 0,
        damage: 1,
        charge: 1,
        needs: COMBO_NEEDS,
        describe: () => 'Призма: +1 урона и +1 заряда за то, что тебя не прочитали',
    },
};

export const COMBO_LIST = Object.values(COMBOS);

/**
 * Стихия, которая в тройке повторяется. По ней узор зовётся и по ней же
 * считается сила арены. У призмы повторов нет — значит нет и стихии, и
 * усилить её арена не может: арена усиливает повтор, а призма ровно тем и
 * ценна, что повторов в ней нет.
 */
export function leadOf(a, b, c) {
    if (a === b || a === c) return a;
    if (b === c) return b;
    return null;
}

/** Какой узор образуют три стихии. Форма есть у любой тройки. */
export function shapeOf(a, b, c) {
    if (a === b && b === c) return COMBOS.surge;          // три одинаковых
    if (a === b || b === c || a === c) return COMBOS.bond; // две одинаковых
    return COMBOS.prism;                                   // все разные
}

/**
 * Ищет комбо в цепочке игрока.
 * @param {string[]} chain
 * @returns {{combo: object, at: number, slots: number[], element: string}|null}
 */
export function findCombo(chain) {
    // Форма есть у каждой тройки, поэтому в пятёрке совпадают все три окна.
    // Берём самое левое: узор задают первые три хода, а два последних
    // остаются под чистый размен. Правило простое и, главное, видимое —
    // зона узора обведена прямо на поле.
    for (let i = 0; i + COMBO_LENGTH <= chain.length; i += 1) {
        const [a, b, c] = chain.slice(i, i + COMBO_LENGTH);
        if (!a || !b || !c) continue;
        return { combo: shapeOf(a, b, c), at: i, slots: [i, i + 1, i + 2], element: leadOf(a, b, c) };
    }
    return null;
}

/** Комбо, которое соберётся, если продолжить набирать цепочку. Для подсветки. */
export function previewCombo(chain, slots) {
    const filled = chain.filter(Boolean);
    if (filled.length < COMBO_LENGTH) return null;
    return findCombo(chain.slice(0, Math.min(chain.length, slots)));
}

/**
 * Перегрев: больше трёх одинаковых стихий в цепочке бьют по самому магу.
 *
 * Это граница, а не наказание за повтор вообще. Ровно три одинаковых подряд —
 * это ВАЛ, самый сильный узор в игре. Четвёртая такая же в той же пятёрке
 * превращает его в отдачу. Так у жадности появляется точная цена, а у
 * «поставлю все пять одинаковых» — предел, который виден заранее.
 */
export const OVERHEAT_FROM = 4;

const OVERHEAT_DAMAGE = { 4: 2, 5: 4 };

/**
 * @param {string[]} chain
 * @returns {{element: string, count: number, damage: number}|null}
 */
export function overheatOf(chain) {
    const counts = {};
    for (const move of chain) {
        if (move) counts[move] = (counts[move] ?? 0) + 1;
    }
    const [element, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!element || count < OVERHEAT_FROM) return null;
    return { element, count, damage: OVERHEAT_DAMAGE[count] ?? OVERHEAT_DAMAGE[5] };
}
