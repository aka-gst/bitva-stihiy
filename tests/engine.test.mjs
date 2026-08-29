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

// Пять одинаковых теперь перегревают цепочку, поэтому в проверках, где
// перегрев ни при чём, берём не больше трёх одинаковых.
const cool = (a, b) => [a, a, a, b, b];

test("одинаковые стихии гасят друг друга без урона", () => {
    const chain = cool("fire", "water");
    const enemy = chain.map((element) => cast(element));
    const { state, events } = resolveRound(battle(), chain, enemy);
    assert.deepEqual(state.hp, { player: 10, enemy: 10 });
    assert.ok(clashes(events).every((c) => c.outcome === "draw" && c.damage === 0));
});

test("победа над обычным жестом снимает 1 здоровья", () => {
    // Узор образует любая тройка подряд, поэтому «чистого» размена без
    // бонуса в пятёрке уже не бывает: проверяем цену самого обмена, а
    // добавку узора считаем отдельно и явно.
    const chain = ["water", "water", "wind", "wind", "water"];
    const enemy = [cast("fire"), cast("fire"), cast("water"), cast("water"), cast("fire")];
    const { state, events } = resolveRound(battle(), chain, enemy);
    assert.ok(clashes(events).every((c) => c.damage === 1), "каждая победа стоит ровно 1");
    const combo = events.find((e) => e.type === "combo");
    assert.equal(combo.name, "НАЖИМ", "первая тройка — два одинаковых и смена");
    assert.equal(state.hp.enemy, 10 - 5 - combo.damage);
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

test("суперудар тратится на назначенном слоте раунда", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST });
    assert.ok(armed.superArmed);
    assert.equal(armed.charge, 0);

    const { state, events } = resolveRound(armed, seq("water"), plan("fire"));
    const first = clashes(events)[0];
    assert.equal(first.outcome, "super-hit");
    assert.equal(first.damage, 2, "удавшийся суперудар бьёт вдвое");
    assert.equal(state.superArmed, false, "суперудар не переносится на следующий раунд");
});

test("сорванный суперудар бьёт по игроку", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST });
    const { state, events } = resolveRound(armed, cool("fire", "water"), plan("water"));
    assert.equal(clashes(events)[0].outcome, "super-fail");
    // Супер −2, два проигранных огня по −1, две ничьи водой.
    assert.equal(state.hp.player, 10 - 2 - 2);
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
    const chain = ["water", "water", "wind", "wind", "water"];
    const enemy = [cast("fire"), cast("fire"), cast("water"), cast("fire"), cast("wind")];
    const { events } = resolveRound(battle(), chain, enemy);
    const end = events.at(-1);
    assert.equal(end.type, "round-end");
    // В сумму входит и добавка узора: первая тройка тут складывается в нажим.
    const combo = events.find((e) => e.type === "combo" && e.fired);
    assert.deepEqual(end.dealt, { player: 2, enemy: 3 + combo.damage });
});

test("суперудар бьёт в слот, который выбрал игрок", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST }, 3);
    assert.equal(armed.superSlot, 3);
    const { events } = resolveRound(armed, seq("water"), plan("fire"));
    const list = clashes(events);
    assert.notEqual(list[0].outcome, "super-hit", "первый обмен больше не назначается сам собой");
    assert.equal(list[3].outcome, "super-hit");
    assert.equal(list[3].damage, 2);
});

test("слот суперудара обязан существовать", () => {
    const ready = { ...battle(), charge: CHARGE_COST };
    assert.equal(armSuper(ready, -1).superArmed, false);
    assert.equal(armSuper(ready, ready.slots).superArmed, false);
    assert.equal(armSuper(ready, 1.5).superArmed, false);
});

test("точное совпадение стихий копит заряд", () => {
    const { state, events } = resolveRound(battle(), seq("fire"), plan("fire"));
    assert.ok(clashes(events).every((c) => c.outcome === "draw" && c.damage === 0));
    assert.equal(state.charge, CHARGE_COST, "заряд растёт, но не выше потолка");
});

test("движок запоминает, чем противник бил на глазах у игрока", () => {
    const enemy = [cast("fire"), cast("fire"), cast("water"), cast("wind"), cast("fire")];
    const { state } = resolveRound(battle(), seq("water"), enemy);
    assert.equal(state.seen.fire, 3);
    assert.equal(state.seen.water, 1);
    assert.equal(state.seen.wind, 1);
    assert.deepEqual(state.enemyRounds.at(-1), ["fire", "fire", "water", "wind", "fire"]);
});

