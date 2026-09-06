/**
 * Сцена для карточки на витрине.
 *
 * Карточка должна показывать не снимок, а самый яркий момент в действии.
 * У этой игры такой момент один: противник бьёт коронкой — и по нему
 * проходит волна её цвета, — а игрок отвечает тем, что её гасит, и коронка
 * пробита. Статичный кадр этого не покажет: там половина смысла в том, что
 * одно случилось в ответ на другое.
 *
 * Снимает витрина, ставит игра. Отсюда три вызова наружу:
 *
 *   window.stihii.scene({...})      — ставит кадр и замирает, синхронно;
 *   window.stihii.showcase({...})   — ставит и играет, обещания НЕ возвращает;
 *   window.stihii.state()           — отпечаток нарисованного.
 *
 * `showcase()` нарочно не отдаёт обещание: если снимающий его дождётся, показ
 * кончится до старта записи и в кадре будет полсотни одинаковых пустых полей.
 *
 * **Игра собрана на вёрстке, а не на холсте.** Бойцы — SVG со скелетом из
 * суставов, арена — слои картинок. Экранная трансляция отдаёт кадр, когда
 * композитор браузера что-то закоммитил, а на вёрстке он может закоммитить
 * один раз за три секунды. Снимать надо покадрово по часам.
 *
 * ## Что закреплено и почему именно так
 *
 * `grep -n "Math.random()" src/` даёт тринадцать мест, и все тринадцать видны
 * в кадре: выбор удара из десяти поз, шесть свойств летающих частиц фона и
 * геометрия искр на каждом попадании. Памятью из них вспоминается одно.
 *
 * Поэтому закрепляем не перечислением мест, а подменой самого `Math.random`
 * на засеянный генератор: закрепка не зависит от того, все ли тринадцать
 * найдены, и переживёт четырнадцатое. Плюс отдельно `app.rng` — он засеян от
 * `Date.now()` и решает выбор противника, стихию арены и весь план боя.
 *
 * Проверяется закрепка не тем, что вышла ожидаемая картинка, а тем, что она
 * слушается: попроси другой сид — картинка обязана смениться.
 */

import { CLASH_MS, setScheduler } from './arena.js';
import { CAMPAIGN } from './campaign.js';
import { ELEMENT, ELEMENTS, counterTo } from './rules.js';
import { makeRng } from './rng.js';
import { setMuted } from './audio.js';

/** Сид по умолчанию. Любое число, лишь бы одно и то же от прогона к прогону. */
const SEED = 20260830;

/** Размер арены по умолчанию: в скрытой вкладке спросить размер не у кого. */
const SIZE = { width: 960, height: 540 };

let realRandom = null;

/** Подменить случайность засеянной. Возврат — функция отката. */
function pinRandom(seed) {
    if (!realRandom) realRandom = Math.random;
    const rng = makeRng(seed);
    Math.random = rng;
    return () => { if (realRandom) Math.random = realRandom; };
}

/**
 * ## Пульт: почему время приходится забирать целиком
 *
 * Снимать петлю по настоящим часам нельзя: в скрытой вкладке браузер душит
 * таймеры произвольно и всё сильнее — у соседей одни и те же 3120 мс
 * отчитались как 10 979 и как 165 652. Значит пульт должен двигать время
 * сам.
 *
 * И двигать его надо ЕДИНСТВЕННЫМ источником, иначе время идёт дважды:
 * пульт насчитал свои полсекунды, а мир прожил вдобавок свои. Поэтому здесь
 * подменяются обе стороны сразу — и таймеры боя (`setScheduler`), и часы
 * картинки (`document.getAnimations()`).
 *
 * **Факт, купленный поломкой (проверен в Chrome 148 на живой странице):**
 * анимации на паузе можно довести `currentTime` до конца, и она останется
 * `paused` — промис `finished` не резолвится. А бой её ждёт (`await
 * bolt.done`), то есть повисает навсегда. Лечится только явным `finish()`.
 * Поэтому шаг обязан финишировать дошедшие до конца, а не просто двигать
 * время.
 *
 * Бесконечные анимации (летающие частицы фона) финишировать нельзя — им
 * `finish()` бросает исключение. Их время просто идёт дальше.
 */
