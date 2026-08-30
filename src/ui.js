/** Отрисовка интерфейса. Ничего не решает — только показывает переданные данные. */

import { ELEMENT, ELEMENTS, WHEEL } from './rules.js';
import { COMBO_LIST, COMBO_NEEDS } from './combos.js';
import { elementGlyph } from './glyphs.js';
import { fighterSvg, applyPose } from './fighter.js';

export const $ = (id) => document.getElementById(id);

const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

/* ─────────────── Экраны ─────────────── */

export function showScreen(name) {
    document.querySelectorAll('[data-screen]').forEach((node) => {
        node.hidden = node.dataset.screen !== name;
    });
}

/* ─────────────── Колесо стихий ─────────────── */

export function renderWheel(node) {
    node.replaceChildren(
        ...WHEEL.map(({ winner, loser, reason }) => {
            const row = el('div', 'wheel-row');
            const win = el('span', 'wheel-glyph', ELEMENT[winner].glyph);
            const arrow = el('span', 'wheel-arrow', '▸');
            const lose = el('span', 'wheel-glyph', ELEMENT[loser].glyph);
            const why = el('span', 'wheel-reason');
            why.innerHTML = reason.replace(
                new RegExp(`^(${ELEMENT[winner].name})`, 'i'),
                '<b>$1</b>',
            );
            row.append(win, arrow, lose, why);
            return row;
        }),
    );
}

/* ─────────────── Кнопки стихий ─────────────── */

export function renderCastRow(node, onCast) {
    node.replaceChildren(
        ...ELEMENTS.map((id) => {
            const info = ELEMENT[id];
            const button = el('button', 'cast');
            button.dataset.element = id;
            button.type = 'button';
            // Только знак, без подписи: три стихии узнаются по форме и цвету
            // быстрее, чем читаются, а строка «бьёт ветер» на кнопке дублирует
            // колесо и делает из кнопки пункт меню. Что кого гасит, говорят
            // колесо рядом и заголовок кнопки для тех, кто ведёт мышью.
            const glyph = el('span', 'cast-glyph');
            glyph.insertAdjacentHTML('afterbegin', elementGlyph(id));
            button.append(glyph);
            button.title = `${info.name.toUpperCase()} — бьёт ${ELEMENT[info.beats].accusative}`;
            button.setAttribute('aria-label', button.title);
            button.addEventListener('click', () => onCast(id));
            return button;
        }),
    );
    return [...node.querySelectorAll('.cast')];
}

/* ─────────────── Слоты ─────────────── */

/**
 * Слоты цепочки. У игрока они разбиты на две группы, потому что правило
 * «узор задают первые три хода» существовало только в тексте: на поле все
 * пять слотов выглядели одинаково, и понять, где кончается узор, было
 * неоткуда. Теперь это видно рамкой с подписью, а не читается в подсказке.
 */
export function renderSlots(node, count, { window: windowSize = 0 } = {}) {
    const make = (n) => Array.from({ length: n }, () => el('div', 'slot', ''));
    if (!windowSize || windowSize >= count) {
        node.replaceChildren(...make(count));
    } else {
        const zone = el('div', 'slot-group slot-group--window');
        zone.dataset.label = 'УЗОР';
        zone.append(...make(windowSize));
        const rest = el('div', 'slot-group slot-group--free');
        rest.dataset.label = 'РАЗМЕН';
        rest.append(...make(count - windowSize));
        node.replaceChildren(zone, rest);
    }
    return [...node.querySelectorAll('.slot')];
}

export function setSlot(slot, { element, state, signature } = {}) {
    slot.className = 'slot';
    slot.textContent = element ? ELEMENT[element].glyph : '';
    if (element) slot.classList.add('filled');
    if (state) slot.classList.add(state);
    if (signature) {
        const mark = el('span', 'sig', '★');
        mark.title = 'коронка противника';
        slot.append(mark);
    }
}

export const clearSlots = (slots) => slots.forEach((slot) => setSlot(slot, {}));

/* ─────────────── Лог ─────────────── */

export function pushLog(node, text, kind = 'neutral') {
    if (!text) return;
    const line = el('div', `log-line ${kind}`, text);
    node.append(line);
    while (node.childElementCount > 60) node.firstElementChild.remove();
    node.scrollTop = node.scrollHeight;
}

/* ─────────────── Разведка: что противник уже показал ─────────────── */

/**
 * Коронку игрок вычисляет сам. Здесь только честные наблюдения — сколько раз
 * какую стихию противник действительно выбросил на глазах у игрока.
 */
