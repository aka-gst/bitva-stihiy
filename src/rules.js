/**
 * Стихии и единственный источник правды о том, что кого бьёт.
 *
 * Цикл замкнут и объясним словами — в этом весь смысл перехода
 * с камня-ножниц-бумаги на стихии:
 *
 *   вода тушит огонь  →  огонь раздувается на ветру  →  ветер разгоняет воду
 *
 * Модуль не знает про DOM и не имеет побочных эффектов.
 */

export const ELEMENTS = ['fire', 'water', 'wind'];

export const ELEMENT = {
    fire: {
        id: 'fire',
        glyph: '🔥',
        name: 'Огонь',
        genitive: 'огня',
        accusative: 'огонь',
        beats: 'wind',
        color: '#fb923c',
        glow: '#fdba74',
        tone: 300,
    },
    water: {
        id: 'water',
        glyph: '💧',
        name: 'Вода',
        genitive: 'воды',
        accusative: 'воду',
        beats: 'fire',
        color: '#38bdf8',
        glow: '#7dd3fc',
        tone: 440,
    },
    wind: {
        id: 'wind',
        glyph: '🌪',
        name: 'Ветер',
        genitive: 'ветра',
        accusative: 'ветер',
        beats: 'water',
        color: '#a3e635',
        glow: '#d9f99d',
        tone: 560,
    },
};

/** Почему одна стихия бьёт другую. Ключ — `победитель:проигравший`. */
export const REASONS = {
    'water:fire': 'Вода тушит огонь',
    'fire:wind': 'Огонь раздувается на ветру',
    'wind:water': 'Ветер разгоняет воду',
};

/** Короткий глагол для боевого лога. */
const VERBS = {
    'water:fire': 'тушит',
    'fire:wind': 'пожирает',
    'wind:water': 'разгоняет',
};

export function isElement(id) {
    return Object.prototype.hasOwnProperty.call(ELEMENT, id);
}

/** Бьёт ли стихия `a` стихию `b`. */
export function beats(a, b) {
    return ELEMENT[a]?.beats === b;
}

/** Стихия, которая бьёт `target`. */
export function counterTo(target) {
    return ELEMENTS.find((id) => beats(id, target)) ?? null;
}

/** Стихия, которую бьёт `source` (то, против чего он силён). */
export function preyOf(source) {
    return ELEMENT[source]?.beats ?? null;
}

/** Объяснение исхода: «Вода тушит огонь». */
export function reasonFor(winner, loser) {
    return REASONS[`${winner}:${loser}`] ?? '';
}

/** Строка для лога: «💧 Вода тушит 🔥 огонь». */
export function clashPhrase(winner, loser) {
    const verb = VERBS[`${winner}:${loser}`];
    if (!verb) return '';
    return `${ELEMENT[winner].glyph} ${ELEMENT[winner].name} ${verb} ${ELEMENT[loser].glyph} ${ELEMENT[loser].accusative}`;
}

/**
 * Роль хода относительно коронки слота. Именно в этих терминах противник
 * запоминает привычки игрока: так узор виден даже когда коронка меняется.
 *
 *   answer — стихия, гасящая коронку (очевидный ответ)
 *   mirror — сама коронка (ничья против неё,но сжигает приманку)
 *   third  — третья стихия, ту самую, что коронка бьёт
 */
export function roleOf(move, signature) {
    if (move === signature) return 'mirror';
    if (beats(move, signature)) return 'answer';
    return 'third';
}

/** Обратное преобразование: какую стихию означает роль при данной коронке. */
export function elementForRole(role, signature) {
    if (role === 'mirror') return signature;
    if (role === 'answer') return counterTo(signature);
    return preyOf(signature);
}

/** Колесо для обучающего экрана и постоянной подсказки в бою. */
export const WHEEL = ELEMENTS.map((id) => ({
    winner: id,
    loser: ELEMENT[id].beats,
    reason: reasonFor(id, ELEMENT[id].beats),
}));
