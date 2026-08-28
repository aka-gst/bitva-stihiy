/**
 * Движок боя. Ход — это данные, а не изменение DOM.
 *
 * `resolveRound` полностью детерминирована: она получает готовые
 * последовательности обеих сторон и возвращает новое состояние вместе
 * со списком событий. Анимация — это просто проигрывание этого списка.
 */

import { ELEMENTS, beats, clashPhrase, roleOf } from './rules.js';
import { findCombo } from './combos.js';

export const DEFAULT_HP = 10;
export const DEFAULT_SLOTS = 5;
export const CHARGE_COST = 3;
/** Оглушить противника можно не чаще одного раза за раунд. */
export const MAX_STUNS_PER_ROUND = 1;
/** Сколько последних раундов противник помнит по позициям в цепочке. */
export const RHYTHM_MEMORY = 4;
/** Сколько последних суперударов противник помнит по месту в цепочке. */
export const SUPER_MEMORY = 4;
/** Сколько прошлых цепочек противника игрок держит перед глазами. */
export const ENEMY_MEMORY = 2;

/** Урон по умолчанию. Профиль противника может усилить только коронку. */
const HIT = 1;
/** Удавшийся суперудар бьёт вдвое, проигранный возвращает столько же. */
const SUPER_HIT = 2;
const SUPER_FAIL = 2;

const emptyWins = () => ({ fire: 0, water: 0, wind: 0 });

export function createBattle({
    opponent,
    slots = DEFAULT_SLOTS,
    playerHp = DEFAULT_HP,
    playerMaxHp = DEFAULT_HP,
    charge = 0,
} = {}) {
    const enemyMaxHp = opponent?.hp ?? DEFAULT_HP;
    return {
        opponent: opponent ?? null,
        slots,
        round: 1,
        hp: { player: playerHp, enemy: enemyMaxHp },
        maxHp: { player: playerMaxHp, enemy: enemyMaxHp },
        charge: Math.min(charge, CHARGE_COST),
        superArmed: false,
        stunPending: false,
        history: [],
        wins: emptyWins(),
        // Наблюдения для адаптивного ИИ: сколько коронок противник выбросил
        // и сколько из них игрок пробил. Высокая доля = игрок читает коронку.
        sigSeen: 0,
        sigParried: 0,
        // Роли ходов игрока по позициям в цепочке — сырьё для чтения ритма.
        roleRounds: [],
        // Что противник показал в бою. Коронку игрок вычисляет отсюда сам —
        // движок её не подсказывает.
        seen: emptyWins(),
        // Прошлые цепочки противника: без них смену маски посреди раунда
        // и подмену стихии в ярости вывести не из чего.
        enemyRounds: [],
        // В какие слоты игрок ставил суперудар: противник учится их защищать.
        superSlots: [],
        // Где игрок собирал узоры: противник учится ломать их точечно,
        // а не заливать контр-стихией всю цепочку.
        comboSlots: [],
        superSlot: null,
        outcome: null,
    };
}

export const isOver = (state) => state.outcome !== null;

export const canArmSuper = (state) =>
    !state.superArmed && state.charge >= CHARGE_COST && !isOver(state);

/**
 * Игрок тратит заряд и назначает суперудар на конкретный слот цепочки.
 * Слот выбирает сам игрок — иначе суперудар превращается в один и тот же
 * ритуал на первом обмене, который противнику нечего разгадывать.
 */
export function armSuper(state, slot = 0) {
    if (!canArmSuper(state)) return state;
    if (!Number.isInteger(slot) || slot < 0 || slot >= state.slots) return state;
    return { ...state, superArmed: true, superSlot: slot, charge: 0 };
}

/**
 * Разрешает раунд целиком.
 *
 * @param {object} state      состояние боя
 * @param {string[]} playerSeq        стихии игрока, длиной state.slots
 * @param {{element:string, signature:boolean}[]} enemySeq  план противника
 * @returns {{ state: object, events: object[] }}
 */
