/**
 * Сюжет: подъём по Башне Трёх Стихий. Пять противников по нарастающей,
 * каждый вводит ровно одну новую идею — иначе правила снова станут кашей.
 *
 * Здоровье переносится между боями, между ярусами возвращается часть.
 * Заряд суперудара тоже переносится: копить его к финалу — валидная тактика.
 */

export const HEAL_AFTER_WIN = 5;
/**
 * Здоровья у игрока больше, чем у противников первых ярусов, и это намеренно.
 * Коронка скрыта, поэтому первый раунд — всегда догадка: пять проигрышей
 * коронке стоят 10 урона, и с десятью очками бой заканчивался бы, не начавшись.
 * Запас даёт пережить слепой заход и получить данные для второго раунда.
 */
export const PLAYER_MAX_HP = 14;

export const CAMPAIGN = [
    {
        id: 'ember',
        tier: 'ЯРУС I',
        name: 'УГОЛЁК',
        title: 'ученик огня',
        element: 'fire',
        hp: 9,
        slots: 5,
        timer: 20,
        signatureChance: 0.72,
        baitWeight: 0.2,
        readsPatterns: false,
        teaches: 'Он почти всегда бьёт одним и тем же. Посмотри, чем именно, и подбери стихию, которая это гасит.',
        reveal: 'Он и правда знал только огонь.',
        intro: 'Я Уголёк. Знаю один трюк — огонь. Но и его хватит, если ты не знаешь, чем его тушить.',
        taunt: 'Гори!',
        defeat: 'Погас... Иди выше, там сыро.',
    },
    {
        id: 'stream',
        tier: 'ЯРУС II',
        name: 'РУСЛО',
        title: 'страж потока',
        element: 'water',
        hp: 10,
        slots: 5,
        timer: 18,
        signatureChance: 0.66,
        baitWeight: 0.55,
        punishBaitWeight: 0.92,
        punishSlots: 3,
        readWindow: 4,
        readThreshold: 0.7,
        readsPatterns: true,
        readsSuper: true,
        superRounds: 3,
        superThreshold: 0.7,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 1,
        teaches: 'Разведка над ареной считает, чем он бьёт. Но и он считает за тобой: один и тот же жест подряд — читается.',
        reveal: 'Его коронкой была вода.',
        intro: 'Я запоминаю форму берега. Повторишься трижды — подстроюсь.',
        taunt: 'Течение сильнее тебя.',
        defeat: 'Разлился... Ты меняешься быстрее, чем я успеваю запомнить.',
    },
    {
        id: 'draft',
        tier: 'ЯРУС III',
        name: 'СКВОЗНЯК',
        title: 'ветреный плут',
        element: 'wind',
        hp: 12,
        slots: 5,
        timer: 16,
        signatureChance: 0.7,
        baitWeight: 0.6,
        punishBaitWeight: 0.92,
        punishSlots: 2,
        readWindow: 4,
        readThreshold: 0.7,
        readsPatterns: true,
        readsSuper: true,
        superRounds: 2,
        superThreshold: 0.6,
        readsRhythm: true,
        breaksCombos: true,
        comboRounds: 3,
        comboThreshold: 0.7,
        rhythmSlots: 3,
        rhythmRounds: 3,
        rhythmThreshold: 0.8,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 1,
        teaches: 'Пробей коронку — раз за раунд противник оглушён и пропускает ход. Но он подмешивает стихию, которая бьёт очевидный ответ.',
        reveal: 'Его коронкой был ветер.',
        intro: 'Я быстрее. Но тот, кто поймает меня на моей же стихии, собьёт меня с ног.',
        taunt: 'Не догонишь.',
        defeat: 'Сбит... Ладно. Наверху тебя ждут двое в одном.',
    },
    {
        id: 'twoface',
        tier: 'ЯРУС IV',
        name: 'ДВУЛИКИЙ',
        title: 'носитель двух масок',
        element: 'fire',
        cycle: ['fire', 'water', 'wind'],
        switchAt: 3,
        hp: 15,
        slots: 5,
        timer: 14,
        signatureChance: 0.74,
        baitWeight: 0.6,
        punishBaitWeight: 0.92,
        punishSlots: 1,
        readWindow: 4,
        readThreshold: 0.7,
        readsPatterns: true,
        readsSuper: true,
        superRounds: 2,
        superThreshold: 0.6,
        readsRhythm: true,
        breaksCombos: true,
        comboRounds: 2,
        comboThreshold: 0.6,
        rhythmSlots: 3,
        rhythmRounds: 3,
        rhythmThreshold: 0.8,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 2,
        teaches: 'Он носит две маски сразу: одну в начале цепочки, другую в конце. Посмотри на прошлый раунд в разведке — переход видно.',
        reveal: 'Первые три слота он бил огнём, последние два — водой.',
        intro: 'Одна маска у меня для начала боя, другая для конца. Пяти одинаковых жестов тебе не хватит.',
        taunt: 'Какая маска на мне сейчас?',
        defeat: 'Обе маски треснули. Выше — тот, кто нас сюда поставил.',
    },
    {
        id: 'abyss',
        tier: 'ЯРУС V',
        name: 'АРХИМАГ БЕЗДНЫ',
        title: 'хозяин башни',
        element: 'fire',
        hp: 15,
        slots: 5,
        timer: 12,
        signatureChance: 0.72,
        baitWeight: 0.7,
        punishBaitWeight: 0.92,
        punishSlots: 3,
        readWindow: 4,
        readThreshold: 0.7,
        readsPatterns: true,
        readsSuper: true,
        superRounds: 2,
        superThreshold: 0.55,
        readsRhythm: true,
        breaksCombos: true,
        comboRounds: 2,
        comboThreshold: 0.55,
        rhythmSlots: 2,
        rhythmRounds: 3,
        rhythmThreshold: 0.8,
        spamWindow: 5,
        spamThreshold: 0.55,
        counterSlots: 2,
        enrageAt: 6,
        enrageElement: 'wind',
        enrageSignatureChance: 0.78,
        enrageBaitWeight: 0.72,
        teaches: 'Пока он силён — у него одна стихия. Когда останется мало здоровья, проверь, та же ли она.',
        reveal: 'Он начинал с огня, а на последних силах уходил в ветер.',
        intro: 'Ты дошёл. Значит, понял правила. Посмотрим, что останется, когда я их сменю на середине.',
        taunt: 'Правила — мои.',
        defeat: 'Башня твоя. Стихии слушают того, кто понял, почему они слушаются.',
    },
];

export const PROLOGUE =
    'Башня Трёх Стихий не пускает наверх тех, кто не понял простого: у каждой стихии есть та, которая её гасит. Пять ярусов — пять способов это забыть.';

export const EPILOGUE =
    'Наверху нет сокровища. Есть только вид на три стихии, которые наконец встали в понятный круг. Этого достаточно.';

export const opponentAt = (index) => CAMPAIGN[index] ?? null;
export const isFinalTier = (index) => index === CAMPAIGN.length - 1;

/** Здоровье, с которым игрок входит в следующий бой. */
export const healAfterWin = (hp) => Math.min(PLAYER_MAX_HP, hp + HEAL_AFTER_WIN);

/** Очки за прохождение: важен и прогресс, и то, сколько здоровья осталось. */
export function campaignScore({ tierIndex, cleared, hp, wins }) {
    const tiers = cleared ? CAMPAIGN.length : tierIndex;
    const gestures = Object.values(wins ?? {}).reduce((a, b) => a + b, 0);
    return tiers * 500 + Math.max(0, hp) * 100 + gestures * 10 + (cleared ? 1000 : 0);
}
