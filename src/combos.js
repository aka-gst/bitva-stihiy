/**
 * Комбо — узоры внутри цепочки.
 *
 * Пять слотов перестают быть пятью независимыми догадками: важна форма
 * всей цепочки. Комбо ищется по трём подряд идущим слотам, за раунд
 * засчитывается одно — самое левое. Так игрок видит, как оно собирается,
 * и никогда не получает его случайно.
 *
 * Натяжение задумано такое: мощное комбо требует повторов, а повторы
 * противник читает. Поэтому у каждого комбо есть цена — сколько обменов
 * внутри узора нужно выиграть, чтобы он собрался.
 *
 * Считаются именно победы, а не «не поражения»: иначе цепочка из ничьих
 * давала бы урон, ничего не добившись.
 */

import { ELEMENT } from './rules.js';

export const COMBO_LENGTH = 3;

export const COMBOS = {
    surge: {
        id: 'surge',
        name: 'ВАЛ',
        shape: 'AAA',
        hint: 'три одинаковые подряд',
        damage: 3,
        charge: 0,
        // Требует всех трёх побед и потому срабатывает редко — значит и платить
        // должен соответственно, иначе самый заметный узор оказывается слабейшим.
        needs: 3,
        describe: (element) => `${ELEMENT[element].glyph} Вал ${ELEMENT[element].genitive}: +3 урона`,
    },
    pierce: {
        id: 'pierce',
        name: 'ПРОБОЙ',
        shape: 'ABA',
        hint: 'одинаковые по краям, другая в середине',
        damage: 1,
        charge: 0,
        // Слабее вала, зато проходит сквозь один сорванный обмен.
        needs: 2,
        describe: () => 'Пробой: +1 урона — узор держится и со сбитым обменом',
    },
    prism: {
        id: 'prism',
        name: 'ПРИЗМА',
        shape: 'ABC',
        hint: 'три разные подряд',
        damage: 0,
        charge: 2,
        // Награда за то, что тебя не прочитали, — не требует безупречности.
        needs: 2,
        describe: () => 'Призма: +2 заряда за то, что тебя не прочитали',
    },
};

export const COMBO_LIST = Object.values(COMBOS);

/** Какой узор образуют три стихии. */
export function shapeOf(a, b, c) {
    if (a === b && b === c) return COMBOS.surge;
    if (a === c && a !== b) return COMBOS.pierce;
    if (a !== b && b !== c && a !== c) return COMBOS.prism;
    return null;  // AAB и ABB узором не считаются
}

/**
 * Ищет комбо в цепочке игрока.
 * @param {string[]} chain
 * @returns {{combo: object, at: number, slots: number[], element: string}|null}
 */
export function findCombo(chain) {
    for (let i = 0; i + COMBO_LENGTH <= chain.length; i += 1) {
        const [a, b, c] = chain.slice(i, i + COMBO_LENGTH);
        if (!a || !b || !c) continue;
        const combo = shapeOf(a, b, c);
        if (combo) {
            return { combo, at: i, slots: [i, i + 1, i + 2], element: a };
        }
    }
    return null;
}

/** Комбо, которое соберётся, если продолжить набирать цепочку. Для подсветки. */
export function previewCombo(chain, slots) {
    const filled = chain.filter(Boolean);
    if (filled.length < COMBO_LENGTH) return null;
    return findCombo(chain.slice(0, Math.min(chain.length, slots)));
}
