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
    for (let i = 1; i < CAMPAIGN.length; i += 1) {
        assert.ok(timers[i] < timers[i - 1], "время на ход должно сокращаться");
    }

    // Здоровье — не главный рычаг сложности, но финал должен быть самым долгим боем.
    const hp = CAMPAIGN.map((o) => o.hp);
    assert.equal(Math.max(...hp), hp.at(-1), "у финального босса больше всего здоровья");

    // Каждое умение противника появляется не раньше своего яруса.
    assert.equal(CAMPAIGN[0].readsPatterns, false, "первый противник не наказывает за узор");
    assert.ok(!CAMPAIGN[0].readsRhythm && !CAMPAIGN[1].readsRhythm, "ритм читают только верхние ярусы");
    assert.ok(CAMPAIGN.slice(2).every((o) => o.readsRhythm), "с третьего яруса ритм читают все");
    assert.equal(CAMPAIGN.filter((o) => o.enrageAt > 0).length, 1, "вторая фаза — только у финала");
    assert.ok(CAMPAIGN.at(-1).enrageAt > 0, "и это финальный босс");
});

test("у игрока хватает здоровья пережить слепой первый раунд", () => {
    // Коронка скрыта: в худшем случае все пять обменов проигрываются коронке
    // по двойному урону. Бой не должен заканчиваться до первой возможности
    // что-то узнать о противнике.
    const worstRound = 5 * 2;
    assert.ok(PLAYER_MAX_HP > worstRound,
        `${PLAYER_MAX_HP} HP не переживают самый неудачный первый раунд (${worstRound})`);
});

test("лечение между боями ограничено потолком", () => {
    assert.ok(healAfterWin(1) > 1, "после победы часть здоровья возвращается");
    assert.ok(healAfterWin(1) < PLAYER_MAX_HP, "но не до полного");
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
