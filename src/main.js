/**
 * Сборка игры: экраны, сюжетная кампания и цикл боя.
 *
 * Здесь нет правил — они в engine.js и ai.js. Здесь нет анимации —
 * она в arena.js. Этот модуль только связывает одно с другим.
 */

import { ELEMENT, ELEMENTS } from './rules.js';
import { CHARGE_COST, armSuper, canArmSuper, createBattle, resolveRound } from './engine.js';
import { planEnemyRound } from './ai.js';
import { COMBO_LIST, findCombo, overheatOf } from './combos.js';
import { makeRng, pick } from './rng.js';
import { MODES, MODE_ORDER, SPARRING, STORY_MODE } from './modes.js';
import {
    CAMPAIGN, EPILOGUE, PLAYER_MAX_HP, PROLOGUE,
    campaignScore, healAfterWin, isFinalTier, opponentAt,
} from './campaign.js';
import { createArena } from './arena.js';
import { haptic, sweep, tone, wakeAudioOnInteraction } from './audio.js';
import {
    $, LEARN_STEPS, clearSlots, pushLog, renderCastRow, renderLearnStep, renderModes,
    renderPortrait, renderSeen, renderSlots, renderStats, renderStoryTrack, renderWheel,
    setCharge, setHp, setSlot, showScreen,
} from './ui.js';

/* ─────────────────────────── Ссылки на DOM ─────────────────────────── */

const dom = {
    menuWheel: $('menu-wheel'), battleWheel: $('battle-wheel'), leaders: $('leaders'),
    modeGrid: $('mode-grid'),
    learnCard: $('learn-card'), learnProgress: $('learn-progress'), learnPrev: $('learn-prev'), learnNext: $('learn-next'),
    storyTier: $('story-tier'), storyName: $('story-name'), storyPortrait: $('story-portrait'),
    storyText: $('story-text'), storyHint: $('story-hint'), storyTrack: $('story-track'), storyGo: $('story-go'),
    playerName: $('player-name'), enemyName: $('enemy-name'),
    playerHpBar: $('player-hp-bar'), playerHpNum: $('player-hp-num'),
    enemyHpBar: $('enemy-hp-bar'), enemyHpNum: $('enemy-hp-num'),
    hudTier: $('hud-tier'), hudRound: $('hud-round'),
    arena: $('arena'), fxLayer: $('fx-layer'), caption: $('caption'), intel: $('intel'),
    fighterPlayer: $('fighter-player'), fighterEnemy: $('fighter-enemy'),
    board: document.querySelector('.board'),
    playerSlots: $('player-slots'), enemySlots: $('enemy-slots'),
    chargeFill: $('charge-fill'), chargeLabel: $('charge-label'), charge: document.querySelector('.charge'),
    comboTag: $('combo-tag'),
    castRow: $('cast-row'), btnUndo: $('btn-undo'), btnGo: $('btn-go'), btnSuper: $('btn-super'),
    timer: $('timer'), timerNum: $('timer-num'), timerFill: $('timer-fill'),
    log: $('log'), stats: $('stats'),
    overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'), overlayActions: $('overlay-actions'),
    btnSpeed: $('btn-speed'), btnRules: $('btn-rules'), btnQuit: $('btn-quit'),
    notice: $('notice'),
};

const arena = createArena({
    root: dom.arena,
    fxLayer: dom.fxLayer,
    caption: dom.caption,
    playerNode: dom.fighterPlayer,
    enemyNode: dom.fighterEnemy,
});

/* ─────────────────────────── Состояние приложения ─────────────────────────── */

const SPEEDS = [
    { key: 'normal', mul: 1, label: 'НОРМА' },
    { key: 'fast', mul: 2, label: 'БЫСТРО' },
    { key: 'instant', mul: 0, label: 'БЕЗ АНИМАЦИИ' },
];

const app = {
    mode: MODES.easy,
    opponent: null,
    battle: null,
    seq: [],
    playerSlots: [],
    enemySlots: [],
    running: false,
    timerId: null,
    timeLeft: 0,
    rng: makeRng((Date.now() ^ 0x5f3a) >>> 0),
    speedIndex: 0,
    shownWins: null,
    superPending: false,
    superSlotIndex: null,
    learnStep: 0,
    learnReturn: 'menu',
    story: null,
    startedAt: 0,
};

/* ─────────────────────────── Таблица лидеров ─────────────────────────── */

// Ключ таблицы рекордов и слаг аналитики остаются прежними: под ними уже
// лежат счета и события. Переименование игры — это про название, а не про
// хранилище, и менять его значило бы обнулить чужие результаты.
const LEADERBOARD_GAME = 'knb-2';
let leaderboardToken = '';
let leaderboardIssue = '';