export function renderSeen(node, seen, enemyRounds = []) {
    const total = ELEMENTS.reduce((sum, id) => sum + (seen[id] ?? 0), 0);

    const meters = ELEMENTS.map((id) => {
        const count = seen[id] ?? 0;
        const row = el('div', 'seen-row');
        const track = el('span', 'seen-track');
        const fill = el('span', 'seen-fill');
        fill.style.width = `${total ? ((count / total) * 100).toFixed(0) : 0}%`;
        fill.style.background = ELEMENT[id].color;
        track.append(fill);
        row.append(el('span', 'seen-glyph', ELEMENT[id].glyph), track, el('span', 'seen-count', String(count)));
        return row;
    });

    // Прошлый раунд целиком: без него не увидеть ни смену маски посреди
    // цепочки, ни подмену стихии в ярости.
    const last = enemyRounds.at(-1);
    const history = el('div', 'seen-last');
    if (last) {
        history.append(el('span', 'seen-last-label', 'ПРОШЛЫЙ РАУНД'));
        for (const element of last) {
            history.append(el('span', 'seen-cell', element ? ELEMENT[element].glyph : '·'));
        }
    }

    node.replaceChildren(...meters, ...(last ? [history] : []));
}

/* ─────────────── Полоски здоровья ─────────────── */

export function setHp(barNode, numNode, value, max) {
    const share = max > 0 ? Math.max(0, value) / max : 0;
    barNode.style.width = `${(share * 100).toFixed(1)}%`;
    if (numNode.textContent !== String(value)) {
        numNode.textContent = String(value);
        numNode.classList.remove('tick');
        void numNode.offsetWidth;
        numNode.classList.add('tick');
    }
}

export function setCharge(fill, label, wrap, value, cost) {
    fill.style.width = `${Math.min(100, (value / cost) * 100)}%`;
    label.textContent = `ЗАРЯД ${value}/${cost}`;
    wrap.classList.toggle('ready', value >= cost);
}

/* ─────────────── Обучение ─────────────── */

const demoCell = (element, verdict) => {
    const cell = el('div', `demo-cell ${verdict ?? ''}`.trim(), ELEMENT[element].glyph);
    cell.append(el('small', null, ELEMENT[element].name.toUpperCase()));
    return cell;
};

const clash = (winner, loser, note) => {
    const row = el('div', 'demo-line');
    row.append(demoCell(winner, 'win'), el('span', 'demo-verdict', '⚔'), demoCell(loser, 'lose'));
    if (note) row.append(el('span', 'demo-verdict', note));
    return row;
};

