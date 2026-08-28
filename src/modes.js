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
export const SPARRING = {
    fire: { id: 'spar-fire', name: 'ПИРОМАНТ', title: 'мастер огня', element: 'fire', hp: 10, signatureChance: 0.7, readsPatterns: true, counterSlots: 3 },
    water: { id: 'spar-water', name: 'ГИДРОМАНТ', title: 'мастер воды', element: 'water', hp: 10, signatureChance: 0.7, readsPatterns: true, counterSlots: 3 },
    wind: { id: 'spar-wind', name: 'АЭРОМАНТ', title: 'мастер ветра', element: 'wind', hp: 10, signatureChance: 0.7, readsPatterns: true, counterSlots: 3 },
};
