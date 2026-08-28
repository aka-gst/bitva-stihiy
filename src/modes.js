/** Режимы свободного боя. Сюжет использует собственные настройки из campaign.js. */

export const MODES = {
    easy: {
        id: 'easy',
        name: 'ЛЁГКИЙ',
        note: '5 слотов · полный лог · подсказка',
        slots: 5,
        timer: 18,
        reveal: 'step',
        log: 'full',
        showWheel: true,
    },
    medium: {
        id: 'medium',
        name: 'СРЕДНИЙ',
        note: '5 слотов · урон скрыт',
        slots: 5,
        timer: 15,
        reveal: 'step',
        log: 'muted',
        showWheel: true,
    },
    hard: {
        id: 'hard',
        name: 'СЛОЖНЫЙ',
        note: '5 слотов · мгновенно · только итог',
        slots: 5,
        timer: 12,
        reveal: 'instant',
        log: 'summary',
        showWheel: false,
    },
    duel: {
        id: 'duel',
        name: 'ФЕХТОВАНИЕ',
        note: '1 слот · один обмен за раз',
        slots: 1,
        timer: 10,
        reveal: 'step',
        log: 'full',
        showWheel: true,
    },
};

export const STORY_MODE = {
    id: 'story',
    name: 'СЮЖЕТ',
    note: 'пять ярусов башни',
    reveal: 'step',
    log: 'full',
    showWheel: true,
};

export const MODE_ORDER = ['easy', 'medium', 'hard', 'duel'];

/** Свободный бой: случайный противник среднего уровня. */
/**
 * Спарринг-партнёры. Имена намеренно нейтральные: коронку игрок вычисляет
 * по бою, а не читает с таблички.
 */
const sparring = (id, name, element) => ({
    id: `spar-${element}`,
    name,
    title: 'странствующий маг',
    element,
    hp: 13,
    signatureChance: 0.7,
    baitWeight: 0.6,
    readsPatterns: true,
    readsSuper: true,
    superRounds: 2,
    superThreshold: 0.6,
    counterSlots: 2,
    punishSlots: 2,
    reveal: 'Его коронку ты уже видел в бою.',
});

export const SPARRING = {
    fire: sparring('spar-fire', 'БАГРОВЫЙ', 'fire'),
    water: sparring('spar-water', 'ГЛУБИННЫЙ', 'water'),
    wind: sparring('spar-wind', 'НЕСОМЫЙ', 'wind'),
};