export const LEARN_STEPS = [
    {
        title: 'ТРИ СТИХИИ, ОДИН КРУГ',
        body: 'Каждая стихия гасит ровно одну другую — и проигрывает ровно одной. Ничего не нужно запоминать: правило можно вывести из здравого смысла.',
        build: () => {
            const box = el('div', 'demo-list');
            for (const { winner, loser, reason } of WHEEL) {
                const row = el('div', 'demo-line');
                row.append(demoCell(winner, 'win'), el('span', 'demo-verdict', '▸'), demoCell(loser, 'lose'),
                    el('span', 'demo-verdict', reason));
                box.append(row);
            }
            return box;
        },
    },
    {
        title: 'РАУНД — ЭТО ПЯТЬ ЗАКЛИНАНИЙ',
        body: 'Ты заранее набираешь цепочку из пяти стихий. Противник делает то же самое втайне. Потом обе цепочки вскрываются и разыгрываются слот за слотом. Победа в слоте — минус 1 здоровья противнику.',
        build: () => {
            const row = el('div', 'demo-row');
            ['water', 'fire', 'wind', 'water', 'fire'].forEach((id) => {
                const slot = el('div', 'slot filled', ELEMENT[id].glyph);
                slot.style.flex = '0 0 44px';
                row.append(slot);
            });
            return row;
        },
    },
    {
        title: 'У ПРОТИВНИКА ЕСТЬ КОРОНКА',
        body: 'Каждый маг чаще всего бьёт одной стихией — это его <b>коронка</b>. Никто её не назовёт: справа от арены копится разведка — сколько раз какую стихию он выбросил, — и вывод делаешь ты. Побьёшь коронку — получишь заряд, а раз за раунд ещё и <b>оглушишь</b> противника. Проиграешь коронке — <b>двойной урон</b>.',
        build: () => {
            const box = el('div', 'demo-list');
            box.append(clash('water', 'fire', 'коронка пробита → оглушение'));
            const bad = el('div', 'demo-line');
            bad.append(demoCell('fire', 'lose'), el('span', 'demo-verdict', '⚔'), demoCell('water', 'win'),
                el('span', 'demo-verdict', 'проигрыш коронке → −2'));
            box.append(bad);
            return box;
        },
    },
    {
        title: 'УЗОРЫ ВНУТРИ ЦЕПОЧКИ',
        body: 'Три подряд идущих слота могут сложиться в <b>узор</b>. Он подсвечивается, пока ты набираешь, — сюрпризом не будет. Но узор срабатывает только если ты выиграл нужное число обменов внутри него: это усиление успеха, а не замена ему. Противник ломает узор одним точным ударом внутрь, а не заливкой всей цепочки.',
        build: () => {
            const box = el('div', 'demo-list demo-list--combo');
            const shapes = {
                surge: ['fire', 'fire', 'fire'],
                bond: ['fire', 'water', 'fire'],
                prism: ['fire', 'water', 'wind'],
            };
            for (const combo of COMBO_LIST) {
                const row = el('div', 'demo-line');
                // Свой знак у каждого узора: имя запоминается хуже формы, а
                // на этом экране узор впервые и объясняется.
                const mark = el('img', 'demo-mark');
                mark.src = `./assets/mark-${combo.id}.webp`;
                mark.alt = '';
                mark.decoding = 'async';
                mark.width = 512;
                mark.height = 512;
                row.append(mark);
                for (const id of shapes[combo.id]) {
                    row.append(el('div', 'slot filled in-combo', ELEMENT[id].glyph));
                }
                const text = el('span', 'demo-verdict');
                const gain = [
                    combo.damage ? `+${combo.damage} урона` : '',
                    combo.charge ? `+${combo.charge} заряда` : '',
                ].filter(Boolean).join(' и ');
                // Цена одна для всех, поэтому в строке её нет: она сказана
                // один раз внизу, а не трижды подряд одними словами.
                text.innerHTML = `<b>${combo.name}</b> — ${combo.hint}: ${gain}`;
                row.append(text);
                box.append(row);
            }
            const hot = el('div', 'demo-line demo-line--wide');
            const hotMark = el('img', 'demo-mark');
            hotMark.src = './assets/mark-overheat.webp';
            hotMark.alt = '';
            hotMark.decoding = 'async';
            hotMark.width = 512;
            hotMark.height = 512;
            hot.append(hotMark, el('span', 'demo-verdict', 'ПЕРЕГРЕВ — четыре одинаковых в пятёрке бьют по тебе самому'));
            box.append(hot);

            const rule = el('p', 'demo-note demo-span');
            rule.textContent = `Правило одно: чем больше в тройке повторов, тем сильнее удар.`
                + ` Цена тоже одна — выиграть ${COMBO_NEEDS} обмена из 3 внутри узора.`
                + ` Но повторы противник читает, а четыре одинаковых в пятёрке бьют по тебе самому.`;
            box.append(rule);
            return box;
        },
    },
    {
        title: 'ПРИМАНКА — ГЛАВНАЯ ЛОВУШКА',
        body: 'Бить строго по коронке — очевидно, и противник это видит. Тогда он подмешивает <b>приманку</b>: стихию, которая гасит твой ожидаемый ответ. Спасение простое — иногда бросай <b>его же коронку</b>: против коронки будет ничья, а приманку она сожжёт.',
        build: () => {
            const box = el('div', 'demo-list');

            const line = (label, cells, note) => {
                const row = el('div', 'demo-line');
                row.append(el('span', 'demo-verdict', label));
                cells.forEach(([id, verdict]) => row.append(demoCell(id, verdict)));
                row.append(el('span', 'demo-verdict', note));
                return row;
            };

            box.append(
                el('span', 'demo-verdict demo-span', 'Коронка противника — 🔥 огонь. Очевидный ответ — 💧 вода.'),
                line('приманка:', [['wind', 'win'], ['water', 'lose']], 'ветер разгоняет твою воду'),
                line('ответ:', [['fire', 'win'], ['wind', 'lose']], 'его же огонь сжигает приманку'),
            );
            return box;
        },
    },
    {
        title: 'ЗАРЯД И СУПЕРУДАР',
        body: 'Каждая пробитая коронка даёт очко заряда. Три очка — и следующий выбранный тобой жест станет <b>суперударом</b>: он бьёт на 2, но если проиграет — эти 2 прилетят тебе. <b>Слот выбираешь ты</b>, и это важно: пылающий посох противник видит, и если ты бьёшь всегда в одно место — он это место закроет. Заряд переносится между боями кампании.',
        build: () => {
            const box = el('div', 'demo-stack');
            const bar = el('div', 'charge');
            bar.style.width = '220px';
            const fill = el('div', 'charge-fill');
            fill.style.width = '100%';
            bar.append(fill, el('span', 'charge-label', 'ЗАРЯД 3/3'));
            box.append(bar, el('span', 'demo-verdict', 'выигранный суперудар: −2 · сорванный: −2 тебе'));
            return box;
        },
    },
    {
        title: 'НЕ ПОВТОРЯЙСЯ',
        body: 'Противники помнят твои ходы двумя способами. Если одна стихия занимает больше половины истории — закрывают часть слотов контр-стихией. А на верхних ярусах помнят ещё и <b>по позициям</b>: если в третий слот ты раунд за раундом ставишь одно и то же, туда прилетит точный ответ. Ровное чередование — тоже узор.',
        build: () => {
            const box = el('div', 'demo-list demo-list--chain');
            const chain = (label, ids) => {
                const row = el('div', 'demo-line');
                row.append(el('span', 'demo-verdict', label));
                ids.forEach((id) => row.append(el('div', 'slot filled', ELEMENT[id].glyph)));
                return row;
            };
            box.append(
                chain('ты:', Array(5).fill('fire')),
                chain('он:', ['water', 'water', 'water', 'fire', 'wind']),
                el('span', 'demo-verdict demo-span', 'узор прочитан — часть слотов закрыта контр-стихией'),
                el('span', 'demo-verdict demo-span', 'лучшая защита — не иметь узора вообще'));
            return box;
        },
    },
];

