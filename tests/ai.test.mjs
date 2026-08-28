import assert from "node:assert/strict";
import test from "node:test";

import { baitWeightFor, detectCounterPlay, detectRhythm, detectSpam, isEnraged, masksFor, planEnemyRound, signatureAt, signatureChanceFor, signatureFor } from "../src/ai.js";
import { createBattle, resolveRound } from "../src/engine.js";
import { makeRng } from "../src/rng.js";
import { CAMPAIGN } from "../src/campaign.js";
import { beats, counterTo, elementForRole, roleOf } from "../src/rules.js";

const withHistory = (state, moves) => ({ ...state, history: moves });
const reader = (over = {}) => ({
    name: "Читатель", element: "water", hp: 10, signatureChance: 0.7,
    readsPatterns: true, spamWindow: 6, spamThreshold: 0.6, counterSlots: 3, ...over,
});

test("план всегда заполняет ровно столько слотов, сколько в раунде", () => {
    const rng = makeRng(7);
    for (const slots of [1, 3, 5]) {
        const state = createBattle({ opponent: reader(), slots });
        const { plan } = planEnemyRound(state, rng);
        assert.equal(plan.length, slots);
        assert.ok(plan.every((cast) => typeof cast.element === "string"));
    }
});

test("флаг коронки в плане совпадает с текущей коронкой противника", () => {
    const state = createBattle({ opponent: reader({ element: "wind" }) });
    const { plan } = planEnemyRound(state, makeRng(3));
    for (const cast of plan) {
        assert.equal(cast.signature, cast.element === "wind");
    }
});

test("коронка выпадает примерно с заявленной частотой", () => {
    const state = createBattle({ opponent: reader({ element: "fire", signatureChance: 0.7 }) });
    const rng = makeRng(2024);
    let signature = 0;
    let total = 0;
    for (let i = 0; i < 400; i += 1) {
        for (const cast of planEnemyRound(state, rng).plan) {
            total += 1;
            if (cast.element === "fire") signature += 1;
        }
    }
    const share = signature / total;
    assert.ok(share > 0.62 && share < 0.78, `доля коронки ${share.toFixed(2)} вне ожидаемого коридора`);
});

test("противник без чтения узоров не контрит спам", () => {
    const state = withHistory(createBattle({ opponent: reader({ readsPatterns: false }) }), Array(10).fill("fire"));
    assert.equal(detectSpam(state, state.opponent), null);
});

test("спам распознаётся только на достаточной истории", () => {
    const opponent = reader();
    const short = withHistory(createBattle({ opponent }), ["fire", "fire", "fire"]);
    assert.equal(detectSpam(short, opponent), null);

    const long = withHistory(createBattle({ opponent }), Array(8).fill("fire"));
    assert.equal(detectSpam(long, opponent), "fire");
});

test("разнообразная игра не читается как узор", () => {
    const opponent = reader();
    const mixed = withHistory(createBattle({ opponent }), ["fire", "water", "wind", "fire", "water", "wind"]);
    assert.equal(detectSpam(mixed, opponent), null);
});

test("на спам противник ставит контр-стихию в первые слоты", () => {
    const opponent = reader({ counterSlots: 3 });
    const state = withHistory(createBattle({ opponent }), Array(8).fill("fire"));
    const { plan, counteredElement } = planEnemyRound(state, makeRng(11));
    assert.equal(counteredElement, "fire");
    for (let i = 0; i < 3; i += 1) {
        assert.ok(beats(plan[i].element, "fire"), `слот ${i} должен бить огонь`);
    }
});

test("противник видит только завершённые раунды, а не набираемый сейчас", () => {
    const opponent = reader();
    const state = createBattle({ opponent });
    assert.deepEqual(state.history, []);
    assert.equal(detectSpam(state, opponent), null, "до первого раунда истории нет");

    const after = resolveRound(state, Array(5).fill("fire"), Array(5).fill({ element: "water", signature: true })).state;
    assert.equal(after.history.length, 5, "история пополняется только по итогам раунда");
});

test("двуликий держит маску весь бой — иначе наблюдение вводит в заблуждение", () => {
    const twoface = CAMPAIGN.find((o) => o.id === "twoface");
    const state = createBattle({ opponent: twoface });
    const seen = [1, 2, 3, 4].map((round) => signatureFor(twoface, { ...state, round }));
    assert.deepEqual(seen, ["fire", "fire", "fire", "fire"]);
});