function makeClock() {
    let now = 0;
    let seq = 0;
    let queue = [];
    const known = new WeakSet();

    /** Часы для арены: кладём задачу в очередь вместо setTimeout. */
    const schedule = (fn, ms) => {
        seq += 1;
        queue.push({ at: now + Math.max(0, ms), order: seq, fn });
    };

    /** Дать микрозадачам добежать: за `await` в бою стоит ещё `await`. */
    async function settle(times = 8) {
        for (let i = 0; i < times; i += 1) await Promise.resolve();
    }

    /** Живые анимации страницы, кроме уже доигранных. */
    const alive = () => document.getAnimations()
        .filter((a) => a.playState !== 'finished' && a.playState !== 'idle');

    /** Новорождённые ставим на паузу с нуля: иначе они идут по чужим часам. */
    function adopt() {
        for (const a of alive()) {
            if (known.has(a)) continue;
            known.add(a);
            try { a.pause(); a.currentTime = 0; } catch { /* анимация уже умерла */ }
        }
    }

    /** Двинуть картинку на `ms` и добить те, что дошли до конца. */
    function advanceAnimations(ms) {
        for (const a of alive()) {
            let end = Infinity;
            try { end = a.effect?.getComputedTiming?.().endTime ?? Infinity; } catch { /* нет эффекта */ }
            try {
                const t = Number(a.currentTime) || 0;
                a.currentTime = t + ms;
                if (Number.isFinite(end) && t + ms >= end) a.finish();
            } catch { /* анимация снята со сцены посреди шага */ }
        }
    }

    return {
        schedule,
        get now() { return now; },
        get pending() { return queue.length; },

        hold() {
            adopt();
            return setScheduler(schedule);
        },

        /**
         * Продвинуть время на `ms`. Шагает квантами по кадру, потому что за
         * один квант мир успевает родить новые анимации и новые таймеры, и
         * прыжок через них сразу в конец их бы не проиграл.
         */
        async step(ms, quantum = 16) {
            const target = now + ms;
            while (now < target) {
                const dt = Math.min(quantum, target - now);
                now += dt;
                adopt();
                advanceAnimations(dt);
                await settle();
                // Созревшие таймеры — по одному, в порядке постановки: между
                // ними бой успевает поставить следующий.
                for (;;) {
                    queue.sort((a, b) => (a.at - b.at) || (a.order - b.order));
                    const i = queue.findIndex((t) => t.at <= now);
                    if (i < 0) break;
                    const [task] = queue.splice(i, 1);
                    task.fn();
                    await settle();
                }
                adopt();
            }
            await settle();
        },

        /** Вернуть настоящее время: часы арены и ход всем анимациям. */
        release(restore) {
            restore?.();
            queue = [];
            for (const a of document.getAnimations()) {
                try { a.play(); } catch { /* уже неживая */ }
            }
        },
    };
}

