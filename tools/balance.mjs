/**
 * Симулятор баланса. Прогоняет кампанию тысячами боёв разными стратегиями
 * игрока и печатает вероятность победы по ярусам.
 *
 * Модель честная: коронка противника на экране не показана, поэтому
 * стратегии выводят её из наблюдений (`state.seen`) — ровно как игрок.
 * Стратегия с точным знанием коронки оставлена как верхняя граница.
 *
 *   npm run balance
 */

import { armSuper, canArmSuper, createBattle, resolveRound } from '../src/engine.js';
import { planEnemyRound, signatureAt } from '../src/ai.js';
import { counterTo, elementForRole, ELEMENTS } from '../src/rules.js';
import { findCombo, overheatOf } from '../src/combos.js';
import { rollFavour } from '../src/favour.js';
import { makeRng } from '../src/rng.js';
import { CAMPAIGN, healAfterWin, PLAYER_MAX_HP } from '../src/campaign.js';

/** Догадка о коронке по общей статистике: чем противник бил чаще всего. */
function guessSignature(state, rng) {
    const seen = state.seen ?? {};
    const total = ELEMENTS.reduce((sum, id) => sum + (seen[id] ?? 0), 0);
    if (total < 3) return ELEMENTS[Math.floor(rng() * 3) % 3];
    return ELEMENTS.reduce((best, id) => ((seen[id] ?? 0) > (seen[best] ?? 0) ? id : best), ELEMENTS[0]);
}

/**
 * Догадка по слоту: что противник чаще ставил в это место в последних раундах.
 * Так внимательный игрок замечает и две маски в одной цепочке, и подмену
 * стихии в ярости. Без данных — откат к общей статистике.
 */