export function renderLearnStep(cardNode, progressNode, index) {
    const step = LEARN_STEPS[index];
    const card = el('div', 'learn-card');
    card.append(el('h3', null, step.title));
    const body = el('p');
    body.innerHTML = step.body;
    card.append(body);
    if (step.build) card.append(step.build());
    cardNode.replaceWith(card);
    card.id = cardNode.id;

    progressNode.replaceChildren(
        ...LEARN_STEPS.map((_, i) => el('span', `learn-dot${i === index ? ' on' : ''}`)),
    );
    return card;
}

/* ─────────────── Меню режимов ─────────────── */

export function renderModes(node, modes, order, onPick) {
    node.replaceChildren(
        ...order.map((id) => {
            const mode = modes[id];
            const button = el('button', 'mbtn');
            button.dataset.mode = id;
            button.type = 'button';
            button.append(el('span', 'mbtn-name', mode.name), el('span', 'mbtn-note', mode.note));
            button.addEventListener('click', () => onPick(id));
            return button;
        }),
    );
}

/** Портрет бойца на сюжетном экране — в боевой стойке, а не столбом. */
/**
 * Портрет на экране знакомства.
 *
 * У противников кампании есть нарисованные портреты — с ними ярусы наконец
 * различаются в лицо. Всё остальное (свободный бой, обучение) обходится
 * рисованным бойцом, как раньше.
 *
 * Картинка грузится по требованию: все пять весят больше, чем вся игра, и
 * тянуть их на старте значит менять мгновенное открытие на красоту, которую
 * увидят через минуту. Если файл не доехал, на его место молча встаёт
 * рисованный боец — экран не должен оставаться пустым из-за картинки.
 */
export function renderPortrait(node, element, side, { art = null } = {}) {
    node.replaceChildren();
    node.classList.toggle('story-portrait--art', Boolean(art));
    if (!art) {
        node.insertAdjacentHTML('afterbegin', fighterSvg({ element, side }));
        applyPose(node, 'guard');
        return;
    }
    const img = el('img', 'portrait-art');
    // Не loading="lazy": экран знакомства до этого момента скрыт, и браузер
    // откладывает отложенную картинку в скрытом поддереве — портрет так и
    // оставался пустым. Отложенность здесь и не нужна: файл запрашивается
    // ровно тогда, когда этот ярус показывают.
    img.decoding = 'async';
    // Размеры оригинала — чтобы место под портрет было занято до загрузки и
    // текст под ним не прыгал.
    img.width = 512;
    img.height = 720;
    img.alt = '';
    img.addEventListener('error', () => renderPortrait(node, element, side));
    img.src = art;
    node.append(img);
}

/* ─────────────── Сюжетный трек ─────────────── */

export function renderStoryTrack(node, total, current) {
    node.replaceChildren(
        ...Array.from({ length: total }, (_, i) =>
            el('span', `story-pip${i < current ? ' done' : i === current ? ' now' : ''}`)),
    );
}
