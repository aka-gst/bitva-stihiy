/** Итог витрины не должен стать подписью обычного боя или уехать за арену. */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/game.css', import.meta.url), 'utf8');
const showcase = readFileSync(new URL('../src/showcase.js', import.meta.url), 'utf8');
const arena = readFileSync(new URL('../src/arena.js', import.meta.url), 'utf8');
const animateka = readFileSync(new URL('../src/animateka.js', import.meta.url), 'utf8');

test('итог витрины лежит внутри арены, начинается скрытым и назван словами', () => {
    const arena = html.match(/<div class="arena" id="arena">([\s\S]*?)<\/div>\s*\n\s*<!-- Поле ходов/);
    assert.ok(arena, 'не нашли границы арены');
    assert.match(arena[1], /id="showcase-outcome"[^>]*hidden/, 'итог витрины должен начинаться скрытым внутри арены');
    assert.match(arena[1], /Вода тушит огонь[\s\S]*Коронка пробита/, 'в итоговом знаке нет объяснения исхода');
});

test('итог появляется после завершения витринного обмена и скрыт вне showcase', () => {
    assert.match(showcase, /function scene[\s\S]*?showOutcome\(false\)/, 'новая сцена обязана сбрасывать старый итог');
    assert.equal((showcase.match(/showOutcome\(true\)/g) ?? []).length, 2, 'и showcase(), и loop() должны показать итог после обмена');
    assert.equal((showcase.match(/run === sceneRun/g) ?? []).length, 2, 'отменённый дубль не должен раскрыть итог поверх нового');
    assert.match(css, /body:not\(\.showcase\) \.showcase-outcome\s*\{\s*display:\s*none !important/, 'вне showcase итог не должен попасть в обычную игру');
    assert.match(css, /font-size:\s*clamp\(32px,\s*3\.1vw,\s*36px\)/, 'итог должен читаться в карточке: 32–36px');
});

test('жест гашения остаётся в игре, а границей витрины служат размер и итог', () => {
    assert.match(animateka, /pageMs:\s*600/, 'крупная сцена должна брать 600 мс из класса Аниматеки «страница»');
    assert.match(animateka, /softOut:\s*'cubic-bezier\(\.22,\.61,\.36,1\)'/, 'волна должна брать мягкий выход Аниматеки');
    assert.match(arena, /function extinguishFire/, 'нужна отдельная сцена гашения, а не мгновенная смена кадра');
    assert.match(arena, /winnerElement === 'water' && loserElement === 'fire'/, 'сцена должна включаться только когда вода побеждает огонь');
    assert.match(arena, /element-clash-wave[\s\S]*element-clash-steam[\s\S]*element-crown-fire/, 'последовательность обязана содержать волну, пар и гаснущую коронку');
    assert.match(css, /body\.showcase \.bolt[^}]*font-size:\s*76px/, 'витринные стихии должны быть крупнее обычных');
    assert.match(css, /body\.showcase \.showcase-outcome[\s\S]*?font-size:\s*clamp\(32px,\s*3\.1vw,\s*36px\)/, 'крупный итог должен быть частью витрины');

    // Отрицательные контроли: тест обязан краснеть, если исчез любой из двух
    // признаков витрины, даже когда сам жест в arena.js остался.
    assert.throws(() => assert.match(css.replace('font-size: 76px', 'font-size: 30px'), /body\.showcase \.bolt[^}]*font-size:\s*76px/));
    assert.throws(() => assert.match(html.replace('Вода тушит огонь', 'Итог'), /Вода тушит огонь[\s\S]*Коронка пробита/));
});