function guessSignatureAt(state, slot, rng) {
    const counts = {};
    for (const round of state.enemyRounds ?? []) {
        const element = round[slot];
        if (element) counts[element] = (counts[element] ?? 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : guessSignature(state, rng);
}

/** Слот, где игрок поставил атакующий ответ, — туда и уходит суперудар. */
function confidentSlot(state, rng, chain) {
    const attacking = [];
    for (let i = 0; i < chain.length; i += 1) {
        const guess = guessSignatureAt(state, i, rng);
        if (chain[i] === counterTo(guess)) attacking.push(i);
    }
    if (!attacking.length) return null;
    return attacking[Math.floor(rng() * attacking.length) % attacking.length];
}

/**
 * Достраивает цепочку до нужного узора, не ломая догадку о коронке там,
 * где это не обязательно. Так играл бы человек, который решил собрать комбо.
 */
function buildCombo(state, rng, shape) {
    const answer = (i) => counterTo(guessSignatureAt(state, i, rng));
    const chain = Array.from({ length: state.slots }, (_, i) => answer(i));
    const a = answer(0);
    if (shape === 'surge') {                       // AAA — три одинаковые
        for (let i = 0; i < 3; i += 1) chain[i] = a;
    } else if (shape === 'pierce') {               // ABA
        chain[0] = a; chain[1] = counterTo(a); chain[2] = a;
    } else if (shape === 'prism') {                // ABC
        chain[0] = a; chain[1] = counterTo(a); chain[2] = counterTo(counterTo(a));
    }
    return chain;
}

const STRATEGIES = {
    // Верхняя граница: игрок каким-то образом знает коронку каждого слота.
    oracle: {
        chain: (st) => Array.from({ length: st.slots }, (_, i) => counterTo(signatureAt(st.opponent, st, i))),
        superSlot: (st, rng) => Math.floor(rng() * st.slots) % st.slots,
    },
    // Реалистичный новичок: одна догадка о коронке на весь раунд,
    // суперудар всегда в первый слот.
    observer: {
        chain: (st, rng) => {
            const guess = guessSignature(st, rng);
            return Array.from({ length: st.slots }, () => counterTo(guess));
        },
        superSlot: () => 0,
    },
    // Внимательный игрок: смотрит на прошлую цепочку по слотам,
    // но отвечает одинаково и бьёт супером всегда в первый слот.
    attentive: {
        chain: (st, rng) => Array.from({ length: st.slots }, (_, i) => counterTo(guessSignatureAt(st, i, rng))),
        superSlot: () => 0,
    },
    // То же наблюдение, но игрок чередует ответ и зеркало, а суперудар
    // ставит на один из своих атакующих ходов — как и сделал бы человек.
    varied: {
        chain: (st, rng) => Array.from({ length: st.slots }, (_, i) =>
            elementForRole(rng() < 0.5 ? 'answer' : 'mirror', guessSignatureAt(st, i, rng))),
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    // Игроки, которые всегда собирают один и тот же узор.
    surge: {
        chain: (st, rng) => buildCombo(st, rng, 'surge'),
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    pierce: {
        chain: (st, rng) => buildCombo(st, rng, 'pierce'),
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    prism: {
        chain: (st, rng) => buildCombo(st, rng, 'prism'),
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    // Собирает разные узоры вперемешку — узор предсказать нельзя.
    mixedCombo: {
        chain: (st, rng) => buildCombo(st, rng, ['surge', 'pierce', 'prism'][Math.floor(rng() * 3) % 3]),
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    // Жадный до силы арены: каждый раунд гонит вал той стихии, что сегодня
    // в силе, и получает вдвое. Проверка на то, что новая механика не стала
    // безотказной кнопкой: три одинаковых подряд — это ровно тот повтор,
    // который ИИ ловит, а четвёртый такой же в пятёрке уже перегрев.
    greedy: {
        chain: (st, rng) => {
            const chain = Array.from({ length: st.slots }, (_, i) =>
                counterTo(guessSignatureAt(st, i, rng)));
            for (let i = 0; i < 3; i += 1) chain[i] = st.favour;
            return chain;
        },
        superSlot: (st, rng, chain) => confidentSlot(st, rng, chain),
    },
    // Полный хаос: никакого вывода о противнике.
    random: {
        chain: (st, rng) => Array.from({ length: st.slots }, () => ELEMENTS[Math.floor(rng() * 3) % 3]),
        superSlot: (st, rng) => Math.floor(rng() * st.slots) % st.slots,
    },
};

function fight(opponent, name, rng, { playerHp = PLAYER_MAX_HP, charge = 0, useSuper = true } = {}) {
    const strategy = STRATEGIES[name];
    let st = createBattle({ opponent, slots: opponent.slots ?? 5, playerHp, playerMaxHp: PLAYER_MAX_HP, charge });
    let rounds = 0;
    let supers = 0;
    let combos = 0;
    let fired = 0;
    let overheats = 0;

    while (!st.outcome && rounds < 40) {
        st = { ...st, favour: rollFavour(rng) };
        const chain = strategy.chain(st, rng);
        if (findCombo(chain)) combos += 1;
        if (overheatOf(chain)) overheats += 1;
        // Заряд тратится до планирования противника: он видит пылающий посох.
        if (useSuper && canArmSuper(st)) {
            const slot = strategy.superSlot(st, rng, chain);
            if (slot !== null) { st = armSuper(st, slot); supers += 1; }
        }
        const out = resolveRound(st, chain, planEnemyRound(st, rng).plan);
        if (out.events.some((e) => e.type === 'combo' && e.fired)) fired += 1;
        st = out.state;
        rounds += 1;
    }
    return { won: st.outcome === 'player', hp: st.hp.player, charge: st.charge, rounds, supers, combos, fired, overheats };
}

const RUNS = 3000;
const pct = (x) => `${(x * 100).toFixed(1).padStart(5)}%`;

for (const name of Object.keys(STRATEGIES)) {
    console.log(`\n=== ${name} ===`);
    for (const opponent of CAMPAIGN) {
        const rng = makeRng(1234);
        let wins = 0, hpSum = 0, roundSum = 0, comboSum = 0, firedSum = 0, hotSum = 0;
        for (let i = 0; i < RUNS; i += 1) {
            const r = fight(opponent, name, rng);
            if (r.won) { wins += 1; hpSum += r.hp; }
            roundSum += r.rounds;
            comboSum += r.combos;
            firedSum += r.fired;
            hotSum += r.overheats;
        }
        console.log(
            `${opponent.tier.padEnd(8)} ${opponent.name.padEnd(16)} победа ${pct(wins / RUNS)}` +
            ` · HP при победе ${wins ? (hpSum / wins).toFixed(1) : '—'}` +
            ` · раундов ${(roundSum / RUNS).toFixed(1)}` +
            ` · узоров ${(comboSum / RUNS).toFixed(1)}` +
            ` · сработало ${comboSum ? pct(firedSum / comboSum) : '—'}` +
            ` · перегревов ${(hotSum / RUNS).toFixed(2)}`,
        );
    }
}

// Насколько суперудар вообще окупается.
console.log('\n=== вклад суперудара (Δ к вероятности победы) ===');
for (const name of Object.keys(STRATEGIES)) {
    const row = CAMPAIGN.map((opponent) => {
        let on = 0, off = 0;
        let rng = makeRng(777);
        for (let i = 0; i < RUNS; i += 1) on += fight(opponent, name, rng, { useSuper: true }).won;
        rng = makeRng(777);
        for (let i = 0; i < RUNS; i += 1) off += fight(opponent, name, rng, { useSuper: false }).won;
        const delta = ((on - off) / RUNS) * 100;
        return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
    });
    console.log(`${name.padEnd(10)} ${row.map((v) => v.padStart(6)).join(' ')}`);
}

console.log('\n=== кампания целиком (перенос HP и заряда) ===');
for (const name of Object.keys(STRATEGIES)) {
    const rng = makeRng(777);
    let cleared = 0;
    const fell = Array(CAMPAIGN.length).fill(0);
    for (let i = 0; i < RUNS; i += 1) {
        let hp = PLAYER_MAX_HP, charge = 0, tier = 0;
        for (; tier < CAMPAIGN.length; tier += 1) {
            const r = fight(CAMPAIGN[tier], name, rng, { playerHp: hp, charge });
            if (!r.won) { fell[tier] += 1; break; }
            hp = healAfterWin(r.hp);
            charge = r.charge;
        }
        if (tier === CAMPAIGN.length) cleared += 1;
    }
    console.log(`${name.padEnd(10)} прохождение ${pct(cleared / RUNS)}` +
        ` · где ломается: ${fell.map((n, i) => `${i + 1}:${(n / RUNS * 100).toFixed(0)}%`).join(' ')}`);
}
