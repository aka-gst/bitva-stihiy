/**
 * Арена: два мага и обмен заклинаниями.
 *
 * Модуль ничего не знает о правилах — он получает готовое событие
 * столкновения и проигрывает его. Момент, когда урон «долетел»,
 * сообщается наружу через хук onImpact, чтобы полоски здоровья
 * дёргались точно в кадр удара.
 */

import { ELEMENT } from './rules.js';
import { haptic, sweep, tone } from './audio.js';
import { mageSvg } from './mage.js';

/** Длительности при нормальной скорости, мс. */
const T = {
    windup: 220,
    travel: 320,
    meet: 200,
    follow: 210,
    recover: 200,
    ko: 700,
};

const PLAYER_WINS = new Set(['win', 'stun', 'super-hit']);
const ENEMY_WINS = new Set(['lose', 'crit', 'super-fail']);

export function createArena({ root, fxLayer, caption, playerNode, enemyNode }) {
    // Скорость фиксируется на время одного столкновения: смена настройки
    // посреди анимации иначе делит длительность на ноль и подвешивает бой.
    let speed = 1;
    let pendingSpeed = 1;
    let busy = false;
    let generation = 0;

    const instant = () => speed === 0;
    const rate = () => Math.max(0.05, speed);
    const wait = (ms) => (instant() ? Promise.resolve() : new Promise((r) => setTimeout(r, ms / rate())));

    /** Каждый новый бой/выход из боя обесценивает незавершённые анимации. */
    const abort = () => { generation += 1; };
    const stale = (mine) => mine !== generation;

    function mount({ playerElement = 'water', enemyElement = 'fire' } = {}) {
        abort();
        playerNode.innerHTML = mageSvg({ element: playerElement, side: 'player' });
        enemyNode.innerHTML = mageSvg({ element: enemyElement, side: 'enemy' });
        resetPoses();
        fxLayer.replaceChildren();
        hideCaption();
    }

    function resetPoses() {
        for (const node of [playerNode, enemyNode]) {
            node.classList.remove('casting', 'hurt', 'stunned', 'down', 'victor');
        }
    }

    /** Орб на посохе показывает стихию, которую маг держит наготове. */
    function setOrb(node, element) {
        const color = ELEMENT[element]?.color;
        if (!color) return;
        node.querySelectorAll('.staff-orb, .eye').forEach((el) => { el.style.fill = color; });
    }

    const point = (el, yShare = 0.5) => {
        const box = root.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - box.left,
            y: rect.top + rect.height * yShare - box.top,
        };
    };

    const orbPoint = (node) => {
        const orb = node.querySelector('.staff-orb');
        return orb ? point(orb) : point(node, 0.2);
    };
    const bodyPoint = (node) => point(node, 0.42);

    function spawnBolt(element, from, to, { big = false, duration = T.travel } = {}) {
        const info = ELEMENT[element];
        const bolt = document.createElement('div');
        bolt.className = big ? 'bolt super' : 'bolt';
        bolt.textContent = info.glyph;
        bolt.style.setProperty('--bolt-color', info.color);
        fxLayer.appendChild(bolt);

        const anim = bolt.animate(
            [
                { transform: `translate(${from.x}px, ${from.y}px) scale(.35)`, opacity: 0 },
                { transform: `translate(${from.x + (to.x - from.x) * 0.18}px, ${from.y + (to.y - from.y) * 0.18 - 12}px) scale(1)`, opacity: 1, offset: 0.22 },
                { transform: `translate(${to.x}px, ${to.y}px) scale(1.05)`, opacity: 1 },
            ],
            { duration: duration / rate(), easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' },
        );
        return { node: bolt, done: anim.finished.catch(() => {}) };
    }

    function burst(at, color, { size = 1, sparks = 8 } = {}) {
        const ring = document.createElement('div');
        ring.className = 'burst';
        ring.style.setProperty('--burst-color', color);
        ring.style.transform = `translate(${at.x}px, ${at.y}px)`;
        fxLayer.appendChild(ring);
        ring.animate(
            [
                { transform: `translate(${at.x}px, ${at.y}px) scale(.2)`, opacity: 1 },
                { transform: `translate(${at.x}px, ${at.y}px) scale(${3.4 * size})`, opacity: 0 },
            ],
            { duration: 420 / rate(), easing: 'cubic-bezier(.1,.8,.3,1)' },
        ).finished.catch(() => {}).then(() => ring.remove());

        for (let i = 0; i < sparks; i += 1) {
            const angle = (Math.PI * 2 * i) / sparks + Math.random() * 0.4;
            const reach = (28 + Math.random() * 34) * size;
            const spark = document.createElement('div');
            spark.className = 'spark';
            spark.style.setProperty('--burst-color', color);
            fxLayer.appendChild(spark);
            spark.animate(
                [
                    { transform: `translate(${at.x}px, ${at.y}px) scale(1)`, opacity: 1 },
                    { transform: `translate(${at.x + Math.cos(angle) * reach}px, ${at.y + Math.sin(angle) * reach}px) scale(.2)`, opacity: 0 },
                ],
                { duration: (360 + Math.random() * 220) / rate(), easing: 'ease-out' },
            ).finished.catch(() => {}).then(() => spark.remove());
        }
    }

    function damagePop(at, amount, critical) {
        const pop = document.createElement('div');
        pop.className = critical ? 'damage-pop crit' : 'damage-pop';
        pop.textContent = `−${amount}`;
        pop.style.color = critical ? '' : '#fca5a5';
        fxLayer.appendChild(pop);
        pop.animate(
            [
                { transform: `translate(${at.x}px, ${at.y}px) scale(.6)`, opacity: 0 },
                { transform: `translate(${at.x}px, ${at.y - 18}px) scale(1.1)`, opacity: 1, offset: 0.3 },
                { transform: `translate(${at.x}px, ${at.y - 52}px) scale(1)`, opacity: 0 },
            ],
            { duration: 780 / rate(), easing: 'ease-out' },
        ).finished.catch(() => {}).then(() => pop.remove());
    }

    function shake(hard) {
        const cls = hard ? 'shake-hard' : 'shake';
        root.classList.remove('shake', 'shake-hard');
        void root.offsetWidth;
        root.classList.add(cls);
        setTimeout(() => root.classList.remove(cls), hard ? 440 : 340);
    }

    function showCaption(text) {
        if (!text) return;
        caption.textContent = text;
        caption.classList.add('on');
    }
    const hideCaption = () => caption.classList.remove('on');

    /**
     * Проигрывает одно столкновение.
     * @param {object} event  событие 'clash' из движка
     * @param {{onImpact?:function}} hooks
     */
    async function playClash(event, { onImpact } = {}) {
        speed = pendingSpeed;
        const mine = generation;
        const land = () => onImpact?.(event);

        if (instant()) { land(); return; }
        busy = true;
        try {
            await runClash(event, land, mine);
        } finally {
            busy = false;
        }
    }

    async function runClash(event, land, mine) {

        const victim = PLAYER_WINS.has(event.outcome) ? enemyNode
            : ENEMY_WINS.has(event.outcome) ? playerNode : null;
        const critical = event.outcome === 'crit' || event.outcome === 'super-fail' || event.damage > 1;
        const isSuper = event.outcome === 'super-hit' || event.outcome === 'super-fail';

        // 1. Замах: оба поднимают посохи, орбы загораются выбранной стихией.
        setOrb(playerNode, event.player);
        playerNode.classList.add('casting');
        tone(ELEMENT[event.player].tone, 70);
        if (event.enemy) {
            setOrb(enemyNode, event.enemy);
            enemyNode.classList.add('casting');
        }
        if (isSuper) sweep(220, 720, 240);
        await wait(T.windup);
        if (stale(mine)) return;
        playerNode.classList.remove('casting');
        enemyNode.classList.remove('casting');

        const from = orbPoint(playerNode);
        const enemyFrom = orbPoint(enemyNode);
        const meet = { x: (from.x + enemyFrom.x) / 2, y: (from.y + enemyFrom.y) / 2 + 6 };

        // 2. Полёт. Оглушённый противник не отвечает — заклинание летит сразу в него.
        if (!event.enemy) {
            enemyNode.classList.add('stunned');
            const bolt = spawnBolt(event.player, from, bodyPoint(enemyNode), { duration: T.travel + T.follow });
            await bolt.done;
            if (stale(mine)) return;
            bolt.node.remove();
            burst(bodyPoint(enemyNode), ELEMENT[event.player].color, { size: 1.1 });
            enemyNode.classList.add('hurt');
            shake(false);
            land();
            damagePop(bodyPoint(enemyNode), event.damage, false);
            showCaption(event.phrase);
            haptic(14);
            tone(180, 110);
            await wait(T.meet + T.recover);
            if (stale(mine)) return;
            enemyNode.classList.remove('hurt', 'stunned');
            hideCaption();
            return;
        }

        const playerBolt = spawnBolt(event.player, from, meet, { big: isSuper });
        const enemyBolt = spawnBolt(event.enemy, enemyFrom, meet);
        await Promise.all([playerBolt.done, enemyBolt.done]);
        if (stale(mine)) return;

        // 3. Столкновение в центре: проигравшая стихия гаснет.
        showCaption(event.phrase);
        if (!victim) {
            burst(meet, '#94a3b8', { size: 0.9, sparks: 10 });
            playerBolt.node.remove();
            enemyBolt.node.remove();
            tone(150, 90, { type: 'triangle' });
            shake(false);
            land();
            await wait(T.meet + T.recover);
            if (stale(mine)) return;
            hideCaption();
            return;
        }

        const winnerBolt = victim === enemyNode ? playerBolt : enemyBolt;
        const loserBolt = victim === enemyNode ? enemyBolt : playerBolt;
        const winnerElement = victim === enemyNode ? event.player : event.enemy;

        burst(meet, ELEMENT[winnerElement].color, { size: isSuper ? 1.4 : 1 });
        loserBolt.node.remove();
        tone(ELEMENT[winnerElement].tone * 1.5, 80);
        await wait(T.meet);
        if (stale(mine)) return;

        // 4. Уцелевшее заклинание доходит до цели.
        const target = bodyPoint(victim);
        const current = winnerBolt.node.getBoundingClientRect();
        const box = root.getBoundingClientRect();
        const at = { x: current.left + current.width / 2 - box.left, y: current.top + current.height / 2 - box.top };
        await winnerBolt.node.animate(
            [
                { transform: `translate(${at.x}px, ${at.y}px) scale(1)`, opacity: 1 },
                { transform: `translate(${target.x}px, ${target.y}px) scale(${isSuper ? 1.5 : 1.2})`, opacity: 1 },
            ],
            { duration: T.follow / rate(), easing: 'ease-in', fill: 'forwards' },
        ).finished.catch(() => {});
        if (stale(mine)) return;
        winnerBolt.node.remove();

        burst(target, ELEMENT[winnerElement].color, { size: critical ? 1.5 : 1.1, sparks: critical ? 14 : 8 });
        victim.classList.add('hurt');
        shake(critical);
        land();
        damagePop(target, event.damage, critical);
        haptic(critical ? [22, 20, 34] : 14);
        tone(critical ? 110 : 170, critical ? 170 : 110);
        if (event.parry) {
            showCaption(event.phrase);
            tone(880, 130, { type: 'triangle' });
        }

        await wait(T.recover);
        if (stale(mine)) return;
        victim.classList.remove('hurt');
        hideCaption();
    }

    async function playKo(winner) {
        speed = pendingSpeed;
        const mine = generation;
        const loser = winner === 'player' ? enemyNode : playerNode;
        const victor = winner === 'player' ? playerNode : enemyNode;
        loser.classList.remove('hurt', 'stunned');
        loser.classList.add('down');
        victor.classList.add('victor');
        burst(bodyPoint(loser), winner === 'player' ? '#34d399' : '#f87171', { size: 2, sparks: 18 });
        shake(true);
        sweep(winner === 'player' ? 260 : 420, winner === 'player' ? 880 : 130, 420);
        haptic(winner === 'player' ? [26, 24, 40] : [60, 40, 80]);
        await wait(T.ko);
        return !stale(mine);
    }

    return {
        mount,
        resetPoses,
        setOrb,
        setPlayerElement: (element) => setOrb(playerNode, element),
        setSpeed: (value) => { pendingSpeed = value; if (!busy) speed = value; },
        getSpeed: () => pendingSpeed,
        abort,
        playClash,
        playKo,
        hideCaption,
    };
}
