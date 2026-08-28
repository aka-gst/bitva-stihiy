import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN, EPILOGUE, PLAYER_MAX_HP, PROLOGUE, campaignScore, healAfterWin, isFinalTier, opponentAt } from "../src/campaign.js";
import { MODES, MODE_ORDER, SPARRING, STORY_MODE } from "../src/modes.js";
import { ELEMENTS } from "../src/rules.js";

test("в кампании пять ярусов и у каждого есть роль в обучении", () => {
    assert.equal(CAMPAIGN.length, 5);
    for (const opponent of CAMPAIGN) {
        assert.ok(opponent.teaches?.length > 0, `${opponent.name} ничему не учит`);
        assert.ok(opponent.intro?.length > 0);
        assert.ok(opponent.defeat?.length > 0);
        assert.ok(ELEMENTS.includes(opponent.element));
    }
    assert.ok(PROLOGUE.length > 0 && EPILOGUE.length > 0);
});

test("сложность растёт от яруса к ярусу", () => {
    const timers = CAMPAIGN.map((o) => o.timer);
    const hp = CAMPAIGN.map((o) => o.hp);
    for (let i = 1; i < CAMPAIGN.length; i += 1) {
        assert.ok(timers[i] < timers[i - 1], "время на ход должно сокращаться");
        assert.ok(hp[i] >= hp[i - 1], "здоровье противников не должно падать");
    }
    assert.equal(CAMPAIGN[0].readsPatterns, false, "первый противник не должен наказывать за спам");
    assert.ok(CAMPAIGN.at(-1).enrageAt > 0, "у финального босса есть вторая фаза");
});

test("лечение между боями ограничено потолком", () => {
    assert.equal(healAfterWin(1), 5);
    assert.equal(healAfterWin(PLAYER_MAX_HP), PLAYER_MAX_HP);
    assert.equal(healAfterWin(PLAYER_MAX_HP - 1), PLAYER_MAX_HP);
});

test("очки растут за ярусы, здоровье и полное прохождение", () => {
    const partial = campaignScore({ tierIndex: 2, cleared: false, hp: 5, wins: {} });
    const full = campaignScore({ tierIndex: 5, cleared: true, hp: 5, wins: {} });
    const healthy = campaignScore({ tierIndex: 5, cleared: true, hp: 9, wins: {} });
    assert.ok(full > partial);
    assert.ok(healthy > full);
});

test("границы кампании не выходят за массив", () => {
    assert.equal(opponentAt(0).id, "ember");
    assert.equal(opponentAt(CAMPAIGN.length), null);
    assert.equal(isFinalTier(CAMPAIGN.length - 1), true);
    assert.equal(isFinalTier(0), false);
});

test("режимы свободного боя описаны полностью", () => {
    for (const id of MODE_ORDER) {
        const mode = MODES[id];
        assert.ok(mode, `нет режима ${id}`);
        assert.ok(mode.slots >= 1 && mode.timer > 0);
        assert.ok(["step", "instant"].includes(mode.reveal));
        assert.ok(["full", "muted", "summary"].includes(mode.log));
    }
    assert.equal(MODES.duel.slots, 1, "фехтование — один обмен");
    assert.equal(STORY_MODE.log, "full", "в сюжете правила не прячутся");
});

test("на каждую стихию есть спарринг-партнёр", () => {
    for (const element of ELEMENTS) {
        assert.equal(SPARRING[element].element, element);
    }
});