async function loadLeaderboard() {
    try {
        const data = await fetch(`/api/leaderboard/scores?game=${LEADERBOARD_GAME}&limit=3`).then((r) => r.json());
        const top = data.scores?.map((e, i) => `${i + 1}. ${e.nickname} ${e.score}`).join(' · ');
        dom.leaders.textContent = `ГЛОБАЛЬНЫЙ ТОП: ${top || '—'}`;
    } catch { /* оффлайн — просто нет таблицы */ }
}

/**
 * Заход за токеном на запись результата.
 *
 * Молчать про неудачу нельзя, но и говорить о ней сразу не стоит: игрок
 * только начал бой, отправлять ещё нечего, и предупреждение выглядело бы
 * шумом. Поэтому причину запоминаем и показываем в тот момент, когда
 * результат действительно должен был уйти.
 */
async function beginLeaderboard() {
    leaderboardToken = '';
    leaderboardIssue = '';
    try {
        const response = await fetch('/api/leaderboard/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: LEADERBOARD_GAME }),
        });
        if (!response.ok) {
            // 429 приходит на 12 сессий в минуту с адреса: быстрые рестарты
            // выключали зачёт на весь заход, и об этом никто не узнавал.
            leaderboardIssue = response.status === 429
                ? 'СЛИШКОМ ЧАСТЫЕ ПЕРЕЗАПУСКИ — ЗАХОД НЕ ЗАСЧИТЫВАЕТСЯ. ПОДОЖДИ МИНУТУ'
                : 'ТАБЛИЦА РЕКОРДОВ НЕДОСТУПНА — РЕЗУЛЬТАТ НЕ ЗАСЧИТАЕТСЯ';
            return;
        }
        const data = await response.json();
        leaderboardToken = data.token || '';
    } catch {
        leaderboardIssue = 'ТАБЛИЦА РЕКОРДОВ НЕДОСТУПНА — РЕЗУЛЬТАТ НЕ ЗАСЧИТАЕТСЯ';
    }
}

const leaderboardDay = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

/**
 * Имя для таблицы рекордов.
 *
 * Если человек уже вошёл на сайте — берём ник из общего сервиса аккаунтов и
 * ничего не спрашиваем: на телефоне и на компьютере это будет один и тот же
 * игрок. Если не вошёл — прежний диалог на шесть символов.
 *
 * Вход нигде не обязателен и ничего не загораживает: гость играет и попадает
 * в таблицу ровно как раньше. Пустая строка означает, что имени взять негде
 * (локальная разработка без обвязки сайта) — тогда отправки просто не будет.
 */
async function resolvePlayerName() {
    try {
        const me = await fetch('/api/auth/me').then((r) => r.json());
        if (me.authenticated && me.nickname) return me.nickname;
    } catch { /* сервис аккаунтов недоступен — спрашиваем имя как обычно */ }
    if (typeof window.requestPlayerName !== 'function') return '';
    return (await window.requestPlayerName()) || '';
}

async function submitLeaderboard(score) {
    hideNotice();
    const dailyKey = `${LEADERBOARD_GAME}-daily-best:${leaderboardDay()}`;
    const dailyBest = Number(localStorage.getItem(dailyKey) || 0);
    if (score <= 0 || score <= dailyBest) { leaderboardToken = ''; return; }
    if (!leaderboardToken) {
        // Токена нет — либо заход уже отправил результат, либо его не выдали.
        // Во втором случае игрок узнаёт причину здесь, а не остаётся ни с чем.
        if (leaderboardIssue) showNotice(leaderboardIssue);
        return;
    }
    const token = leaderboardToken;
    try {
        const nickname = await resolvePlayerName();
        if (!nickname) return;
        const response = await fetch('/api/leaderboard/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, nickname, score }),
        });
        if (!response.ok) throw Object.assign(new Error(`leaderboard ${response.status}`), { status: response.status });
        // Отметка «лучшее за сегодня» ставится только после подтверждения сервера.
        // Иначе одна сетевая осечка затыкала бы отправку до конца суток: результат
        // уже считался бы рекордом дня, хотя в таблицу он не попал.
        localStorage.setItem(dailyKey, String(score));
        leaderboardToken = '';
        await loadLeaderboard();
    } catch (error) {
        // Молчать здесь нельзя — потерянный результат должен быть виден там,
        // где игрок в этот момент смотрит: на итоге боя, а не в меню.
        // И сказать надо по делу: обещать повтор там, где его не будет, —
        // такое же враньё, как молчание.
        const { text, keepToken } = submitFailure(error.status);
        if (!keepToken) leaderboardToken = '';
        showNotice(text);
    }
}

/**
 * Что случилось с отправкой и стоит ли беречь токен.
 *
 * Сервер отвечает не только сетевыми сбоями. Он гасит сессию при успешной
 * записи в одной транзакции со счётом, поэтому после осечки токен честно
 * остаётся годным — но не при любом отказе:
 *
 *   сеть, 5xx  осечка: повтор имеет смысл
 *   422        бой короче минимума, а он считается от начала захода —
 *              значит следующая попытка будет длиннее и может пройти
 *   409        сессия использована или истекла: этим токеном уже ничего не добиться
 *   400        сервер не принял счёт или имя
 */
