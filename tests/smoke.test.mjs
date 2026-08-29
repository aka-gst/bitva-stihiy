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

test("сорванный узор виден на арене, а не только в логе", async () => {
    // Узор складывается почти каждый раунд, а срабатывает примерно в трети
    // случаев. Пока осечка уходила только в боковой лог, игрок видел лишь
    // редкую вспышку без причины — и читал узоры как случайность.
    const main = await readFile(new URL("src/main.js", root), "utf8");
    const arena = await readFile(new URL("src/arena.js", root), "utf8");
    assert.match(arena, /playComboMiss/, "арене нечем показать осечку");
    const branch = main.slice(main.indexOf("event.type === 'combo'"));
    const body = branch.slice(0, branch.indexOf("event.type === 'overheat'"));
    assert.match(body, /playComboMiss/, "осечка не доходит до арены");
    assert.match(body, /playCombo\(/, "удавшийся узор не доходит до арены");
});

test("на кнопках стихий нет подписей", async () => {
    // Просили трижды: кнопка — это знак, а не пункт меню. Что кого гасит,
    // говорят колесо и заголовок кнопки, а не строчка под иконкой.
    const ui = await readFile(new URL("src/ui.js", root), "utf8");
    const cast = ui.slice(ui.indexOf("export function renderCastRow"));
    const body = cast.slice(0, cast.indexOf("export function renderSlots"));
    assert.doesNotMatch(body, /cast-name|cast-beats|cast-text/, "подпись вернулась на кнопку");
    assert.match(body, /elementGlyph/, "кнопка осталась без знака");
    assert.match(body, /aria-label|button\.title/, "без подписи нужен заголовок для доступности");
});

test("бойцы сходятся вплотную, а не стреляют с краёв", async () => {
    const arena = await readFile(new URL("src/arena.js", root), "utf8");
    assert.match(arena, /classList\.add\('engaged'\)/, "сближение не включается");
    // Рамка бойца обязана совпадать с viewBox рисунка: иначе svg вписывается
    // с полями, ширина полей плавает от размера окна, и одно и то же
    // сближение даёт то дыру, то наложение силуэтов.
    const fig = css.slice(css.indexOf(".fighter {"));
    assert.match(fig.slice(0, fig.indexOf("}")), /aspect-ratio:\s*12\s*\/\s*17/);
    assert.match(fighter, /viewBox="0 0 120 170"/);
});

test("экран боя собран в три этажа: драка, разбор с полем, кнопки", () => {
    // Порядок задан заказчиком и держит всю раскладку: арена во всю ширину
    // сверху, слева разбор боя, справа поле ходов, кнопки внизу.
    const battle = html.slice(html.indexOf('<div class="battle-layout">'));
    const layout = battle.slice(0, battle.indexOf('<div class="overlay"'));
    const order = ['id="arena"', 'class="middle"', 'class="side"', 'class="board"', 'class="controls"'];
    let at = -1;
    for (const mark of order) {
        const found = layout.indexOf(mark);
        assert.ok(found > at, `${mark} стоит не на своём месте`);
        at = found;
    }
    // Кнопки стихий должны жить в нижнем этаже, а не внутри поля ходов.
    const controls = layout.slice(layout.indexOf('class="controls"'));
    assert.match(controls, /id="cast-row"/);
    assert.match(controls, /id="btn-go"/);
    assert.doesNotMatch(layout.slice(layout.indexOf('class="board"'), layout.indexOf('class="controls"')), /cast-row/);
});

test("узор называет себя на рамке зоны, а не только в подсказчике", async () => {
    // Подсказчик занят более важным уроком — коронкой противника, — и до
    // узоров доходит не сразу. Имя и награда должны стоять там, где узор
    // складывается: на рамке первых трёх ходов.
    const main = await readFile(new URL("src/main.js", root), "utf8");
    assert.match(main, /function paintWindowLabel/);
    const paint = main.slice(main.indexOf("function paintCombo"));
    assert.match(paint.slice(0, paint.indexOf("function paintWindowLabel")), /paintWindowLabel\(/,
        "подпись не обновляется при наборе цепочки");
    const label = main.slice(main.indexOf("function paintWindowLabel"));
    const body = label.slice(0, label.indexOf("\n}"));
    for (const mark of [/ПЕРЕГРЕВ/, /combo\.name/, /combo\.damage/, /isFavoured/]) {
        assert.match(body, mark);
    }
});

test("удары не повторяются через раз и держатся до попадания", async () => {
    const { ATTACK_POSES, pickAttack } = await import("../src/fighter.js");
    // Шести ударов на пять обменов в раунде мало: повтор бросался в глаза
    // уже на втором раунде.
    assert.ok(ATTACK_POSES.length >= 9, `ударов всего ${ATTACK_POSES.length}`);

    // Помним два прошлых, а не один: «нога, рука, нога» читается как повтор
    // не хуже прямого.
    let recent = null;
    for (let i = 0; i < 200; i += 1) {
        const pose = pickAttack(recent);
        assert.ok(!(recent ?? []).includes(pose), `${pose} повторился слишком рано`);
        recent = [pose, recent?.[0]].filter(Boolean);
    }

    // Поза удара обязана дожить до попадания. Пока её сбрасывали сразу после
    // замаха, сустав со своей плавностью едва успевал дойти до цели и ехал
    // обратно — все удары сливались в одно дёрганье.
    const arena = await readFile(new URL("src/arena.js", root), "utf8");
    const windup = arena.slice(arena.indexOf("await wait(T.windup)"));
    const afterWindup = windup.slice(0, windup.indexOf("const from = orbPoint"));
    assert.doesNotMatch(afterWindup, /settle\(/, "поза удара гаснет на замахе");
});

test("цвет, которым пробили, ложится на тело проигравшего", async () => {
    // Стихия победителя раньше была видна только во вспышке между бойцами:
    // она гасла за мгновение, и связь «эта стихия сняла мне здоровье» из неё
    // не возникала. Ради этой связи вся игра и затевалась.
    const arena = await readFile(new URL("src/arena.js", root), "utf8");
    assert.match(arena, /function tintStrike/);
    assert.match(arena, /tintStrike\(victim, winnerElement\)/, "победитель не красит проигравшего");
    assert.match(arena, /tintStrike\(playerNode, event\.element, 'overheating'\)/, "перегрев не красит своего");

    // Имя класса не должно совпадать с классом искр: боец унаследует их
    // размер и схлопнется в двадцать шесть пикселей.
    const fx = arena.slice(arena.indexOf("ring.className"), arena.indexOf("ring.className") + 60);
    const sparkClass = fx.match(/'([a-z-]+)'/)[1];
    assert.doesNotMatch(arena, new RegExp(`tintStrike\\([^)]*'${sparkClass}'\\)`), `класс ${sparkClass} занят искрами`);
    assert.match(css, /\.fighter\.struck svg/);
    assert.match(css, /\.fighter\.overheating svg/);
});
