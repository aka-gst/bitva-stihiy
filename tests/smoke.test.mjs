import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("styles/game.css", root), "utf8");

test("оболочка содержит все области интерфейса", () => {
    for (const id of [
        "screen-menu", "screen-modes", "screen-learn", "screen-story", "screen-battle",
        "arena", "fighter-player", "fighter-enemy", "fx-layer", "caption",
        "player-slots", "enemy-slots", "cast-row", "log", "overlay", "timer",
    ]) {
        assert.match(html, new RegExp(`id="${id}"`), `нет области ${id}`);
    }
});

test("страница подключает модуль и стили относительными путями", () => {
    assert.match(html, /<script type="module" src="\.\/src\/main\.js/, "точка входа — ES-модуль");
    assert.match(html, /href="\.\/styles\/game\.css/, "стили подключены относительным путём");
    assert.ok(!/src="\/src\//.test(html), "абсолютные пути сломают размещение игры в подкаталоге /knb");
});

test("сохранены интеграции с сайтом-хостом", () => {
    for (const hook of ["/game-menu.css", "/player-name.js", "stats.aka-gst.ru"]) {
        assert.ok(html.includes(hook), `потеряна интеграция: ${hook}`);
    }
});

test("русские подписи на месте", () => {
    for (const label of ["СЮЖЕТ", "СВОБОДНЫЙ БОЙ", "КАК ЭТО РАБОТАЕТ", "В БОЙ", "СУПЕР"]) {
        assert.ok(html.includes(label), `нет подписи: ${label}`);
    }
});

test("камня, ножниц и бумаги в проекте не осталось", async () => {
    const legacy = ["🧱", "📄", "✂️"];
    const files = ["index.html", "styles/game.css", ...(await readdir(new URL("src/", root))).map((f) => `src/${f}`)];
    for (const file of files) {
        const text = await readFile(new URL(file, root), "utf8");
        for (const glyph of legacy) {
            assert.ok(!text.includes(glyph), `${file} всё ещё содержит ${glyph}`);
        }
    }
});

test("все модули импортируются", async () => {
    const files = (await readdir(new URL("src/", root))).filter((f) => f.endsWith(".js"));
    assert.ok(files.length >= 8, "модулей должно быть больше, чем один файл-монолит");
    for (const file of files) {
        if (file === "main.js" || file === "ui.js" || file === "arena.js" || file === "audio.js") continue;
        await import(new URL(`src/${file}`, root));
    }
});

test("публичный интерфейс движка и ИИ на месте", async () => {
    const engine = await import(new URL("src/engine.js", root));
    for (const name of ["createBattle", "resolveRound", "armSuper", "canArmSuper", "isOver", "CHARGE_COST"]) {
        assert.ok(name in engine, `движок потерял ${name}`);
    }
    const ai = await import(new URL("src/ai.js", root));
    for (const name of ["planEnemyRound", "signatureFor", "signatureAt", "masksFor", "detectSpam", "detectCounterPlay"]) {
        assert.ok(name in ai, `ИИ потерял ${name}`);
    }
});

test("четыре режима свободного боя и сюжет доступны", async () => {
    const { MODES, MODE_ORDER, STORY_MODE } = await import(new URL("src/modes.js", root));
    assert.deepEqual(MODE_ORDER, ["easy", "medium", "hard", "duel"]);
    for (const id of MODE_ORDER) assert.ok(MODES[id], `нет режима ${id}`);
    assert.equal(STORY_MODE.id, "story");
});

test("движок не трогает DOM", async () => {
    for (const file of ["engine.js", "ai.js", "rules.js", "campaign.js", "modes.js", "rng.js"]) {
        const text = await readFile(new URL(`src/${file}`, root), "utf8");
        assert.ok(!/\bdocument\b|\bwindow\b/.test(text), `${file} не должен знать про DOM`);
    }
});

test("вёрстка описывает арену и анимацию боя", () => {
    for (const rule of [".arena", ".fighter", ".bolt", ".burst", "@keyframes cast-lunge", "@keyframes recoil"]) {
        assert.ok(css.includes(rule), `в стилях нет ${rule}`);
    }
    assert.match(css, /prefers-reduced-motion/, "нужен режим без анимации");
});
