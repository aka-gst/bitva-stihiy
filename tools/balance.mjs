/**
 * Симулятор баланса. Прогоняет кампанию тысячами боёв разными стратегиями
 * игрока и печатает вероятность победы по ярусам.
 *
 * Смысл: кривая сложности должна убывать от яруса к ярусу, а стратегия,
 * учитывающая приманки, — выигрывать чаще, чем механическая контр-игра.
 *
 *   npm run balance
 */
import { armSuper, canArmSuper, createBattle, resolveRound } from '../src/engine.js';
import { planEnemyRound, signatureAt } from '../src/ai.js';
import { counterTo, ELEMENTS } from '../src/rules.js';
import { makeRng } from '../src/rng.js';
import { CAMPAIGN, healAfterWin, PLAYER_MAX_HP } from '../src/campaign.js';

const STRATEGIES = {
    // Всегда бьёт стихией, которая гасит коронку противника.
    counter: (state) => Array.from({ length: state.slots }, (_, i) => counterTo(signatureAt(state.opponent, state, i))),
    // Контрит коронку, но каждый третий слот подменяет случайным жестом.
    mixed: (state, rng) => Array.from({ length: state.slots }, (_, i) => {
        const c = counterTo(signatureAt(state.opponent, state, i));
        return i % 3 === 2 ? ELEMENTS[Math.floor(rng() * 3) % 3] : c;
    }),
    // Игрок, который понял приманку: чередует прямой ответ на коронку
    // и саму коронку — она гасит приманку и сводит коронку вничью.
    adaptive: (state) => Array.from({ length: state.slots }, (_, i) => {
        const sig = signatureAt(state.opponent, state, i);
        return i % 2 === 0 ? counterTo(sig) : sig;
    }),
    random: (state, rng) => Array.from({ length: state.slots }, () => ELEMENTS[Math.floor(rng() * 3) % 3]),
};

function fight(opponent, strategy, rng, playerHp = PLAYER_MAX_HP, charge = 0) {
    let state = createBattle({ opponent, slots: opponent.slots ?? 5, playerHp, playerMaxHp: PLAYER_MAX_HP, charge });
    let rounds = 0;
    while (!state.outcome && rounds < 40) {
        if (canArmSuper(state)) state = armSuper(state);
        const seq = STRATEGIES[strategy](state, rng);
        const { plan } = planEnemyRound(state, rng);
        state = resolveRound(state, seq, plan).state;
        rounds += 1;
    }
    return { won: state.outcome === 'player', hp: state.hp.player, rounds, charge: state.charge };
}

const RUNS = 3000;
for (const strategy of Object.keys(STRATEGIES)) {
    console.log(`\n=== стратегия: ${strategy} ===`);
    for (const opponent of CAMPAIGN) {
        const rng = makeRng(1234);
        let wins = 0, hpSum = 0, roundSum = 0;
        for (let i = 0; i < RUNS; i += 1) {
            const r = fight(opponent, strategy, rng);
            if (r.won) { wins += 1; hpSum += r.hp; }
            roundSum += r.rounds;
        }
        const rate = wins / RUNS;
        console.log(
            `${opponent.tier.padEnd(7)} ${opponent.name.padEnd(16)}` +
            ` победа ${(rate * 100).toFixed(1).padStart(5)}%` +
            ` · HP при победе ${wins ? (hpSum / wins).toFixed(1) : '—'}` +
            ` · раундов ${(roundSum / RUNS).toFixed(1)}`,
        );
    }
}

// Полное прохождение кампании с переносом здоровья.
console.log('\n=== кампания целиком (перенос HP и заряда) ===');
for (const strategy of Object.keys(STRATEGIES)) {
    const rng = makeRng(777);
    let cleared = 0;
    const fell = Array(CAMPAIGN.length).fill(0);
    for (let i = 0; i < RUNS; i += 1) {
        let hp = PLAYER_MAX_HP, charge = 0, tier = 0;
        for (; tier < CAMPAIGN.length; tier += 1) {
            const r = fight(CAMPAIGN[tier], strategy, rng, hp, charge);
            if (!r.won) { fell[tier] += 1; break; }
            hp = healAfterWin(r.hp);
            charge = r.charge;
        }
        if (tier === CAMPAIGN.length) cleared += 1;
    }
    console.log(`${strategy.padEnd(8)} прохождение ${(cleared / RUNS * 100).toFixed(1).padStart(5)}%` +
        ` · где ломается: ${fell.map((n, i) => `${i + 1}:${(n / RUNS * 100).toFixed(0)}%`).join(' ')}`);
}