function submitFailure(status) {
    if (status === 422) {
        return { keepToken: true, text: 'БОЙ СЛИШКОМ КОРОТКИЙ ДЛЯ ТАБЛИЦЫ. СЛЕДУЮЩАЯ ПОБЕДА ЗАСЧИТАЕТСЯ' };
    }
    if (status === 409) {
        return { keepToken: false, text: 'ЗАХОД ИСТЁК — РЕЗУЛЬТАТ НЕ ЗАСЧИТАН. НАЧНИ НОВЫЙ' };
    }
    if (status >= 400 && status < 500) {
        return { keepToken: false, text: 'СЕРВЕР НЕ ПРИНЯЛ РЕЗУЛЬТАТ' };
    }
    return { keepToken: true, text: 'РЕЗУЛЬТАТ НЕ УШЁЛ В ТАБЛИЦУ: СЕТЬ. СЛЕДУЮЩАЯ ПОБЕДА ПОПРОБУЕТ СНОВА' };
}

/**
 * Сообщение поверх любого экрана.
 *
 * Строка глобального топа для этого не годится: она живёт в меню, а отправка
 * результата случается в конце боя, когда на экране итог. Написанное туда
 * игрок не увидит вовсе или увидит спустя время и не поймёт, к чему это.
 */
function showNotice(text) {
    dom.notice.textContent = text;
    dom.notice.hidden = false;
}

const hideNotice = () => { dom.notice.hidden = true; };

/* ─────────────────────────── Скорость анимации ─────────────────────────── */

function loadSpeed() {
    const saved = localStorage.getItem('knb-speed');
    const index = SPEEDS.findIndex((s) => s.key === saved);
    app.speedIndex = index >= 0 ? index : 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && index < 0) {
        app.speedIndex = SPEEDS.length - 1;
    }
    applySpeed();
}

function applySpeed() {
    const { mul, label } = SPEEDS[app.speedIndex];
    dom.btnSpeed.textContent = `СКОРОСТЬ: ${label}`;
    const boosted = mul === 0 ? 0 : app.mode?.reveal === 'instant' ? mul * 2.5 : mul;
    arena.setSpeed(boosted);
    document.documentElement.style.setProperty('--speed', String(boosted || 1));
}

function cycleSpeed() {
    app.speedIndex = (app.speedIndex + 1) % SPEEDS.length;
    localStorage.setItem('knb-speed', SPEEDS[app.speedIndex].key);
    applySpeed();
}

/* ─────────────────────────── Навигация по экранам ─────────────────────────── */

function goMenu() {
    stopTimer();
    arena.abort();
    app.story = null;
    hideOverlay();
    showScreen('menu');
}

function goModes() { showScreen('modes'); }

function goLearn(returnTo = 'menu') {
    app.learnReturn = returnTo;
    app.learnStep = 0;
    paintLearn();
    showScreen('learn');
}

function paintLearn() {
    dom.learnCard = renderLearnStep(dom.learnCard, dom.learnProgress, app.learnStep);
    dom.learnPrev.textContent = app.learnStep === 0 ? 'ЗАКРЫТЬ' : 'НАЗАД';
    dom.learnNext.textContent = app.learnStep === LEARN_STEPS.length - 1 ? 'ПОНЯТНО' : 'ДАЛЬШЕ';
}

/* ─────────────────────────── Кампания ─────────────────────────── */

function startStory() {
    app.story = {
        index: 0,
        hp: PLAYER_MAX_HP,
        charge: 0,
        wins: { fire: 0, water: 0, wind: 0 },
        prologueSeen: false,
    };
    void beginLeaderboard();
    window.umami?.track('game-start', { game: LEADERBOARD_GAME, difficulty: 'story' });
    showPrologue();
}

function showPrologue() {
    dom.storyTier.textContent = 'БАШНЯ ТРЁХ СТИХИЙ';
    dom.storyName.textContent = 'ПРОЛОГ';
    renderPortrait(dom.storyPortrait, 'water', 'player');
    dom.storyText.textContent = PROLOGUE;
    dom.storyHint.textContent = `Впереди ${CAMPAIGN.length} ярусов. Здоровье переносится между боями, после победы возвращается часть.`;
    renderStoryTrack(dom.storyTrack, CAMPAIGN.length, 0);
    dom.storyGo.textContent = 'НАЧАТЬ ВОСХОЖДЕНИЕ';
    dom.storyGo.onclick = () => showTier(0);
    showScreen('story');
}