test("оглушённый противник не попадает в наблюдения — игрок его хода не видел", () => {
    const enemy = Array(5).fill(null).map(() => cast("fire", true));
    const { state } = resolveRound(battle(), seq("water"), enemy);
    const total = state.seen.fire + state.seen.water + state.seen.wind;
    assert.equal(total, 4, "один из пяти обменов противник пропустил в оглушении");
    assert.equal(state.enemyRounds.at(-1)[1], null);
});

test("суперудар против такой же стихии гаснет, а не бьёт по игроку", () => {
    const armed = armSuper({ ...battle(), charge: CHARGE_COST }, 0);
    const chain = cool("fire", "water");
    const { state, events } = resolveRound(armed, chain, chain.map((e) => cast(e)));
    const first = clashes(events)[0];
    assert.equal(first.outcome, "super-fizzle");
    assert.equal(first.damage, 0);
    assert.equal(first.target, null);
    assert.equal(state.hp.player, 10, "верная догадка не должна наказываться");
    assert.equal(state.hp.enemy, 10);
});

test("больше трёх одинаковых в цепочке бьют по самому игроку", () => {
    const enemy = Array(5).fill(null).map(() => cast("wind"));

    // Ровно три — это ВАЛ, сильнейший узор. Отдачи нет.
    const three = resolveRound(battle(), ["fire", "fire", "fire", "water", "wind"], enemy);
    assert.equal(three.events.filter((e) => e.type === "overheat").length, 0);

    // Четвёртая такая же в той же пятёрке превращает жадность в отдачу.
    const four = resolveRound(battle(), ["fire", "fire", "fire", "fire", "water"], enemy);
    const hot = four.events.find((e) => e.type === "overheat");
    assert.ok(hot, "четыре одинаковых должны перегревать");
    assert.equal(hot.element, "fire");
    assert.equal(hot.count, 4);
    assert.ok(hot.damage > 0);

    // Пять одинаковых стоят дороже четырёх.
    const five = resolveRound(battle(), Array(5).fill("fire"), enemy);
    assert.ok(five.events.find((e) => e.type === "overheat").damage > hot.damage);
});

test("перегрев считается по всей цепочке, а не только подряд", () => {
    const enemy = Array(5).fill(null).map(() => cast("wind"));
    const scattered = resolveRound(battle(), ["fire", "water", "fire", "water", "fire"], enemy);
    assert.equal(scattered.events.filter((e) => e.type === "overheat").length, 0,
        "три вразбивку — ещё не перегрев");

    const four = resolveRound(battle(), ["fire", "water", "fire", "fire", "fire"], enemy);
    assert.ok(four.events.find((e) => e.type === "overheat"), "четыре вразбивку — уже перегрев");
});

test("перегрев может добить и засчитывается в урон раунда", () => {
    const low = { ...battle(), hp: { player: 2, enemy: 10 }, maxHp: { player: 14, enemy: 10 } };
    const enemy = Array(5).fill(null).map(() => cast("wind"));
    const { state, events } = resolveRound(low, Array(5).fill("fire"), enemy);
    assert.equal(state.hp.player, 0);
    assert.equal(state.outcome, "enemy");
    assert.equal(events.at(-1).type, "round-end");
    assert.ok(events.at(-1).dealt.player >= 4, "отдача попадает в итог раунда");
});

test("узор на стихии арены платит вдвое", () => {
    // Сила арены объявляется до первого хода, поэтому это условие задачи,
    // а не везение по итогам: игрок сам решает, гнаться за ней или нет.
    const chain = ["water", "water", "water", "fire", "fire"];
    const enemy = [cast("fire"), cast("fire"), cast("fire"), cast("wind"), cast("wind")];

    const plain = resolveRound(battle(), chain, enemy).events.find((e) => e.type === "combo");
    assert.equal(plain.favoured, false);
    assert.equal(plain.damage, 3, "вал бьёт на три");

    const strong = resolveRound({ ...battle(), favour: "water" }, chain, enemy)
        .events.find((e) => e.type === "combo");
    assert.equal(strong.favoured, true);
    assert.equal(strong.damage, 6, "на своей арене — вдвое");
    assert.match(strong.phrase, /арена в силе/);
});

test("чужая стихия арены узору ничего не даёт", () => {
    const chain = ["water", "water", "water", "fire", "fire"];
    const enemy = [cast("fire"), cast("fire"), cast("fire"), cast("wind"), cast("wind")];
    const other = resolveRound({ ...battle(), favour: "wind" }, chain, enemy)
        .events.find((e) => e.type === "combo");
    assert.equal(other.favoured, false);
    assert.equal(other.damage, 3);
});