export function resolveRound(state, playerSeq, enemySeq) {
    if (isOver(state)) return { state, events: [] };

    const next = {
        ...state,
        hp: { ...state.hp },
        wins: { ...state.wins },
        seen: { ...state.seen },
        history: [...state.history, ...playerSeq].slice(-10),
    };
    const roundRoles = [];
    const enemyShown = [];

    // Комбо известно до раунда: это форма цепочки, которую игрок собрал сам.
    const combo = findCombo(playerSeq);
    let comboWins = 0;
    if (combo) next.comboSlots = [...state.comboSlots, combo.slots].slice(-SUPER_MEMORY);

    const events = [{
        type: 'round-start',
        round: state.round,
        slots: state.slots,
        combo: combo && { id: combo.combo.id, name: combo.combo.name, slots: combo.slots, element: combo.element },
    }];
    const dealt = { player: 0, enemy: 0 };
    next.stunBudget = MAX_STUNS_PER_ROUND;

    for (let index = 0; index < state.slots; index += 1) {
        const player = playerSeq[index];
        const planned = enemySeq[index] ?? { element: ELEMENTS[0], signature: false };
        const superHere = next.superArmed && next.superSlot === index;
        const clash = resolveClash(next, player, planned, index);
        roundRoles[index] = planned.sig ? roleOf(player, planned.sig) : null;
        if (superHere) next.superSlots = [...next.superSlots, index].slice(-SUPER_MEMORY);
        // Игрок видит только то, что противник действительно выбросил.
        enemyShown[index] = clash.enemyCasts ? planned.element : null;
        if (clash.enemyCasts) next.seen[planned.element] += 1;

        if (clash.target) {
            next.hp[clash.target] = Math.max(0, next.hp[clash.target] - clash.damage);
            dealt[clash.target] += clash.damage;
        }
        if (clash.target === 'enemy') next.wins[player] += 1;

        events.push({
            type: 'clash',
            index,
            player,
            enemy: clash.enemyCasts ? planned.element : null,
            enemyPlanned: planned.element,
            enemySignature: planned.signature,
            outcome: clash.outcome,
            damage: clash.damage,
            target: clash.target,
            parry: clash.parry,
            phrase: clash.phrase,
            hp: { ...next.hp },
            charge: next.charge,
            superArmed: next.superArmed,
            stunNext: next.stunPending,
        });

        if (next.hp.player <= 0 || next.hp.enemy <= 0) break;

        // Комбо считается собранным, если игрок не потерял внутри него
        // больше обменов, чем этот узор переживает.
        if (combo && combo.slots.includes(index)) {
            if (clash.target === 'enemy') comboWins += 1;
            if (index === combo.slots.at(-1)) {
                const fired = comboWins >= combo.combo.needs;
                if (fired && combo.combo.damage) {
                    next.hp.enemy = Math.max(0, next.hp.enemy - combo.combo.damage);
                    dealt.enemy += combo.combo.damage;
                }
                if (fired && combo.combo.charge) {
                    next.charge = Math.min(CHARGE_COST, next.charge + combo.combo.charge);
                }
                events.push({
                    type: 'combo',
                    id: combo.combo.id,
                    name: combo.combo.name,
                    element: combo.element,
                    slots: combo.slots,
                    fired,
                    wins: comboWins,
                    needs: combo.combo.needs,
                    damage: fired ? combo.combo.damage : 0,
                    charge: fired ? combo.combo.charge : 0,
                    phrase: fired
                        ? combo.combo.describe(combo.element)
                        : `${combo.combo.name} рассыпался: нужно ${combo.combo.needs} победы внутри узора, было ${comboWins}`,
                    hp: { ...next.hp },
                });
                if (next.hp.enemy <= 0) break;
            }
        }
    }

    if (next.hp.enemy <= 0) next.outcome = 'player';
    else if (next.hp.player <= 0) next.outcome = 'enemy';

    delete next.stunBudget;
    if (enemyShown.some(Boolean)) {
        next.enemyRounds = [...state.enemyRounds, enemyShown].slice(-ENEMY_MEMORY);
    }
    if (roundRoles.some(Boolean)) {
        next.roleRounds = [...state.roleRounds, roundRoles].slice(-RHYTHM_MEMORY);
    }

    if (next.outcome) {
        events.push({ type: 'ko', winner: next.outcome, hp: { ...next.hp } });
    } else {
        next.round += 1;
    }

    events.push({ type: 'round-end', round: state.round, dealt: { ...dealt } });
    return { state: next, events };
}