function showTier(index) {
    const opponent = opponentAt(index);
    if (!opponent) { showEpilogue(); return; }
    app.story.index = index;
    dom.storyTier.textContent = opponent.tier;
    dom.storyName.textContent = opponent.name;
    renderPortrait(dom.storyPortrait, opponent.element, 'enemy');
    dom.storyText.textContent = `«${opponent.intro}»`;
    dom.storyHint.textContent = opponent.teaches;
    renderStoryTrack(dom.storyTrack, CAMPAIGN.length, index);
    dom.storyGo.textContent = 'В БОЙ';
    dom.storyGo.onclick = () => startBattle({
        opponent,
        mode: { ...STORY_MODE, slots: opponent.slots, timer: opponent.timer },
        playerHp: app.story.hp,
        charge: app.story.charge,
        wins: app.story.wins,
        tierLabel: `${opponent.tier} · ${opponent.title}`,
    });
    showScreen('story');
}

function showEpilogue() {
    dom.storyTier.textContent = 'ВЕРШИНА';
    dom.storyName.textContent = 'БАШНЯ ПРОЙДЕНА';
    renderPortrait(dom.storyPortrait, 'wind', 'player');
    dom.storyText.textContent = EPILOGUE;
    dom.storyHint.textContent = `Осталось здоровья: ${app.story.hp}/${PLAYER_MAX_HP}.`;
    renderStoryTrack(dom.storyTrack, CAMPAIGN.length, CAMPAIGN.length);
    dom.storyGo.textContent = 'В МЕНЮ';
    dom.storyGo.onclick = goMenu;

    window.umami?.track('game-finish', {
        game: LEADERBOARD_GAME, difficulty: 'story', result: 'clear',
        tier: CAMPAIGN.length, tier_id: 'summit',
        duration_seconds: Math.round((Date.now() - app.startedAt) / 1000),
    });
    void submitLeaderboard(campaignScore({
        tierIndex: CAMPAIGN.length, cleared: true, hp: app.story.hp, wins: app.story.wins,
    }));
    sweep(240, 900, 620);
    showScreen('story');
}

/* ─────────────────────────── Свободный бой ─────────────────────────── */

function startFreeBattle(modeId) {
    const mode = MODES[modeId];
    const opponent = SPARRING[pick(ELEMENTS, app.rng)];
    app.story = null;
    void beginLeaderboard();
    window.umami?.track('game-start', { game: LEADERBOARD_GAME, difficulty: modeId });
    startBattle({
        opponent,
        mode,
        playerHp: PLAYER_MAX_HP,
        charge: 0,
        wins: { fire: 0, water: 0, wind: 0 },
        tierLabel: `СВОБОДНЫЙ БОЙ · ${mode.name}`,
    });
}

/* ─────────────────────────── Бой ─────────────────────────── */

function startBattle({ opponent, mode, playerHp, charge, wins, tierLabel }) {
    app.mode = mode;
    app.opponent = opponent;
    app.battle = createBattle({
        opponent,
        slots: mode.slots ?? 5,
        playerHp,
        playerMaxHp: PLAYER_MAX_HP,
        charge,
    });
    app.battle.wins = { ...wins };
    app.startedAt = app.startedAt || Date.now();
    if (!app.story) app.startedAt = Date.now();

    dom.hudTier.textContent = tierLabel;
    dom.playerName.textContent = 'ТЫ';
    dom.enemyName.textContent = opponent.name;
    dom.board.classList.toggle('duel', app.battle.slots === 1);

    app.playerSlots = renderSlots(dom.playerSlots, app.battle.slots);
    app.enemySlots = renderSlots(dom.enemySlots, app.battle.slots);
    dom.log.replaceChildren();
    arena.mount({ playerElement: 'water', enemyElement: opponent.element });
    applySpeed();

    pushLog(dom.log, `${opponent.name} — ${opponent.title}.`, 'system');
    pushLog(dom.log, opponent.teaches ?? 'Коронку противника придётся вычислить по бою.', 'neutral');
    pushLog(dom.log, 'Полоса над ареной помнит за тебя: сколько раз какую стихию он выбросил и чем бил в прошлом раунде.', 'neutral');

    hideNotice();
    hideOverlay();
    showScreen('battle');
    paintAll();
    beginRound();
}

function beginRound() {
    app.seq = [];
    clearSlots(app.playerSlots);
    clearSlots(app.enemySlots);
    arena.resetPoses();
    arena.hideCaption();
    paintCombo();
    dom.hudRound.textContent = `РАУНД ${app.battle.round}`;
    paintIntel();
    setControlsEnabled(true);
    startTimer(app.mode.timer ?? 15);
}

/** Разведка: только то, что противник показал на глазах у игрока. */
function paintIntel() {
    renderSeen(dom.intel, app.battle.seen, app.battle.enemyRounds);
}

