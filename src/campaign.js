/**
 * Сюжет: подъём по Башне Трёх Стихий. Пять противников по нарастающей,
 * каждый вводит ровно одну новую идею — иначе правила снова станут кашей.
 *
 * Здоровье переносится между боями, между ярусами возвращается часть.
 * Заряд суперудара тоже переносится: копить его к финалу — валидная тактика.
 */

export const HEAL_AFTER_WIN = 4;
export const PLAYER_MAX_HP = 10;

export const CAMPAIGN = [
    {
        id: 'ember',
        tier: 'ЯРУС I',
        name: 'УГОЛЁК',
        title: 'ученик огня',
        element: 'fire',
        hp: 8,
        slots: 5,
        timer: 20,
        signatureChance: 0.6,
        baitWeight: 0.2,
        readsPatterns: false,
        teaches: 'Найди стихию, которая гасит его коронку.',
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
        punishBaitWeight: 0.72,
        punishSlots: 1,
        readWindow: 8,
        readThreshold: 0.75,
        readsPatterns: true,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 2,
        teaches: 'Один и тот же жест подряд — читается. Русло видит узор и отвечает.',
        intro: 'Вода запоминает форму берега. Повторишься трижды — я подстроюсь.',
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
        punishBaitWeight: 0.8,
        punishSlots: 2,
        readWindow: 5,
        readThreshold: 0.68,
        readsPatterns: true,
        readsRhythm: true,
        rhythmSlots: 3,
        rhythmRounds: 3,
        rhythmThreshold: 0.8,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 1,
        teaches: 'Пробей коронку — противник оглушён и пропускает следующий ход. Но он подмешивает стихию, которая бьёт очевидный ответ.',
        intro: 'Я быстрее. Но каждый, кто ловит меня на моём же ветре, сбивает меня с ног.',
        taunt: 'Не догонишь.',
        defeat: 'Сбит... Ладно. Наверху тебя ждут двое в одном.',
    },
    {
        id: 'twoface',
        tier: 'ЯРУС IV',
        name: 'ДВУЛИКИЙ',
        title: 'носитель двух масок',
        element: 'fire',
        shiftsEachRound: true,
        cycle: ['fire', 'water', 'wind'],
        switchAt: 3,
        hp: 13,
        slots: 5,
        timer: 14,
        signatureChance: 0.74,
        baitWeight: 0.6,
        punishBaitWeight: 0.82,
        punishSlots: 3,
        readWindow: 5,
        readThreshold: 0.6,
        readsPatterns: true,
        readsRhythm: true,
        rhythmSlots: 1,
        rhythmRounds: 2,
        rhythmThreshold: 0.75,
        spamWindow: 5,
        spamThreshold: 0.6,
        counterSlots: 2,
        teaches: 'Он меняет маску посреди цепочки: первые три слота — одна коронка, последние два — другая. Обе показаны над ареной.',
        intro: 'Каждый раунд я другой. И посреди раунда — тоже. Пяти одинаковых жестов тебе не хватит.',
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
        punishBaitWeight: 0.88,
        punishSlots: 1,
        readWindow: 5,
        readThreshold: 0.6,
        readsPatterns: true,
        readsRhythm: true,
        rhythmSlots: 2,
        rhythmRounds: 2,
        rhythmThreshold: 0.7,
        spamWindow: 5,
        spamThreshold: 0.55,
        counterSlots: 2,
        enrageAt: 5,
        enrageElement: 'wind',
        enrageSignatureChance: 0.86,
        enrageBaitWeight: 0.8,
        teaches: 'На пяти здоровья он меняет стихию и бьёт почти без промаха. Прибереги суперудар.',
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