export function installShowcase(deps) {
    const {
        app, arena, dom,
        createBattle, resolveRound, renderSlots, setSlot, setHp, stopTimer,
        PLAYER_MAX_HP,
    } = deps;

    /** Ярус, на котором коронка читается яснее всего: он бьёт только огнём. */
    const opponent = CAMPAIGN[0];
    let casts = [];
    let frozen = false;
    let running = false;

    function sizeArena(width, height) {
        // Размер задаём явно и в пикселях: в скрытой вкладке спросить его не
        // у кого, а от размера арены зависит и рост бойца, и то, как лягут
        // слои фона.
        dom.arena.style.width = `${width}px`;
        dom.arena.style.height = `${height}px`;
        dom.arena.style.maxWidth = 'none';
        dom.arena.style.minHeight = '0';
    }

    /**
     * Заглушить всё, что подсыпает события: таймер раунда и недоигранную
     * анимацию. Отрисовку при этом не трогаем — останавливать надо часы, а
     * не картинку.
     */
    function stopFeeds() {
        stopTimer();
        arena.abort();
        arena.setSpeed(1);
    }

    function engage() {
        dom.fighterPlayer.classList.add('engaged');
        dom.fighterEnemy.classList.add('engaged');
    }

    /**
     * Кадр без интерфейса: три секунды на карточке должны показывать драку,
     * а не полоски, кнопки и разбор боя.
     */
    function bareStage(on) {
        document.body.classList.toggle('showcase', on);
    }

    /** Отпечаток нарисованного, а не следа состояний. */
    function state() {
        const box = dom.arena.getBoundingClientRect();
        const pose = (node) => node.dataset.pose ?? '';
        const glow = (node) => node.style.getPropertyValue('--strike') || '';
        const slots = (node) => [...node.querySelectorAll('.slot')]
            .map((s) => `${s.textContent.trim() || '·'}:${s.className.replace('slot ', '')}`).join('|');
        const motes = [...dom.arena.querySelectorAll('.mote')]
            .map((m) => `${m.style.left}/${m.style.bottom}/${m.style.animationDelay}`).join(',');
        return {
            арена: [Math.round(box.width), Math.round(box.height)],
            фон: [...dom.arena.querySelectorAll('.backdrop-plane')]
                .map((i) => i.getAttribute('src').split('/').pop()).join(','),
            бойцы: {
                игрок: { поза: pose(dom.fighterPlayer), свечение: glow(dom.fighterPlayer) },
                противник: { поза: pose(dom.fighterEnemy), свечение: glow(dom.fighterEnemy) },
            },
            слоты: { противник: slots(dom.enemySlots), игрок: slots(dom.playerSlots) },
            здоровье: [dom.playerHpNum.textContent, dom.enemyHpNum.textContent],
            частицы: motes,
            пульт: { набрано: casts.length, заморожен: frozen, идётУдар: running },
        };
    }

    /**
     * Ставит кадр и замирает. Синхронна нарочно: её можно дождаться, в
     * отличие от показа.
     */
    function scene({ seed = SEED, width = SIZE.width, height = SIZE.height, bare = true } = {}) {
        setMuted(true);
        pinRandom(seed);
        stopFeeds();
        casts = [];
        frozen = false;
        running = false;
        bareStage(bare);
        sizeArena(width, height);

        app.rng = makeRng(seed);
        app.story = null;
        app.opponent = opponent;
        app.mode = { id: 'showcase', name: 'ВИТРИНА', slots: 5, timer: 0, log: 'muted' };
        app.battle = createBattle({
            opponent,
            slots: 5,
            playerHp: PLAYER_MAX_HP,
            playerMaxHp: PLAYER_MAX_HP,
            charge: 0,
        });
        // Стихия арены закреплена явно: иначе бросок на раунд перекрасит небо
        // и подпись, и два прогона снимут две разные арены.
        app.battle.favour = opponent.element;

        app.playerSlots = renderSlots(dom.playerSlots, 5, { window: 3 });
        app.enemySlots = renderSlots(dom.enemySlots, 5, { window: 3 });
        app.seq = [];

        document.body.dataset.screen = 'battle';
        for (const id of ['screen-menu', 'screen-modes', 'screen-learn', 'screen-story']) {
            document.getElementById(id).hidden = true;
        }
        document.getElementById('screen-battle').hidden = false;
        document.getElementById('overlay').hidden = true;
        document.getElementById('screen-battle').dataset.favour = opponent.element;

        arena.mount({ enemyElement: opponent.element, playerElement: counterTo(opponent.element) });
        arena.resetPoses();
        arena.hideCaption();
        setHp(dom.playerHpBar, dom.playerHpNum, PLAYER_MAX_HP, PLAYER_MAX_HP);
        setHp(dom.enemyHpBar, dom.enemyHpNum, opponent.hp, opponent.hp);
        engage();
        return state();
    }

    /**
     * Положить одну понятную стихию в следующий слот сцены. Это не кнопка
     * интерфейса и не скрытый индекс: Глаза вызывают `cast('water')` и сразу
     * видят, чем игрок отвечает на огненную коронку противника.
     */
    function cast(element) {
        if (!ELEMENT[element]) return { ошибка: `неизвестная стихия: ${element}` };
        if (frozen) return { ошибка: 'сцена заморожена: вызови stihii.scene() и поставь её заново' };
        if (running) return { ошибка: 'удар уже идёт' };
        if (!app.battle) return { ошибка: 'сначала вызови stihii.scene()' };
        if (casts.length >= app.battle.slots) return { ошибка: 'все слоты сцены уже заняты' };

        const index = casts.length;
        casts.push(element);
        setSlot(app.playerSlots[index], { element, state: 'filled' });
        setSlot(app.enemySlots[index], { element: opponent.element, state: 'now', signature: true });
        arena.setPlayerElement(element);
        return { набрано: casts.length, игрок: element, противник: opponent.element };
    }

    /**
     * Разыграть один уже названный обмен. Возвращает намеренную длительность,
     * но не Promise: захват запускают сразу после вызова, не после конца боя.
     */
    function strike() {
        if (frozen) return { ошибка: 'сцена заморожена: вызови stihii.scene() и поставь её заново' };
        if (running) return { ошибка: 'удар уже идёт' };
        const element = casts.at(-1);
        if (!element) return { ошибка: "сначала выбери стихию: stihii.cast('water')" };

        const oneExchange = { ...app.battle, slots: 1 };
        const plan = [{ element: opponent.element, signature: true, sig: opponent.element }];
        const { state: resolved, events } = resolveRound(oneExchange, [element], plan);
        const event = events.find((item) => item.type === 'clash');
        if (!event) return { ошибка: 'движок не собрал обмен' };

        app.battle = { ...resolved, slots: 5 };
        running = true;
        void arena.playClash(event, {
            enemySignature: opponent.element,
            onImpact: () => setHp(dom.enemyHpBar, dom.enemyHpNum, event.hp.enemy, opponent.hp),
        }).finally(() => {
            if (!frozen) {
                setHp(dom.playerHpBar, dom.playerHpNum, event.hp.player, PLAYER_MAX_HP);
                setHp(dom.enemyHpBar, dom.enemyHpNum, event.hp.enemy, opponent.hp);
            }
            running = false;
        });

        return {
            игрок: element,
            противник: opponent.element,
            исход: event.phrase,
            намереннаяДлительность: CLASH_MS,
        };
    }

    /** Остановить анимацию в текущем кадре. Для следующего дубля — снова scene(). */
    function freeze() {
        frozen = true;
        running = false;
        arena.abort();
        return state();
    }

    /**
     * Момент ловится по признаку, а не по времени: из раунда берутся обмены
     * начиная с того, где пробита коронка. Если признака нет — сцена не
     * играет и говорит об этом, а не снимает что попало.
     */
    function moment() {
        const answer = counterTo(opponent.element);
        const chain = [answer, answer, answer, answer, answer];
        const plan = chain.map(() => ({
            element: opponent.element, signature: true, sig: opponent.element,
        }));
        const { events } = resolveRound(app.battle, chain, plan);
        const clashes = events.filter((e) => e.type === 'clash');
        const at = clashes.findIndex((e) => e.parry);
        return { clashes, at, plan };
    }

    /**
     * Ставит сцену и играет её. Обещания не возвращает — возвращает то, что
     * нужно снимающему: намеренную длительность рядом с тем, из чего она
     * сложилась.
     *
     * Намеренная нужна потому, что в скрытой вкладке браузер душит таймеры
     * произвольно и всё сильнее: у соседей замеренные 3120 мс отчитались
     * один раз как 10 979, другой — как 165 652. Полагаться надо на
     * намеренную, а измеренную держать признаком того, что вкладка усыплена.
     */
    function showcase(opts = {}) {
        const { steps = 2 } = opts;
        scene(opts);
        const { clashes, at, plan } = moment();
        if (at < 0) return { сыграно: 0, ошибка: 'коронка не пробита, снимать нечего' };

        const chosen = clashes.slice(at, at + steps);
        const started = performance.now();

        void (async () => {
            for (const event of chosen) {
                const slot = app.playerSlots[event.index];
                setSlot(slot, { element: event.player, state: 'filled' });
                setSlot(app.enemySlots[event.index], {
                    element: plan[event.index].element,
                    state: 'now',
                    signature: plan[event.index].signature,
                });
                await arena.playClash(event, {
                    enemySignature: plan[event.index].signature ? plan[event.index].sig : null,
                });
                setHp(dom.enemyHpBar, dom.enemyHpNum, event.hp.enemy, opponent.hp);
                setHp(dom.playerHpBar, dom.playerHpNum, event.hp.player, PLAYER_MAX_HP);
            }
        })();

        return {
            сыграно: chosen.length,
            намеренаяДлительность: chosen.length * CLASH_MS,
            замерено: () => Math.round(performance.now() - started),
            показывает: 'противник бьёт коронкой — игрок её гасит',
        };
    }

    // ---- пульт времени: сцена шагами, а не по настоящим часам ---------------
    //
    // Рядом стоит ручной пульт (`cast`/`strike`/`freeze`) — он про нажатия.
    // Этот — про время: он нужен, когда снимают петлю покадрово и нельзя
    // полагаться на часы браузера.

    const clock = makeClock();
    let restore = null;

    /** Забрать время себе. Без этого шагать нельзя — время пойдёт дважды. */
    function hold() {
        if (restore) return { часы: 'пульта', ужеБыло: true };
        stopFeeds();
        restore = clock.hold();
        return { часы: 'пульта', ужеБыло: false };
    }

    /**
     * Продвинуть мир на `секунды` и отдать отпечаток нарисованного.
     * Падает, если время не захвачено: молча шагать по чужим часам — значит
     * снять кашу и не понять почему.
     */
    async function step(секунды) {
        if (!restore) throw new Error('витрина: сначала hold(), иначе время идёт дважды');
        const ms = Number(секунды) * 1000;
        if (!Number.isFinite(ms) || ms < 0) {
            throw new TypeError(`витрина: step ждёт секунды числом, пришло ${секунды}`);
        }
        await clock.step(ms);
        return state();
    }

    /** Вернуть настоящее время. */
    function release() {
        if (!restore) return { отпущено: false };
        clock.release(restore);
        restore = null;
        return { отпущено: true };
    }

    /**
     * Точка синхронизации. Холста здесь нет — вёрстка рисует себя сама, —
     * поэтому вызов не «рисует», а заставляет браузер применить накопленные
     * стили сейчас и отдаёт отпечаток того, что после этого на экране.
     */
    function render() {
        void dom.arena.offsetWidth;
        return state();
    }

    /**
     * Готовый сценарий петли: ставит сцену, забирает время и запускает бой в
     * виртуальном времени. Дальше снимающий шагает `step` и снимает кадры.
     *
     * Падает, если снимать нечего: петля не имеет права показать механику,
     * которой в игре нет. И отдаёт `проверить()` — вызвать ПОСЛЕ прогона:
     * он смотрит на итог и падает, если показано не то, что обещано.
     */
    function loop({ steps = 2, fps = 30, ...opts } = {}) {
        scene(opts);
        hold();

        const { clashes, at, plan } = moment();
        if (at < 0) {
            release();
            throw new Error('витрина: коронка не пробита — снимать нечего');
        }

        const chosen = clashes.slice(at, at + steps);
        const ждём = chosen[chosen.length - 1].hp.enemy;
        let доиграно = false;

        void (async () => {
            for (const event of chosen) {
                setSlot(app.playerSlots[event.index], { element: event.player, state: 'filled' });
                setSlot(app.enemySlots[event.index], {
                    element: plan[event.index].element,
                    state: 'now',
                    signature: plan[event.index].signature,
                });
                await arena.playClash(event, {
                    enemySignature: plan[event.index].signature ? plan[event.index].sig : null,
                });
                setHp(dom.enemyHpBar, dom.enemyHpNum, event.hp.enemy, opponent.hp);
                setHp(dom.playerHpBar, dom.playerHpNum, event.hp.player, PLAYER_MAX_HP);
            }
            доиграно = true;
        })();

        // CLASH_MS — намеренная длительность обмена, но не полная: внутри
        // обмена бой ещё ждёт анимаций (`await bolt.done`), а их время в эту
        // константу не входит. Проверено шагами: 69 кадров по 1/30 не
        // дотянули до конца второго обмена. Поэтому снимающему отдаётся не
        // обещание длительности, а признак конца — шагать надо до него.
        const оценкаМс = chosen.length * CLASH_MS;
        return {
            доиграно: () => доиграно,
            кадровСзапасом: Math.ceil((оценкаМс * 2 / 1000) * fps),
            кадровОценка: Math.ceil((оценкаМс / 1000) * fps),
            шагСекунд: 1 / fps,
            оценкаМс,
            хвостМс: 700,
            показывает: 'противник бьёт коронкой — игрок её гасит',
            проверить() {
                if (!доиграно) {
                    throw new Error(
                        'витрина: бой ещё идёт — шагай `step(шагСекунд)`, пока `доиграно()` не станет true '
                        + '(но не дольше `кадровСзапасом`).',
                    );
                }
                const стало = Number(dom.enemyHpNum.textContent);
                if (стало !== ждём) {
                    throw new Error(
                        `витрина: показала не то — здоровье противника ${стало}, ждали ${ждём}. `
                        + 'Скорее всего шагов сделано меньше, чем сказано в `кадров`.',
                    );
                }
                return { здоровьеПротивника: стало, сошлось: true };
            },
        };
    }

    window.stihii = {
        scene, cast, strike, freeze, showcase, state, seed: SEED,
        hold, step, release, render, loop,
    };
    /* Видимый для приёмки признак: модуль не только лежит в исходниках, но
       установился на открытой странице вместе с именованным пультом. */
    document.documentElement.dataset.stihiiSceneApi = 'scene cast strike freeze hold step release render loop';
}
