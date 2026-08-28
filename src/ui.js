/** Отрисовка интерфейса. Ничего не решает — только показывает переданные данные. */

import { ELEMENT, ELEMENTS, WHEEL } from './rules.js';
import { COMBO_LIST } from './combos.js';
import { mageSvg } from './mage.js';

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
            button.append(
                el('span', 'cast-glyph', info.glyph),
                (() => {
                    const text = el('span', 'cast-text');
                    text.append(
                        el('span', 'cast-name', info.name.toUpperCase()),
                        el('span', 'cast-beats', `бьёт ${ELEMENT[info.beats].glyph} ${ELEMENT[info.beats].accusative}`),
                    );
                    return text;
                })(),
            );
            button.addEventListener('click', () => onCast(id));
            return button;
        }),
    );
    return [...node.querySelectorAll('.cast')];
}

/* ─────────────── Слоты ─────────────── */

export function renderSlots(node, count) {
    node.replaceChildren(...Array.from({ length: count }, () => el('div', 'slot', '')));
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

/* ─────────────── Статистика ─────────────── */

export function renderStats(node, wins) {
    node.replaceChildren(
        ...ELEMENTS.map((id) => {
            const cell = el('div', 'stat', ELEMENT[id].glyph);
            cell.append(el('b', null, String(wins[id] ?? 0)), el('small', null, 'побед'));
            return cell;
        }),
    );
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
    const row = el('div', 'demo-row');
    row.append(demoCell(winner, 'win'), el('span', 'demo-verdict', '⚔'), demoCell(loser, 'lose'));
    if (note) row.append(el('span', 'demo-verdict', note));
    return row;
};

export const LEARN_STEPS = [
    {
        title: 'ТРИ СТИХИИ, ОДИН КРУГ',
        body: 'Каждая стихия гасит ровно одну другую — и проигрывает ровно одной. Ничего не нужно запоминать: правило можно вывести из здравого смысла.',
        build: () => {
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '6px';
            for (const { winner, loser, reason } of WHEEL) {
                const row = el('div', 'demo-row');
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
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '8px';
            box.append(clash('water', 'fire', 'коронка пробита → оглушение'));
            const bad = el('div', 'demo-row');
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
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '8px';
            const shapes = {
                surge: ['fire', 'fire', 'fire'],
                pierce: ['water', 'fire', 'water'],
                prism: ['fire', 'water', 'wind'],
            };
            for (const combo of COMBO_LIST) {
                const row = el('div', 'demo-row');
                for (const id of shapes[combo.id]) {
                    const slot = el('div', 'slot filled in-combo', ELEMENT[id].glyph);
                    slot.style.flex = '0 0 38px';
                    row.append(slot);
                }
                const text = el('span', 'demo-verdict');
                text.innerHTML = `<b>${combo.name}</b> — ${combo.hint}. `
                    + (combo.damage ? `+${combo.damage} урона` : `+${combo.charge} заряда`)
                    + `, нужно ${combo.needs} победы из 3`;
                row.append(text);
                box.append(row);
            }
            return box;
        },
    },
    {
        title: 'ПРИМАНКА — ГЛАВНАЯ ЛОВУШКА',
        body: 'Бить строго по коронке — очевидно, и противник это видит. Тогда он подмешивает <b>приманку</b>: стихию, которая гасит твой ожидаемый ответ. Спасение простое — иногда бросай <b>его же коронку</b>: против коронки будет ничья, а приманку она сожжёт.',
        build: () => {
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '8px';

            const line = (label, cells, note) => {
                const row = el('div', 'demo-row');
                row.append(el('span', 'demo-verdict', label));
                cells.forEach(([id, verdict]) => row.append(demoCell(id, verdict)));
                row.append(el('span', 'demo-verdict', note));
                return row;
            };

            box.append(
                el('span', 'demo-verdict', 'Коронка противника — 🔥 огонь. Очевидный ответ — 💧 вода.'),
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
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '8px';
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
            const box = el('div', 'demo-row');
            box.style.flexDirection = 'column';
            box.style.gap = '6px';
            const spam = el('div', 'demo-row');
            spam.append(el('span', 'demo-verdict', 'ты:'));
            Array(5).fill('fire').forEach((id) => {
                const slot = el('div', 'slot filled', ELEMENT[id].glyph);
                slot.style.flex = '0 0 38px';
                spam.append(slot);
            });
            const answer = el('div', 'demo-row');
            answer.append(el('span', 'demo-verdict', 'он:'));
            ['water', 'water', 'water', 'fire', 'wind'].forEach((id) => {
                const slot = el('div', 'slot filled', ELEMENT[id].glyph);
                slot.style.flex = '0 0 38px';
                answer.append(slot);
            });
            box.append(spam, answer,
                el('span', 'demo-verdict', 'узор прочитан — часть слотов закрыта контр-стихией'),
                el('span', 'demo-verdict', 'лучшая защита — не иметь узора вообще'));
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

/** Портрет мага на сюжетном экране. */
export function renderPortrait(node, element, side) {
    node.replaceChildren();
    node.insertAdjacentHTML('afterbegin', mageSvg({ element, side }));
}

/* ─────────────── Сюжетный трек ─────────────── */

export function renderStoryTrack(node, total, current) {
    node.replaceChildren(
        ...Array.from({ length: total }, (_, i) =>
            el('span', `story-pip${i < current ? ' done' : i === current ? ' now' : ''}`)),
    );
}
