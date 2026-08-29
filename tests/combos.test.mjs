import test from "node:test";
import assert from "node:assert/strict";

import { COMBO_LIST, COMBO_NEEDS, findCombo, leadOf, shapeOf } from "../src/combos.js";
import { ELEMENTS } from "../src/rules.js";

test("любая тройка подряд складывается в узор", () => {
    // Раньше формы AAB и ABB не значили ничего: три хода подряд то давали
    // что-то, то нет, и со стороны игрока это было неотличимо от случайности.
    // Пять форм — это все возможные тройки, исключений больше нет.
    const seen = new Set();
    for (const a of ELEMENTS) for (const b of ELEMENTS) for (const c of ELEMENTS) {
        const combo = shapeOf(a, b, c);
        assert.ok(combo, `тройка ${a}/${b}/${c} осталась без узора`);
        seen.add(combo.id);
    }
    assert.equal(seen.size, COMBO_LIST.length, "не все узоры достижимы");
});

test("узор задают первые три хода, а не самые выгодные", () => {
    // В пятёрке совпадают все три окна, и выбор за игроком: узор задают
    // первые три хода, два последних остаются под чистый размен.
    const found = findCombo(['water', 'fire', 'water', 'fire', 'fire']);
    assert.deepEqual(found.slots, [0, 1, 2]);
    assert.equal(found.combo.id, 'bond');
});

test("сила узора — это число повторов в нём, и цена у всех одна", () => {
    // Ради этого правила пять узоров и свели к трём: таблицу из пяти строк
    // с разными наградами и разными ценами игроки не удерживали в голове.
    const byRepeats = [...COMBO_LIST].sort((a, b) => a.repeats - b.repeats);
    let damage = -1;
    for (const combo of byRepeats) {
        assert.ok(combo.damage > damage, `${combo.name} выбивается из правила «больше повторов — больше урона»`);
        damage = combo.damage;
        assert.equal(combo.needs, COMBO_NEEDS, `у ${combo.name} своя цена`);
    }
    assert.equal(COMBO_LIST.length, 3);
});

test("у призмы нет своей стихии, и арена её не усиливает", () => {
    // Арена усиливает повтор, а призма ровно тем и ценна, что повторов нет.
    assert.equal(leadOf('fire', 'water', 'wind'), null);
    assert.equal(findCombo(['fire', 'water', 'wind', 'fire', 'fire']).element, null);
});

test("узор зовётся по той стихии, что в нём повторяется", () => {
    // Захлёст — это два одинаковых на выходе. Пока бралась просто первая
    // стихия тройки, «захлёст огня» мог оказаться двумя водами подряд.
    assert.equal(leadOf('fire', 'water', 'water'), 'water', 'повторяется вода');
    assert.equal(leadOf('fire', 'fire', 'water'), 'fire', 'повторяется огонь');
    assert.equal(leadOf('fire', 'water', 'fire'), 'fire', 'повторяется огонь');
    assert.equal(findCombo(['fire', 'water', 'water', 'wind', 'fire']).element, 'water');
});
