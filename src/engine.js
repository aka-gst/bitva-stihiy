/**
 * Движок боя. Ход — это данные, а не изменение DOM.
 *
 * `resolveRound` полностью детерминирована: она получает готовые
 * последовательности обеих сторон и возвращает новое состояние вместе
 * со списком событий. Анимация — это просто проигрывание этого списка.
 */

import { ELEMENTS, beats, clashPhrase } from './rules.js';

export const DEFAULT_HP = 10;
export const DEFAULT_SLOTS = 5;
export const CHARGE_COST = 3;
/** Оглушить противника можно не чаще одного раза за раунд. */
export const MAX_STUNS_PER_ROUND = 1;

/** Урон по умолчанию. Профиль противника может усилить только коронку. */
const HIT = 1;
const SUPER_HIT = 2;

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
        outcome: null,
    };
}

export const isOver = (state) => state.outcome !== null;

export const canArmSuper = (state) =>
    !state.superArmed && state.charge >= CHARGE_COST && !isOver(state);

/** Игрок тратит заряд: следующий ход раунда станет суперударом. */
export function armSuper(state) {
    if (!canArmSuper(state)) return state;
    return { ...state, superArmed: true, charge: 0 };
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
        history: [...state.history, ...playerSeq].slice(-10),
    };

    const events = [{ type: 'round-start', round: state.round, slots: state.slots }];
    const dealt = { player: 0, enemy: 0 };
    next.stunBudget = MAX_STUNS_PER_ROUND;

    for (let index = 0; index < state.slots; index += 1) {
        const player = playerSeq[index];
        const planned = enemySeq[index] ?? { element: ELEMENTS[0], signature: false };
        const clash = resolveClash(next, player, planned, index);

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
    }

    if (next.hp.enemy <= 0) next.outcome = 'player';
    else if (next.hp.player <= 0) next.outcome = 'enemy';

    delete next.stunBudget;

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

    // Суперудар тратится на первом столкновении раунда: риск ради двойного урона.
    if (state.superArmed && index === 0) {
        state.superArmed = false;
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
        return {
            outcome: 'super-fail',
            damage: SUPER_HIT,
            target: 'player',
            parry: false,
            enemyCasts: true,
            phrase: 'Суперудар сорвался и ударил в ответ',
        };
    }

    if (player === planned.element) {
        return {
            outcome: 'draw',
            damage: 0,
            target: null,
            parry: false,
            enemyCasts: true,
            phrase: 'Одинаковые стихии гасят друг друга',
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