function paintAll(snapshot) {
    const b = app.battle;
    const hp = snapshot?.hp ?? b.hp;
    const charge = snapshot?.charge ?? b.charge;
    setHp(dom.playerHpBar, dom.playerHpNum, hp.player, b.maxHp.player);
    setHp(dom.enemyHpBar, dom.enemyHpNum, hp.enemy, b.maxHp.enemy);
    setCharge(dom.chargeFill, dom.chargeLabel, dom.charge, charge, CHARGE_COST);
    renderStats(dom.stats, app.shownWins ?? b.wins);
    renderSeen(dom.intel, b.seen, b.enemyRounds);

    // Три состояния кнопки: заряд готов, ждём выбора слота, слот назначен.
    const ready = canArmSuper(b) && !app.running;
    dom.btnSuper.disabled = !ready;
    dom.btnSuper.classList.toggle('ready', ready);
    dom.btnSuper.classList.toggle('picking', app.superPending);
    dom.btnSuper.textContent = app.superPending ? 'ВЫБЕРИ ЖЕСТ'
        : app.superSlotIndex !== null ? `СУПЕР → ${app.superSlotIndex + 1}`
            : 'СУПЕР';
}

/* ── Ввод ── */

function castElement(id) {
    if (app.running || app.battle.outcome) return;
    if (app.seq.length >= app.battle.slots) return;
    app.seq.push(id);
    const index = app.seq.length - 1;
    setSlot(app.playerSlots[index], { element: id, state: 'filled' });
    if (app.superPending) {
        app.superPending = false;
        app.superSlotIndex = index;
        markSuperSlot();
        paintAll();
    }
    paintCombo();
    // Вспышка стихии на самой кнопке: удар должен чувствоваться в пальце,
    // а не только на арене.
    const button = document.querySelector(`.cast[data-element="${id}"]`);
    button?.classList.remove('struck');
    void button?.offsetWidth;
    button?.classList.add('struck');
    arena.setPlayerElement(id);
    tone(ELEMENT[id].tone, 55);
    haptic(8);
    if (app.seq.length === app.battle.slots) void runRound();
}

function undoCast() {
    if (app.running || app.seq.length === 0) return;
    app.seq.pop();
    setSlot(app.playerSlots[app.seq.length], {});
    if (app.superSlotIndex === app.seq.length) {
        // Заряд ещё не потрачен — возвращаем возможность выбрать другой слот.
        app.superSlotIndex = null;
        app.superPending = true;
        paintAll();
    }
    markSuperSlot();
    paintCombo();
    haptic(6);
}

/**
 * Суперудар взводится не на первый обмен, а на слот по выбору игрока:
 * пылающий посох противник видит, и один и тот же слот он выучит.
 */
function useSuper() {
    if (app.running || !canArmSuper(app.battle)) return;

    if (app.superPending || app.superSlotIndex !== null) {
        app.superPending = false;
        clearSuperMark();
        app.superSlotIndex = null;
        pushLog(dom.log, 'Суперудар снят.', 'system');
        paintAll();
        return;
    }

    app.superPending = true;
    sweep(200, 700, 260);
    haptic([18, 22, 30]);
    pushLog(dom.log, 'Заряд готов. Следующий выбранный жест станет суперударом — реши, в какой момент цепочки он ударит.', 'system');
    paintAll();
}

/**
 * Подсветка складывающегося узора. Игрок должен видеть его, пока набирает
 * цепочку: узор — это решение, а не сюрприз по итогам раунда.
 */
function paintCombo() {
    app.playerSlots.forEach((slot) => slot.classList.remove('in-combo', 'combo-missed', 'overheating'));
    const found = findCombo(app.seq);
    const hot = overheatOf(app.seq);

    // Перегрев важнее узора: он уже случится, а узор ещё надо выиграть.
    if (hot) {
        app.seq.forEach((element, i) => {
            if (element === hot.element) app.playerSlots[i]?.classList.add('overheating');
        });
        dom.comboTag.classList.remove('armed');
        dom.comboTag.classList.add('hot');
        const name = document.createElement('b');
        name.textContent = 'ПЕРЕГРЕВ';
        const why = document.createElement('i');
        why.textContent = `${hot.count} одинаковых — отдача ${hot.damage} по тебе`;
        dom.comboTag.replaceChildren(name, why);
        return;
    }
    dom.comboTag.classList.remove('hot');

    dom.comboTag.classList.toggle('armed', Boolean(found));
    if (!found) {
        // Пустая подсказка означала, что об узорах игрок узнаёт только случайно.
        const hint = document.createElement('i');
        hint.textContent = app.seq.length < 3
            ? 'три подряд складываются в узор'
            : 'узора нет — три подряд дают ВАЛ, ПРОБОЙ или ПРИЗМУ';
        dom.comboTag.replaceChildren(hint);
        return;
    }
    found.slots.forEach((i) => app.playerSlots[i]?.classList.add('in-combo'));
    const { combo } = found;
    const need = document.createElement('i');
    need.textContent = `нужно побед: ${combo.needs} из 3`;
    const name = document.createElement('b');
    name.textContent = combo.name;
    dom.comboTag.replaceChildren(name, need);
}

function clearSuperMark() {
    app.playerSlots.forEach((slot) => slot.classList.remove('super-armed'));
}

function markSuperSlot() {
    clearSuperMark();
    if (app.superSlotIndex !== null) {
        app.playerSlots[app.superSlotIndex]?.classList.add('super-armed');
    }
}

