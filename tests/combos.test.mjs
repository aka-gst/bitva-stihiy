import test from "node:test";
import assert from "node:assert/strict";

import { COMBO_LIST, findCombo, leadOf, shapeOf } from "../src/combos.js";
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
    // Выбирать за игрока сильнейшее окно значит выбирать самое дорогое:
    // узор ценой в три победы срывается вчетверо чаще надёжного.
    const found = findCombo(['water', 'fire', 'water', 'fire', 'fire']);
    assert.deepEqual(found.slots, [0, 1, 2]);
    assert.equal(found.combo.id, 'pierce');
});

test("узор зовётся по той стихии, что в нём повторяется", () => {
    // Захлёст — это два одинаковых на выходе. Пока бралась просто первая
    // стихия тройки, «захлёст огня» мог оказаться двумя водами подряд.
    assert.equal(leadOf('fire', 'water', 'water'), 'water', 'ABB ведёт вторая');
    assert.equal(leadOf('fire', 'fire', 'water'), 'fire', 'AAB ведёт первая');
    assert.equal(leadOf('fire', 'water', 'fire'), 'fire', 'ABA ведёт первая');
    assert.equal(findCombo(['fire', 'water', 'water', 'wind', 'fire']).element, 'water');
});