test("архимаг в ярости меняет стихию и почти не промахивается", () => {
    const boss = CAMPAIGN.find((o) => o.id === "abyss");
    const calm = createBattle({ opponent: boss });
    const hurt = { ...calm, hp: { player: 10, enemy: boss.enrageAt } };

    assert.equal(isEnraged(boss, calm), false);
    assert.equal(signatureFor(boss, calm), "fire");

    assert.equal(isEnraged(boss, hurt), true);
    assert.equal(signatureFor(boss, hurt), "wind");
    assert.ok(signatureChanceFor(boss, hurt) > signatureChanceFor(boss, calm));
});

test("одинаковое зерно даёт одинаковый бой", () => {
    const run = () => {
        const state = createBattle({ opponent: reader() });
        return planEnemyRound(state, makeRng(99)).plan.map((c) => c.element).join("");
    };
    assert.equal(run(), run());
});

test("приманка бьёт очевидный ответ на коронку", () => {
    // baitWeight 1: каждая не-коронка — приманка под ожидаемый контр-жест.
    const opponent = reader({ element: "fire", signatureChance: 0, baitWeight: 1, readsPatterns: false });
    const state = createBattle({ opponent });
    const answer = counterTo("fire");
    const { plan } = planEnemyRound(state, makeRng(5));
    for (const cast of plan) {
        assert.ok(beats(cast.element, answer), "приманка должна гасить ожидаемый ответ игрока");
    }
});

test("без приманок противник ставит сам ожидаемый ответ", () => {
    const opponent = reader({ element: "fire", signatureChance: 0, baitWeight: 0, readsPatterns: false });
    const { plan } = planEnemyRound(createBattle({ opponent }), makeRng(5));
    assert.ok(plan.every((cast) => cast.element === counterTo("fire")));
});

test("методичная игра по коронке замечается и наказывается приманками", () => {
    const opponent = reader({ readWindow: 5, readThreshold: 0.7, baitWeight: 0.3, punishBaitWeight: 0.9 });
    const naive = { ...createBattle({ opponent }), sigSeen: 10, sigParried: 2 };
    const sharp = { ...createBattle({ opponent }), sigSeen: 10, sigParried: 9 };

    assert.equal(detectCounterPlay(naive, opponent), false);
    assert.equal(detectCounterPlay(sharp, opponent), true);
    assert.ok(baitWeightFor(opponent, sharp) > baitWeightFor(opponent, naive));
    assert.equal(planEnemyRound(sharp, makeRng(1)).punishing, true);
});

test("наблюдений мало — противник не делает выводов", () => {
    const opponent = reader({ readWindow: 6 });
    const early = { ...createBattle({ opponent }), sigSeen: 3, sigParried: 3 };
    assert.equal(detectCounterPlay(early, opponent), false);
});

test("бюджет наказания равен максимуму сигналов, а не их сумме", () => {
    // Коронка отключена (signatureChance 0), все ненаказанные слоты — приманка «огонь»,
    // а прямой контр против спама водой — «ветер». Так их можно пересчитать по отдельности.
    const opponent = reader({
        element: "water", signatureChance: 0, baitWeight: 1,
        counterSlots: 2, punishSlots: 3, spamWindow: 4, spamThreshold: 0.6,
        readWindow: 4, readThreshold: 0.6,
    });
    const state = {
        ...createBattle({ opponent }),
        history: Array(8).fill("water"),
        sigSeen: 10,
        sigParried: 10,
    };
    const { plan, counteredElement, punishing } = planEnemyRound(state, makeRng(9));
    assert.equal(counteredElement, "water");
    assert.equal(punishing, true);

    const punished = plan.filter((cast) => cast.element === "wind").length;
    assert.equal(punished, 3, "оба сигнала сработали — бюджет равен большему из них");
    assert.notEqual(punished, opponent.counterSlots + opponent.punishSlots,
        "наказания не складываются");
    assert.equal(plan.filter((cast) => cast.element === "fire").length, 2,
        "остальные слоты живут обычной жизнью");
});

test("двуликий меняет маску посреди раунда, и обе маски определены", () => {
    const twoface = CAMPAIGN.find((o) => o.id === "twoface");
    const state = createBattle({ opponent: twoface });
    const { lead, second, switchAt } = masksFor(twoface, state);
    assert.equal(switchAt, twoface.switchAt);
    assert.notEqual(lead, second);
    assert.equal(signatureAt(twoface, state, switchAt - 1), lead);
    assert.equal(signatureAt(twoface, state, switchAt), second);
});

test("у обычного противника вторая маска отсутствует", () => {
    const opponent = reader();
    const { second, switchAt } = masksFor(opponent, createBattle({ opponent }));
    assert.equal(second, null);
    assert.equal(switchAt, null);
});

