import test from "node:test";
import assert from "node:assert/strict";

import { coachLine, leadingElement, SIGNATURE_LEARNED } from "../src/coach.js";
import { COMBOS } from "../src/combos.js";

const battle = (over = {}) => ({ charge: 0, superArmed: false, seen: {}, sigParried: 0, ...over });

test("без наблюдений подсказчик отправляет смотреть на счёт", () => {
    const line = coachLine(battle());
    assert.equal(line.tone, "watch");
    assert.match(line.text, /чаще/);
});

test("перевес одной стихии превращается в прямую подсказку с ответом", () => {
    const line = coachLine(battle({ seen: { fire: 4, water: 1, wind: 1 } }));
    assert.equal(line.tone, "read");
    // Игроку называется и то, что он видит, и то, что с этим делать.
    assert.match(line.text, /4 раза из 6/);
    assert.match(line.text, /вода/i, "не назван ответ на огонь");
});

test("ровный счёт подсказкой про коронку не считается", () => {
    assert.equal(leadingElement({ fire: 2, water: 2, wind: 2 }), null);
    assert.equal(leadingElement({ fire: 2, water: 0, wind: 0 }), null, "двух наблюдений мало");
    assert.equal(leadingElement({ fire: 4, water: 1, wind: 1 }).element, "fire");
});

test("урок про коронку уходит, когда игрок её пробил", () => {
    const seen = { fire: 5, water: 1, wind: 1 };
    assert.equal(coachLine(battle({ seen })).tone, "read");
    // Подсказка, которую не убрать делом, превращается в шум.
    const learned = coachLine(battle({ seen, sigParried: SIGNATURE_LEARNED }));
    assert.equal(learned.tone, "combo");
});

test("совет про заряд ждёт, пока понята коронка", () => {
    // Заряд копится за пару раундов и до потолка: он никуда не денется.
    // А пока коронка не найдена, супер уходит наугад.
    const busy = coachLine(battle({ charge: 3, seen: { fire: 5, water: 1 } }), { chargeCost: 3 });
    assert.equal(busy.tone, "read", "урок про коронку уступил совету про заряд");

    const line = coachLine(
        battle({ charge: 3, sigParried: SIGNATURE_LEARNED, seen: { fire: 5 } }),
        { chargeCost: 3 },
    );
    assert.equal(line.tone, "super");
    // Взведённый супер повторять не надо: решение уже принято.
    const armed = coachLine(
        battle({ charge: 3, superArmed: true, sigParried: SIGNATURE_LEARNED, seen: { fire: 5 } }),
        { chargeCost: 3 },
    );
    assert.notEqual(armed.tone, "super");
});

test("перегрев перебивает всё остальное", () => {
    const line = coachLine(
        battle({ charge: 3, sigParried: SIGNATURE_LEARNED, seen: { fire: 5 } }),
        { chargeCost: 3, overheat: { element: "fire", count: 4, damage: 2 } },
    );
    assert.equal(line.tone, "hot");
    assert.match(line.text, /−2/, "не сказано, сколько снимет");
});

test("после урока про коронку подсказчик называет собранный узор", () => {
    const line = coachLine(
        battle({ sigParried: SIGNATURE_LEARNED, seen: { fire: 5 } }),
        { combo: COMBOS.surge },
    );
    assert.equal(line.tone, "combo");
    assert.match(line.text, /ВАЛ/);
    assert.match(line.text, /2 обмена из 3/, "цена у всех узоров одна");
});

test("подсказчик говорит, когда узор попал в силу арены", () => {
    const state = battle({ sigParried: SIGNATURE_LEARNED, seen: { fire: 5 } });
    const plain = coachLine(state, { combo: COMBOS.surge });
    assert.equal(plain.tone, "combo");
    assert.doesNotMatch(plain.text, /вдвое/);

    const strong = coachLine(state, { combo: COMBOS.surge, favoured: true });
    assert.equal(strong.tone, "favour");
    assert.match(strong.text, /вдвое/);
});