/**
 * Одно столкновение. Мутирует служебные поля состояния (заряд, стан,
 * взведённый супер) и сообщает, кому и сколько прилетело.
 */
function resolveClash(state, player, planned, index) {
    if (planned.signature && !state.stunPending) state.sigSeen += 1;

    // Противник оглушён предыдущим парированием — заклинание проходит без ответа.
    if (state.stunPending) {
        state.stunPending = false;
        return {
            outcome: 'stun',
            damage: HIT,
            target: 'enemy',
            parry: false,
            enemyCasts: false,
            phrase: 'Противник оглушён — заклинание проходит без ответа',
        };
    }

    // Суперудар тратится на выбранном игроком слоте: риск ради двойного урона.
    if (state.superArmed && index === state.superSlot) {
        state.superArmed = false;
        state.superSlot = null;
        if (beats(player, planned.element)) {
            return {
                outcome: 'super-hit',
                damage: SUPER_HIT,
                target: 'enemy',
                parry: false,
                enemyCasts: true,
                phrase: `Суперудар! ${clashPhrase(player, planned.element)}`,
            };
        }
        // Одинаковые стихии гасят друг друга и в усиленном виде: заряд сгорел,
        // но бить самого себя за верную догадку было бы странно.
        if (player === planned.element) {
            return {
                outcome: 'super-fizzle',
                damage: 0,
                target: null,
                parry: false,
                enemyCasts: true,
                phrase: 'Суперудар налетел на такую же стихию — обе погасли',
            };
        }
        return {
            outcome: 'super-fail',
            damage: SUPER_FAIL,
            target: 'player',
            parry: false,
            enemyCasts: true,
            phrase: 'Суперудар не прошёл и ударил в ответ',
        };
    }

    if (player === planned.element) {
        // Угадать стихию противника в точности — тоже чтение, и оно должно
        // окупаться: иначе безопасный зеркальный ход остаётся чистой потерей темпа.
        const charged = state.charge < CHARGE_COST;
        if (charged) state.charge += 1;
        return {
            outcome: 'draw',
            damage: 0,
            target: null,
            parry: false,
            enemyCasts: true,
            phrase: charged
                ? 'Одинаковые стихии гасят друг друга — удар в удар, +заряд'
                : 'Одинаковые стихии гасят друг друга',
        };
    }

    if (beats(player, planned.element)) {
        const parry = planned.signature;
        let stunned = false;
        if (parry) {
            state.charge = Math.min(CHARGE_COST, state.charge + 1);
            state.sigParried += 1;
            // Оглушение — ресурс раунда, а не бесконечная цепочка.
            if (state.stunBudget > 0) {
                state.stunBudget -= 1;
                state.stunPending = true;
                stunned = true;
            }
        }
        return {
            outcome: 'win',
            damage: HIT,
            target: 'enemy',
            parry,
            enemyCasts: true,
            phrase: stunned
                ? `${clashPhrase(player, planned.element)} — коронка пробита, противник оглушён`
                : parry
                    ? `${clashPhrase(player, planned.element)} — коронка пробита, +заряд`
                    : clashPhrase(player, planned.element),
        };
    }

    const crit = planned.signature;
    return {
        outcome: crit ? 'crit' : 'lose',
        damage: crit ? 2 : HIT,
        target: 'player',
        parry: false,
        enemyCasts: true,
        phrase: crit
            ? `Коронка противника: ${clashPhrase(planned.element, player)} — двойной урон`
            : clashPhrase(planned.element, player),
    };
}

/** Сводка по раунду для режимов со скрытым логом. */
export function summarize(events) {
    const end = events.find((e) => e.type === 'round-end');
    return end ? end.dealt : { player: 0, enemy: 0 };
}