/* ── Таймер ── */

function startTimer(seconds) {
    stopTimer();
    app.timeLeft = seconds;
    paintTimer();
    app.timerId = setInterval(() => {
        app.timeLeft -= 1;
        paintTimer();
        if (app.timeLeft <= 0) { stopTimer(); void runRound(); }
    }, 1000);
}

function stopTimer() {
    if (app.timerId) clearInterval(app.timerId);
    app.timerId = null;
}

function paintTimer() {
    const left = Math.max(0, app.timeLeft);
    dom.timerNum.textContent = String(left);
    // Полоса показывает остаток целиком: цифру надо прочитать, полосу — нет.
    const total = app.mode?.timer ?? 15;
    dom.timerFill.style.width = `${Math.min(100, (left / total) * 100)}%`;
    dom.timer.classList.toggle('urgent', left <= 5);
}

function setControlsEnabled(on) {
    document.querySelectorAll('.cast').forEach((b) => { b.disabled = !on; });
    dom.btnUndo.disabled = !on;
    dom.btnGo.disabled = !on;
    dom.btnSuper.disabled = !on || !canArmSuper(app.battle);
}

/* ── Раунд ── */

async function runRound() {
    if (app.running || !app.battle || app.battle.outcome) return;
    app.running = true;
    stopTimer();
    setControlsEnabled(false);

    // Пустые слоты добираются случайно — таймер не должен щадить.
    while (app.seq.length < app.battle.slots) {
        const id = pick(ELEMENTS, app.rng);
        setSlot(app.playerSlots[app.seq.length], { element: id, state: 'filled' });
        app.seq.push(id);
    }

    // Заряд тратится только сейчас: до броска отмена ничего не стоит.
    if (app.superSlotIndex !== null) app.battle = armSuper(app.battle, app.superSlotIndex);
    app.superPending = false;

    const { plan, counteredElement, punishing, rhythmSlots, defendedSlot } = planEnemyRound(app.battle, app.rng);
    if (defendedSlot !== null) {
        pushLog(dom.log, `${app.opponent.name} видит заряженный посох и ждёт удара в слот ${defendedSlot + 1}.`, 'system');
    }
    // Игрок должен понимать, почему его вдруг начали ловить, — иначе
    // адаптивный ИИ читается как «рандом стал злее».
    if (rhythmSlots.length) {
        const slots = rhythmSlots.map((i) => i + 1).join(', ');
        pushLog(dom.log, `${app.opponent.name} поймал твой ритм: он знает, что ты ставишь в слоты ${slots}. Сломай привычку.`, 'system');
    } else if (counteredElement) {
        pushLog(dom.log, `${app.opponent.name} разгадал узор: слишком много ${ELEMENT[counteredElement].genitive}. Часть слотов закрыта контр-стихией.`, 'system');
    } else if (punishing) {
        pushLog(dom.log, `${app.opponent.name} заметил, что ты бьёшь строго по коронке, и ставит приманки под твой ответ.`, 'system');
    }

    app.shownWins = { ...app.battle.wins };
    const { state, events } = resolveRound(app.battle, [...app.seq], plan);
    app.battle = state;

    await playEvents(events, plan);
    app.shownWins = null;
    paintAll();

    app.running = false;
    if (app.battle.outcome) { finishBattle(app.battle.outcome); return; }
    beginRound();
}

async function playEvents(events, plan) {
    for (const event of events) {
        if (event.type === 'clash') {
            const pSlot = app.playerSlots[event.index];
            const eSlot = app.enemySlots[event.index];
            pSlot.classList.add('now');
            eSlot.classList.add('now');
            setSlot(eSlot, {
                element: plan[event.index].element,
                state: 'now',
                signature: plan[event.index].signature,
            });

            await arena.playClash(event, { onImpact: applyImpact });

            pSlot.classList.remove('now');
            setSlot(pSlot, { element: event.player, state: slotStateFor(event, 'player') });
            setSlot(eSlot, {
                element: plan[event.index].element,
                state: slotStateFor(event, 'enemy'),
                signature: plan[event.index].signature,
            });
        } else if (event.type === 'combo') {
            for (const i of event.slots) {
                app.playerSlots[i]?.classList.toggle('in-combo', !event.fired);
                if (event.fired) app.playerSlots[i]?.classList.add('combo-fired');
            }
            pushLog(dom.log, event.phrase, event.fired ? 'system' : 'neutral');
            if (event.fired) {
                paintAll({ hp: event.hp, charge: app.battle.charge });
                await arena.playCombo(event);
            } else {
                // Осечку тоже показываем на арене: узор складывается почти
                // каждый раунд, а срабатывает втрое реже, и молчание в две
                // трети случаев читается как случайность, а не как правило.
                for (const i of event.slots) app.playerSlots[i]?.classList.add('combo-missed');
                await arena.playComboMiss(event);
            }
        } else if (event.type === 'overheat') {
            for (const [i, element] of app.seq.entries()) {
                if (element === event.element) app.playerSlots[i]?.classList.add('overheating');
            }
            pushLog(dom.log, `${event.phrase} −${event.damage}`, 'enemy');
            paintAll({ hp: event.hp, charge: app.battle.charge });
            await arena.playOverheat(event);
        } else if (event.type === 'ko') {
            await arena.playKo(event.winner);
        } else if (event.type === 'round-end') {
            if (app.mode.log === 'summary') {
                pushLog(dom.log, `Итог раунда: ты −${event.dealt.player}, ${app.opponent.name} −${event.dealt.enemy}.`, 'system');
            }
        }
    }
}

