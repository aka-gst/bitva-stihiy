import assert from "node:assert/strict";
import test from "node:test";

import { ELEMENTS, ELEMENT, beats, counterTo, reasonFor, WHEEL } from "../src/rules.js";
import { CHARGE_COST, MAX_STUNS_PER_ROUND, armSuper, createBattle, resolveRound } from "../src/engine.js";

const opponent = (over = {}) => ({ name: "Тест", element: "fire", hp: 10, signatureChance: 0.7, ...over });
const battle = (over = {}) => createBattle({ opponent: opponent(over.opponent), ...over });
const cast = (element, signature = false) => ({ element, signature });
const seq = (element, n = 5) => Array.from({ length: n }, () => element);
const plan = (element, signature = false, n = 5) => Array.from({ length: n }, () => cast(element, signature));
const clashes = (events) => events.filter((e) => e.type === "clash");

test("колесо стихий замкнуто: каждая бьёт ровно одну и битa ровно одной", () => {
    assert.equal(ELEMENTS.length, 3);
    for (const id of ELEMENTS) {
        const prey = ELEMENT[id].beats;
        assert.notEqual(prey, id, `${id} не может бить сам себя`);
        assert.ok(beats(id, prey));
        assert.ok(!beats(prey, id), "отношение не должно быть симметричным");
        assert.equal(counterTo(prey), id);
    }
    assert.equal(WHEEL.length, 3);
    assert.ok(WHEEL.every((step) => step.reason.length > 0), "у каждой пары есть объяснение");
});

test("объяснения соответствуют заявленным правилам", () => {
    assert.equal(reasonFor("water", "fire"), "Вода тушит огонь");
    assert.equal(reasonFor("wind", "water"), "Ветер разгоняет воду");
    assert.equal(reasonFor("fire", "wind"), "Огонь раздувается на ветру");
});

test("одинаковые стихии гасят друг друга без урона", () => {
    const { state, events } = resolveRound(battle(), seq("fire"), plan("fire"));
    assert.deepEqual(state.hp, { player: 10, enemy: 10 });
    assert.ok(clashes(events).every((c) => c.outcome === "draw" && c.damage === 0));
});

test("победа над обычным жестом снимает 1 здоровья", () => {
    const { state } = resolveRound(battle(), seq("water"), plan("fire", false));
    assert.equal(state.hp.enemy, 5);
    assert.equal(state.hp.player, 10);
});

test("проигрыш коронке стоит двойного урона", () => {
    const { state, events } = resolveRound(battle(), seq("fire"), plan("water", true));
    assert.equal(clashes(events)[0].outcome, "crit");
    assert.equal(clashes(events)[0].damage, 2);
    assert.equal(state.hp.player, 0);
    assert.equal(state.outcome, "enemy");
});

test("пробитая коронка даёт заряд и оглушает противника на следующий ход", () => {
    const { state, events } = resolveRound(battle(), seq("water"), plan("fire", true));
    const list = clashes(events);
    assert.equal(list[0].outcome, "win");
    assert.ok(list[0].parry);
    assert.equal(list[1].outcome, "stun");
    assert.equal(list[1].enemy, null, "оглушённый противник не колдует");
    assert.equal(list[1].damage, 1);
    assert.equal(state.charge, CHARGE_COST, "заряд не превышает потолок");
});

test("оглушить противника можно только раз за раунд", () => {
    const enemy = Array(5).fill(null).map(() => cast("fire", true));
    const { state, events } = resolveRound(battle(), seq("water"), enemy);
    const kinds = clashes(events).map((c) => c.outcome);
    assert.deepEqual(kinds, ["win", "stun", "win", "win", "win"],
        "цепочка парирований не должна превращаться в бесконечное оглушение");
    assert.equal(kinds.filter((k) => k === "stun").length, MAX_STUNS_PER_ROUND);
    assert.equal(state.charge, CHARGE_COST, "заряд копится с каждого парирования");
});

