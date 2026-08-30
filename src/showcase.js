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

import { CLASH_MS } from './arena.js';
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

export function installShowcase(deps) {
    const {
        app, arena, dom,
        createBattle, resolveRound, renderSlots, setSlot, setHp, stopTimer,
        PLAYER_MAX_HP,
    } = deps;

    /** Ярус, на котором коронка читается яснее всего: он бьёт только огнём. */
    const opponent = CAMPAIGN[0];

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

    window.stihii = { scene, showcase, state, seed: SEED };
}