const SLOT_STATE = {
    win: ['win', 'lose'],
    stun: ['stun', 'stun'],
    'super-hit': ['super', 'lose'],
    'super-fail': ['crit', 'super'],
    'super-fizzle': ['super', 'draw'],
    crit: ['crit', 'win'],
    lose: ['lose', 'win'],
    draw: ['draw', 'draw'],
};

const slotStateFor = (event, side) =>
    (SLOT_STATE[event.outcome] ?? ['draw', 'draw'])[side === 'player' ? 0 : 1];

/** Момент, когда урон долетел: обновляем цифры и лог ровно в кадр удара. */
function applyImpact(event) {
    if (event.target === 'enemy' && app.shownWins) app.shownWins[event.player] += 1;
    paintAll({ hp: event.hp, charge: event.charge });
    if (app.mode.log === 'summary') return;
    const kind = event.target === 'enemy' ? 'player' : event.target === 'player' ? 'enemy' : 'neutral';
    const hidden = app.mode.log === 'muted';
    const amount = hidden || !event.damage ? '' : ` −${event.damage}`;
    pushLog(dom.log, `${event.phrase}${amount}`, event.outcome === 'stun' || event.parry ? 'system' : kind);
}

/* ── Конец боя ── */

function finishBattle(winner) {
    stopTimer();
    setControlsEnabled(false);
    const won = winner === 'player';

    if (app.story) {
        if (won) {
            app.story.wins = { ...app.battle.wins };
            app.story.charge = app.battle.charge;
            const last = isFinalTier(app.story.index);
            app.story.hp = last ? app.battle.hp.player : healAfterWin(app.battle.hp.player);
            // Взятый ярус — отдельное событие, иначе воронка состоит из двух точек
            // (начал и совсем закончил) и середина подъёма не видна вовсе.
            window.umami?.track('tier-cleared', {
                game: LEADERBOARD_GAME, tier: app.story.index + 1, tier_id: app.opponent.id,
                hp_left: app.story.hp,
            });
            showOverlay({
                title: 'ЯРУС ВЗЯТ',
                color: 'var(--win)',
                text: `«${app.opponent.defeat}»\n${app.opponent.reveal ?? ''}${last ? '' : `\nЗдоровье восстановлено до ${app.story.hp}.`}`,
                actions: last
                    ? [{ label: 'ФИНАЛ', primary: true, onClick: showEpilogue }]
                    : [{ label: 'ДАЛЬШЕ', primary: true, onClick: () => showTier(app.story.index + 1) }],
            });
        } else {
            // Ярус обязателен: без него неизвестно, обо что игроки убиваются,
            // и баланс пришлось бы править на ощущение. Победный ярус пишется
            // тем же именем, чтобы обе стороны воронки сравнивались напрямую.
            window.umami?.track('game-finish', {
                game: LEADERBOARD_GAME, difficulty: 'story', result: 'loss',
                tier: app.story.index + 1, tier_id: app.opponent.id,
                duration_seconds: Math.round((Date.now() - app.startedAt) / 1000),
            });
            void submitLeaderboard(campaignScore({
                tierIndex: app.story.index, cleared: false, hp: 0, wins: app.battle.wins,
            }));
            const retryHp = app.story.hp;
            showOverlay({
                title: 'ПОРАЖЕНИЕ',
                color: 'var(--lose)',
                text: `${app.opponent.name} устоял.\n${app.opponent.reveal ?? ''}\n${app.opponent.teaches}`,
                actions: [
                    { label: 'ПОВТОРИТЬ ЯРУС', primary: true, onClick: () => { app.story.hp = retryHp; showTier(app.story.index); } },
                    { label: 'ПРАВИЛА', onClick: () => goLearn('story') },
                    { label: 'В МЕНЮ', onClick: goMenu },
                ],
            });
        }
        return;
    }

    window.umami?.track('game-finish', {
        game: LEADERBOARD_GAME, difficulty: app.mode.id, result: won ? 'win' : 'loss',
        duration_seconds: Math.round((Date.now() - app.startedAt) / 1000),
    });
    if (won) {
        const gestures = Object.values(app.battle.wins).reduce((a, b) => a + b, 0);
        void submitLeaderboard(1000 + app.battle.hp.player * 100 + gestures * 10);
    }
    showOverlay({
        title: won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ',
        color: won ? 'var(--win)' : 'var(--lose)',
        text: won
            ? `${app.opponent.name} повержен. Осталось здоровья: ${app.battle.hp.player}.\nЕго коронка — ${ELEMENT[app.opponent.element].name.toLowerCase()}.`
            : `${app.opponent.name} оказался быстрее.\nЕго коронка — ${ELEMENT[app.opponent.element].name.toLowerCase()}.`,
        actions: [
            { label: 'ЕЩЁ РАЗ', primary: true, onClick: () => startFreeBattle(app.mode.id) },
            { label: 'В МЕНЮ', onClick: goMenu },
        ],
    });
}

