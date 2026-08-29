/**
 * Подсказчик боя.
 *
 * Правила игры объясняются в обучении до боя, но там их читают один раз и
 * забывают: «смотри на коронку», «собирай узоры», «трать заряд» — три
 * отдельных совета, и ни один не привязан к тому, что происходит сейчас.
 * Со стороны новичка бой выглядел как выбор наугад из трёх кнопок.
 *
 * Здесь один совет за раз — тот, который прямо сейчас меняет решение. Порядок
 * жёсткий: перегрев (ударит в этом же раунде), потом главный урок про
 * коронку, потом то, чем игрок занят сейчас. Коронка идёт раньше остального
 * нарочно:
 * заряд копится за пару раундов и никуда не девается, а пока не понята
 * коронка, бой остаётся выбором наугад — и супер в нём уходит наугад тоже.
 * Подсказка уходит сама, когда игрок доказал делом, что урок усвоен, —
 * иначе она превращается в шум, который перестают читать.
 */

import { ELEMENT, ELEMENTS, counterTo } from './rules.js';

/** Сколько раз надо пробить коронку, чтобы урок про неё считался пройденным. */
export const SIGNATURE_LEARNED = 2;

/** Со скольких наблюдений перевес одной стихии перестаёт быть случайным. */
const ENOUGH_SEEN = 3;

/** Какая стихия у противника в перевесе и насколько. */
export function leadingElement(seen = {}) {
    const total = ELEMENTS.reduce((sum, id) => sum + (seen[id] ?? 0), 0);
    if (total < ENOUGH_SEEN) return null;
    const top = ELEMENTS.reduce((best, id) => ((seen[id] ?? 0) > (seen[best] ?? 0) ? id : best), ELEMENTS[0]);
    const count = seen[top] ?? 0;
    // Ровно поделённое между тремя стихиями — это не перевес, а шум.
    if (count * 2 <= total) return null;
    return { element: top, count, total };
}

/**
 * Что сказать игроку прямо сейчас.
 *
 * @param {object} state состояние боя из движка
 * @param {object} extra { chargeCost, overheat, combo }
 * @returns {{ text: string, tone: string }|null}
 */
export function coachLine(state, extra = {}) {
    const { chargeCost = 3, overheat = null, combo = null, favoured = false } = extra;

    // Перегрев уже виден в цепочке и ударит в этом же раунде.
    if (overheat) {
        const el = ELEMENT[overheat.element];
        return {
            tone: 'hot',
            text: `${el.glyph} ${overheat.count} раза в одной пятёрке — это перегрев. Ударит по тебе на −${overheat.damage}.`,
        };
    }

    // Главный урок: у противника есть любимая стихия, и её надо найти самому.
    const learned = (state.sigParried ?? 0) >= SIGNATURE_LEARNED;
    if (!learned) {
        const lead = leadingElement(state.seen);
        if (!lead) {
            return {
                tone: 'watch',
                text: 'У каждого противника есть любимая стихия. Смотри на счёт над ареной — чем он бьёт чаще.',
            };
        }
        const counter = counterTo(lead.element);
        return {
            tone: 'read',
            text: `${ELEMENT[lead.element].glyph} ${lead.count} раза из ${lead.total}.`
                + ` Похоже на коронку — гасит её ${ELEMENT[counter].glyph} ${ELEMENT[counter].name}.`,
        };
    }

    // Дальше совет идёт за тем, чем игрок занят прямо сейчас. Узор уже
    // виден в цепочке — говорим про него; цепочка ещё пустая — напоминаем
    // про заряд, потому что решать, куда уйдёт супер, надо до первого хода.
    // Иначе полный заряд, который не тратится сам, забивал бы строку весь
    // бой и вытеснял всё остальное.
    if (combo) {
        // Про силу арены отдельной строкой не говорим — она и так висит над
        // слотами. Здесь важно другое: попал ли в неё собранный узор.
        return {
            tone: favoured ? 'favour' : 'combo',
            text: `Первые три хода складываются в ${combo.name}.`
                + ` Нужно выиграть ${combo.needs} обмена из 3 внутри узора.`
                + (favoured ? ' Арена в силе — заплатит вдвое.' : ''),
        };
    }
    if ((state.charge ?? 0) >= chargeCost && !state.superArmed) {
        return {
            tone: 'super',
            text: 'Заряд полон. СУПЕР бьёт вдвое сильнее в том слоте, который выберешь.',
        };
    }
    return {
        tone: 'combo',
        text: 'Любые три хода подряд складываются в узор. Какой — решают первые три.',
    };
}
