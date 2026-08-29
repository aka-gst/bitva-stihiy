/**
 * Комбо — узоры внутри цепочки.
 *
 * Пять слотов перестают быть пятью независимыми догадками: важна форма
 * всей цепочки. Комбо ищется по трём подряд идущим слотам, за раунд
 * засчитывается одно — самое левое. Так игрок видит, как оно собирается,
 * и никогда не получает его случайно.
 *
 * Узор образует ЛЮБАЯ тройка подряд — все пять возможных форм названы.
 * Раньше их было три, и AAB с ABB не значили ничего: три хода подряд то
 * давали что-то, то нет, и отличить это от случайности было нельзя. Теперь
 * правило одно и без исключений — три подряд всегда складываются во что-то,
 * вопрос только во что.
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
    lash: {
        id: 'lash',
        name: 'ЗАХЛЁСТ',
        shape: 'ABB',
        hint: 'заход другой стихией и два одинаковых следом',
        damage: 2,
        charge: 0,
        // Заход чужой стихией сбивает чтение, но два одинаковых следом
        // противник всё равно поймает — поэтому цена как у вала.
        needs: 3,
        describe: (element) => `${ELEMENT[element].glyph} Захлёст ${ELEMENT[element].genitive}: +2 урона`,
    },
    press: {
        id: 'press',
        name: 'НАЖИМ',
        shape: 'AAB',
        hint: 'два одинаковых и смена',
        damage: 1,
        charge: 1,
        // Давишь одним и уходишь в сторону: слабее вала, но и повтор тут
        // короче — противнику нечего ловить на третьем ходу.
        needs: 2,
        describe: (element) => `${ELEMENT[element].glyph} Нажим ${ELEMENT[element].genitive}: +1 урона и +1 заряда`,
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

/** Какой узор образуют три стихии. Форма есть у любой тройки. */
export function shapeOf(a, b, c) {
    if (a === b && b === c) return COMBOS.surge;   // AAA
    if (a === c && a !== b) return COMBOS.pierce;  // ABA
    if (a === b) return COMBOS.press;              // AAB
    if (b === c) return COMBOS.lash;               // ABB
    return COMBOS.prism;                           // ABC
}

/**
 * Ищет комбо в цепочке игрока.
 * @param {string[]} chain
 * @returns {{combo: object, at: number, slots: number[], element: string}|null}
 */
export function findCombo(chain) {
    // Форма есть у каждой тройки, поэтому в пятёрке совпадают все три окна.
    // Берём самое левое, а не самое сильное: выбирать за игрока сильнейшее
    // значит выбирать самое дорогое — узор с ценой в три победы срывается
    // вчетверо чаще, и игра сама подставляла бы его вместо надёжного. Так
    // узор задают первые три хода, а два последних остаются под чистый
    // размен с противником.
    for (let i = 0; i + COMBO_LENGTH <= chain.length; i += 1) {
        const [a, b, c] = chain.slice(i, i + COMBO_LENGTH);
        if (!a || !b || !c) continue;
        return { combo: shapeOf(a, b, c), at: i, slots: [i, i + 1, i + 2], element: a };
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