test("коронка первого яруса не зависит от того, как играет игрок", () => {
    const ember = CAMPAIGN.find((o) => o.id === "ember");
    const state = { ...createBattle({ opponent: ember }), sigSeen: 20, sigParried: 20, history: Array(10).fill("water") };
    assert.equal(detectCounterPlay(state, ember), false, "обучающий противник не наказывает");
    assert.equal(detectSpam(state, ember), null);
});

const rhythmReader = (over = {}) => reader({
    readsRhythm: true, rhythmRounds: 3, rhythmThreshold: 0.8, rhythmSlots: 2, ...over,
});
const repeat = (roles, times) => Array.from({ length: times }, () => [...roles]);

test("ритм не читается, пока противник не умеет и пока мало наблюдений", () => {
    const rounds = repeat(["answer", "mirror", "answer", "mirror", "answer"], 3);

    const deaf = { ...createBattle({ opponent: reader() }), roleRounds: rounds };
    assert.equal(detectRhythm(deaf, deaf.opponent).size, 0, "обычный противник ритм не слышит");

    const opponent = rhythmReader();
    for (const known of [1, 2]) {
        const early = { ...createBattle({ opponent }), roleRounds: rounds.slice(0, known) };
        assert.equal(detectRhythm(early, opponent).size, 0,
            `${known} наблюдений мало: случайная игра совпала бы по случайности`);
    }
});

test("устойчивая привычка по слотам распознаётся как ритм", () => {
    const opponent = rhythmReader();
    const state = {
        ...createBattle({ opponent }),
        roleRounds: repeat(["answer", "mirror", "answer", "mirror", "answer"], 3),
    };
    const rhythm = detectRhythm(state, opponent);
    assert.equal(rhythm.size, 5);
    assert.equal(rhythm.get(0), "answer");
    assert.equal(rhythm.get(1), "mirror");
});

test("разнобой в слоте ритмом не считается", () => {
    const opponent = rhythmReader({ rhythmThreshold: 0.75 });
    const state = {
        ...createBattle({ opponent }),
        roleRounds: [
            ["answer", "mirror", "answer", "third", "answer"],
            ["mirror", "third", "answer", "answer", "mirror"],
            ["third", "answer", "answer", "mirror", "third"],
            ["answer", "mirror", "answer", "third", "answer"],
        ],
    };
    const rhythm = detectRhythm(state, opponent);
    assert.equal(rhythm.get(2), "answer", "слот 2 стабилен — он и ловится");
    assert.equal(rhythm.has(0), false, "слот 0 меняется — ловить нечего");
    assert.equal(rhythm.has(1), false);
});

test("пойманный ритм превращается в точный контр-жест", () => {
    const opponent = rhythmReader({ element: "fire", signatureChance: 0, rhythmSlots: 5 });
    const state = {
        ...createBattle({ opponent }),
        roleRounds: repeat(Array(5).fill("mirror"), 3),
    };
    const { plan, rhythmSlots } = planEnemyRound(state, makeRng(4));
    assert.equal(rhythmSlots.length, 5);
    // Игрок привык зеркалить коронку — противник ставит то, что бьёт саму коронку.
    const expected = counterTo(elementForRole("mirror", "fire"));
    assert.ok(plan.every((cast) => cast.element === expected), "все наказанные слоты бьют предсказанный ход");
});

test("план сообщает коронку слота, иначе движку не из чего считать роли", () => {
    const opponent = rhythmReader();
    const { plan } = planEnemyRound(createBattle({ opponent }), makeRng(6));
    for (const cast of plan) {
        assert.ok(cast.sig, "у каждого хода противника указана коронка слота");
        assert.equal(cast.signature, cast.element === cast.sig);
    }
});

test("бюджет наказания — максимум по сработавшим сигналам, а не сумма", () => {
    const opponent = rhythmReader({ counterSlots: 3, punishSlots: 1, rhythmSlots: 1, spamWindow: 4, readWindow: 4 });
    const state = {
        ...createBattle({ opponent }),
        history: Array(8).fill("water"),
        sigSeen: 10,
        sigParried: 10,
        roleRounds: repeat(Array(5).fill("answer"), 3),
    };
    const { plan } = planEnemyRound(state, makeRng(12));
    assert.equal(plan.length, 5);
    // 3 + 1 + 1 = 5 слотов было бы «все»; максимум даёт 3 — остальные слоты живут обычной жизнью.
    assert.ok(plan.some((cast) => cast.signature), "не весь раунд уходит на наказание");
});