function showOverlay({ title, text, color, actions }) {
    dom.overlayTitle.textContent = title;
    dom.overlayTitle.style.color = color ?? 'var(--text)';
    dom.overlayText.textContent = text ?? '';
    dom.overlayText.style.whiteSpace = 'pre-line';
    dom.overlayActions.replaceChildren(
        ...actions.map(({ label, primary, onClick }) => {
            const button = document.createElement('button');
            button.className = primary ? 'mbtn mbtn--primary' : 'mbtn';
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => { hideOverlay(); onClick(); });
            return button;
        }),
    );
    dom.overlay.hidden = false;
}

const hideOverlay = () => { dom.overlay.hidden = true; };

/* ─────────────────────────── Клавиатура ─────────────────────────── */

// Физические клавиши — чтобы раскладка не влияла на управление.
const KEY_CODES = {
    Digit1: 'fire', Digit2: 'water', Digit3: 'wind',
    Numpad1: 'fire', Numpad2: 'water', Numpad3: 'wind',
    KeyQ: 'fire', KeyW: 'water', KeyE: 'wind',
};

// Запасной путь для клавиатур, которые не сообщают code (в том числе экранных).
const KEY_CHARS = {
    1: 'fire', 2: 'water', 3: 'wind',
    q: 'fire', w: 'water', e: 'wind',
    й: 'fire', ц: 'water', у: 'wind',
};

const elementFromKey = (event) =>
    KEY_CODES[event.code] ?? KEY_CHARS[event.key?.toLowerCase()] ?? null;

const isKey = (event, code, key) => event.code === code || event.key === key;

function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const battleVisible = !$('screen-battle').hidden && dom.overlay.hidden;
    if (!battleVisible) return;

    const element = elementFromKey(event);
    if (element) { event.preventDefault(); castElement(element); return; }
    if (isKey(event, 'Backspace', 'Backspace')) { event.preventDefault(); undoCast(); return; }
    if (isKey(event, 'Enter', 'Enter')) { event.preventDefault(); void runRound(); return; }
    if (isKey(event, 'Space', ' ')) { event.preventDefault(); useSuper(); }
}

/* ─────────────────────────── Запуск ─────────────────────────── */

/**
 * Safari на iOS игнорирует user-scalable=no, поэтому щипок гасим руками.
 *
 * Двойной тап здесь трогать нельзя: гасить его через preventDefault на
 * touchend — значит убить и клик, а игрок бьёт по стихиям очередями, и каждый
 * второй тап переставал доходить. За зум по двойному тапу отвечает
 * touch-action: manipulation в стилях, и этого достаточно.
 */
function blockZoomGestures() {
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    }
}

function boot() {
    blockZoomGestures();
    renderWheel(dom.menuWheel);
    renderWheel(dom.battleWheel);
    renderCastRow(dom.castRow, castElement);
    renderModes(dom.modeGrid, MODES, MODE_ORDER, startFreeBattle);
    renderStats(dom.stats, { fire: 0, water: 0, wind: 0 });
    loadSpeed();
    wakeAudioOnInteraction();

    document.querySelectorAll('[data-goto]').forEach((node) => {
        node.addEventListener('click', () => {
            const target = node.dataset.goto;
            if (target === 'menu') goMenu();
            else if (target === 'modes') goModes();
            else if (target === 'learn') goLearn('menu');
            else if (target === 'story') startStory();
        });
    });

    dom.learnPrev.addEventListener('click', () => {
        if (app.learnStep === 0) { showScreen(app.learnReturn); return; }
        app.learnStep -= 1;
        paintLearn();
    });
    dom.learnNext.addEventListener('click', () => {
        if (app.learnStep === LEARN_STEPS.length - 1) { showScreen(app.learnReturn); return; }
        app.learnStep += 1;
        paintLearn();
    });

    dom.btnUndo.addEventListener('click', undoCast);
    dom.btnGo.addEventListener('click', () => void runRound());
    dom.btnSuper.addEventListener('click', useSuper);
    dom.btnSpeed.addEventListener('click', cycleSpeed);
    dom.btnRules.addEventListener('click', () => goLearn('battle'));
    dom.btnQuit.addEventListener('click', goMenu);
    window.addEventListener('keydown', onKeyDown);

    void loadLeaderboard();
    showScreen('menu');
}

boot();
