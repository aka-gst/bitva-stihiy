import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("styles/game.css", root), "utf8");
const fighter = await readFile(new URL("src/fighter.js", root), "utf8");

test("оболочка содержит все области интерфейса", () => {
    for (const id of [
        "screen-menu", "screen-modes", "screen-learn", "screen-story", "screen-battle",
        "arena", "fighter-player", "fighter-enemy", "fx-layer", "caption",
        "player-slots", "enemy-slots", "cast-row", "log", "overlay", "timer", "notice",
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
    for (const hook of ["/game-menu.css", "/player-name.js", "/pulse/script.js"]) {
        assert.ok(html.includes(hook), `потеряна интеграция: ${hook}`);
    }
});

test("счётчик смотрит на сборщик, а не на приватную панель", () => {
    // stats.aka-gst.ru — админская панель, она намеренно отдаёт 404 и открывается
    // через SSH-туннель. Сбор проксирован сайтом на /pulse/. Разница невидима:
    // тег грузится, ошибок в консоли нет, а события просто не доходят.
    assert.ok(!html.includes("stats.aka-gst.ru"),
        "тег аналитики указывает на приватную панель — сбор молча выключен");
    assert.match(html, /src="\/pulse\/script\.js"/);
    assert.match(html, /data-website-id="[0-9a-f-]{36}"/);
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

test("рекорд дня отмечается только после подтверждения сервера", async () => {
    const main = await readFile(new URL("src/main.js", root), "utf8");
    const body = main.slice(main.indexOf("async function submitLeaderboard"));
    const submit = body.slice(0, body.indexOf("\n}\n") + 1);
    // Считаем от места, где токен взят в руки: сброс раньше него — это выход
    // по «результат не рекорд», к отправке он отношения не имеет.
    const attempt = submit.slice(submit.indexOf("const token = leaderboardToken"));

    const confirmed = attempt.indexOf("response.ok");
    const marked = attempt.indexOf("localStorage.setItem(dailyKey");
    const dropped = attempt.indexOf("leaderboardToken = ''");
    const sent = attempt.indexOf("fetch('/api/leaderboard/scores'");

    assert.ok(confirmed > 0, "ответ сервера должен проверяться, иначе 500 пройдёт за успех");
    assert.ok(marked > confirmed, "отметка «лучшее за сегодня» — только после подтверждения");
    assert.ok(dropped > sent, "токен нельзя выбрасывать до отправки: он ещё годен для повтора");
    assert.ok(!/catch\s*\{\s*\/\*[^*]*\*\/\s*\}/.test(attempt), "потерянный результат должен быть виден игроку");
    // Строка глобального топа живёт в меню, а отправка случается на итоге боя:
    // написанное туда игрок в нужный момент не увидит.
    assert.ok(!/dom\.leaders/.test(attempt), "сообщение о потере не должно уходить в экран меню");
    assert.match(attempt, /showNotice\(/, "сообщение показывается поверх текущего экрана");
});

test("сюжетная воронка размечена по ярусам", async () => {
    const main = await readFile(new URL("src/main.js", root), "utf8");
    assert.match(main, /track\('tier-cleared'/, "взятый ярус — отдельное событие");
    for (const [, event] of main.matchAll(/track\('game-finish', \{([\s\S]*?)\}\)/g)) {
        if (event.includes("'story'")) assert.match(event, /tier:/, "исход сюжета без яруса не читается");
    }
});

test("отказ сервера различается по причине, а не сводится к «сети»", async () => {
    const main = await readFile(new URL("src/main.js", root), "utf8");
    const body = main.slice(main.indexOf("function submitFailure"));
    // +2 захватывает и перевод строки, и саму закрывающую скобку — иначе
    // выражение не компилируется.
    const decide = body.slice(0, body.indexOf("\n}\n") + 2);
    // eslint-disable-next-line no-new-func
    const submitFailure = new Function(`${decide}; return submitFailure;`)();

    // Сеть и 5xx — осечка: повтор имеет смысл, токен ещё годен.
    for (const status of [undefined, 500, 503]) {
        const r = submitFailure(status);
        assert.equal(r.keepToken, true, `${status}: транзиентный отказ не должен гасить токен`);
        assert.match(r.text, /СЕТЬ/);
    }

    // 422 — бой короче минимума. Он считается от начала захода, поэтому
    // следующая попытка будет длиннее: токен беречь, но не врать про сеть.
    const short = submitFailure(422);
    assert.equal(short.keepToken, true);
    assert.ok(!/СЕТЬ/.test(short.text), "короткий бой — не сетевая проблема");

    // 409 и 400 окончательны: обещать повтор было бы враньём.
    for (const status of [409, 400]) {
        const r = submitFailure(status);
        assert.equal(r.keepToken, false, `${status}: этим токеном уже ничего не добиться`);
        assert.ok(!/ПОПРОБУЕТ СНОВА/.test(r.text), `${status}: повтора не будет, обещать его нельзя`);
    }
});

test("отказ в сессии не пропадает молча", async () => {
    const main = await readFile(new URL("src/main.js", root), "utf8");
    const begin = main.slice(main.indexOf("async function beginLeaderboard"));
    const body = begin.slice(0, begin.indexOf("\n}\n") + 2);

    assert.match(body, /response\.ok/, "ответ сервера должен проверяться");
    assert.match(body, /429/, "ограничение по частоте — отдельная причина, её видно игроку");
    assert.ok(!/catch\s*\{\s*leaderboardToken\s*=\s*''\s*;?\s*\}/.test(body),
        "неудача выдачи токена не должна сводиться к молчаливому обнулению");

    // Причина обязана всплыть там, где результат должен был уйти.
    const submit = main.slice(main.indexOf("async function submitLeaderboard"));
    const attempt = submit.slice(0, submit.indexOf("\n}\n") + 2);
    assert.match(attempt, /leaderboardIssue/, "без токена игрок должен узнать причину");
});

test("чужой текст не попадает в разметку", async () => {
    // Ник пишет один игрок, а рисует страница другого: и в таблице рекордов,
    // и — скоро — в ссылке-приглашении. Через innerHTML это выполнение чужого
    // скрипта на aka-gst.ru по ссылке, которая выглядит как приглашение от друга.
    //
    // Проверка тут двухслойная, потому что первый слой — растяжка, а не
    // доказательство: соседство innerHTML с подозрительным именем ловит ровно
    // тот случай, который в него заложен, и слепнет после переименования
    // переменной. Настоящая гарантия — второй слой: в модуле, который трогает
    // сеть и URL, опасного вызова просто нет.
    const files = (await readdir(new URL("src/", root))).filter((f) => f.endsWith(".js"));
    const EXTERNAL = /nickname|leaderboard|payload|\bhash\b|searchParams|location\./i;

    for (const file of files) {
        const text = await readFile(new URL(`src/${file}`, root), "utf8");
        for (const [line] of text.matchAll(/^.*\binnerHTML\b.*$/gm)) {
            assert.ok(!EXTERNAL.test(line),
                `${file}: в разметку уходит внешняя строка — только textContent\n  ${line.trim()}`);
        }
    }

    // Свойство, а не догадка: main.js разбирает ответы сервера и будет разбирать
    // приглашения из адреса, поэтому разметку он не собирает вообще.
    const main = await readFile(new URL("src/main.js", root), "utf8");
    assert.ok(!/innerHTML/.test(main),
        "main.js трогает внешние данные — сборка разметки должна жить в модуле отрисовки");
    assert.match(main.slice(main.indexOf("async function loadLeaderboard")), /textContent/,
        "имена из таблицы рекордов ставятся текстом");
});

test("боец ограничен и по высоте арены, а не только по ширине", () => {
    // Высота выводится из ширины через aspect-ratio, поэтому в низком окне
    // арена сжималась, а боец оставался прежним — и мага срезало сверху.
    const fighter = css.slice(css.indexOf(".fighter {"));
    const rule = fighter.slice(0, fighter.indexOf("}"));
    assert.match(rule, /max-height/, "без потолка по высоте бойца срежет в низком окне");
    assert.match(rule, /aspect-ratio/);
});

test("рисунок бойца прижат к земле, а не к центру рамки", () => {
    // Когда высота упирается в потолок, рамка становится ниже пропорций
    // рисунка. По умолчанию svg центрируется — боец всплывал бы над полом.
    assert.match(fighter, /preserveAspectRatio="xMidYMax meet"/);
});

test("у бойца есть разные удары на одно действие", async () => {
    const { POSES, ATTACK_POSES, JOINTS } = await import(new URL("src/fighter.js", root));
    assert.ok(ATTACK_POSES.length >= 4, "одинаковые удары подряд утомляют глаз");
    for (const name of [...ATTACK_POSES, "idle", "guard", "hurt", "down", "win"]) {
        assert.ok(POSES[name], `нет позы ${name}`);
        for (const joint of Object.keys(JOINTS)) {
            assert.equal(typeof POSES[name][joint], "number", `${name}: сустав ${joint} не задан`);
        }
    }
});