test("лимит оглушений обновляется в новом раунде", () => {
    const enemy = Array(5).fill(null).map(() => cast("fire", true));
    const first = resolveRound(battle(), seq("water"), enemy);
    const second = resolveRound({ ...first.state, hp: { player: 10, enemy: 10 } }, seq("water"), enemy);
    assert.ok(clashes(second.events).some((c) => c.outcome === "stun"), "новый раунд — новое оглушение");
});

test("движок считает, как часто игрок пробивает коронку", () => {
    const enemy = [cast("fire", true), cast("water", false), cast("fire", true), cast("wind", false), cast("fire", true)];
    const { state } = resolveRound(battle(), seq("water"), enemy);
    assert.ok(state.sigSeen >= 2, "коронки противника попадают в наблюдения");
    assert.ok(state.sigParried >= 2, "пробитые коронки тоже");
    assert.ok(state.sigParried <= state.sigSeen);
});

test("суперудар тратится на первом столкновении раунда", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST });
    assert.ok(armed.superArmed);
    assert.equal(armed.charge, 0);

    const { state, events } = resolveRound(armed, seq("water"), plan("fire"));
    const first = clashes(events)[0];
    assert.equal(first.outcome, "super-hit");
    assert.equal(first.damage, 2);
    assert.equal(state.superArmed, false, "суперудар не переносится на следующий раунд");
});

test("сорванный суперудар бьёт по игроку", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST });
    const { state, events } = resolveRound(armed, seq("fire"), plan("water"));
    assert.equal(clashes(events)[0].outcome, "super-fail");
    assert.equal(state.hp.player, 10 - 2 - 4, "супер стоит 2, остальные четыре хода — по 1");
});

test("суперудар нельзя взвести без полного заряда", () => {
    const state = battle();
    assert.equal(armSuper(state).superArmed, false);
    assert.equal(armSuper({ ...state, charge: CHARGE_COST - 1 }).superArmed, false);
});

test("раунд обрывается на нокауте", () => {
    const low = { ...battle(), hp: { player: 10, enemy: 2 }, maxHp: { player: 10, enemy: 10 } };
    const { state, events } = resolveRound(low, seq("water"), plan("fire"));
    assert.equal(clashes(events).length, 2, "лишние столкновения не разыгрываются");
    assert.equal(events.at(-2).type, "ko");
    assert.equal(state.outcome, "player");
    assert.equal(state.hp.enemy, 0);
});

test("завершённый бой больше не принимает раунды", () => {
    const done = { ...battle(), outcome: "player" };
    const { state, events } = resolveRound(done, seq("water"), plan("fire"));
    assert.equal(events.length, 0);
    assert.equal(state, done);
});

test("resolveRound не мутирует переданное состояние", () => {
    const before = battle();
    const snapshot = JSON.parse(JSON.stringify(before));
    resolveRound(before, seq("water"), plan("fire", true));
    assert.deepEqual(JSON.parse(JSON.stringify(before)), snapshot);
});

test("история игрока копится и обрезается до десяти ходов", () => {
    let state = battle();
    for (let i = 0; i < 4; i += 1) {
        state = resolveRound(state, seq("water"), plan("wind")).state;
    }
    assert.equal(state.history.length, 10);
    assert.ok(state.history.every((move) => move === "water"));
});

test("счётчик побед растёт только когда урон дошёл до противника", () => {
    const { state } = resolveRound(battle(), ["water", "wind", "water", "wind", "water"], plan("fire"));
    assert.equal(state.wins.water, 3, "вода тушила огонь трижды");
    assert.equal(state.wins.wind, 0, "ветер против огня — проигрыш");
});

test("режим фехтования разыгрывает ровно один обмен", () => {
    const duel = createBattle({ opponent: opponent(), slots: 1 });
    const { events } = resolveRound(duel, ["water"], [cast("fire")]);
    assert.equal(clashes(events).length, 1);
});

test("итог раунда содержит суммарный урон по обеим сторонам", () => {
    const enemy = [cast("fire"), cast("wind"), cast("fire"), cast("wind"), cast("fire")];
    const { events } = resolveRound(battle(), seq("water"), enemy);
    const end = events.at(-1);
    assert.equal(end.type, "round-end");
    assert.deepEqual(end.dealt, { player: 2, enemy: 3 });
});
