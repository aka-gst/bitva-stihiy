/**
 * Съёмочный кадр витрины: что обещано спрятать — то и прячется.
 *
 * Повод — своя же поломка 6 сентября 2026. В список селекторов
 * `body.showcase .hud, ... .controls,` вставили блок `.game-home-menu` с
 * подстраховкой кнопки выхода. Запятая перед ним осталась, поэтому четыре
 * съёмочных селектора не закрыли своё правило, а слились с чужим и получили
 * `position: fixed` вместо `display: none`. Полоски, слоты и кнопки легли
 * поверх арены — карточка витрины показывала интерфейс вместо драки.
 *
 * Ни один тест этого не поймал: проверка кнопки выхода смотрела на кнопку, а
 * сломался её сосед по списку. Отсюда проверка не «есть ли селектор», а «что
 * делает правило, которому этот селектор достался».
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../styles/game.css', import.meta.url), 'utf8');

/** Убрать комментарии: селектор может быть отделён от блока пояснением. */
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Правила как пары «список селекторов → тело». */
const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), body: m[2] }));

test('всё, что съёмочный кадр обещает спрятать, действительно прячется', () => {
    // Эти четверо кладутся поверх арены, если не спрятаны: у трёх из них
    // position задан снаружи, и в кадр они лезут целиком.
    for (const selector of ['.hud', '.middle', '.bottom', '.controls', '.intel', '#notice']) {
        const full = `body.showcase ${selector}`;
        const owning = rules.filter((r) => r.selectors.includes(full));
        assert.ok(owning.length > 0, `в стилях нет правила для ${full} — кадр витрины покажет интерфейс`);
        for (const rule of owning) {
            assert.match(
                rule.body,
                /display:\s*none/,
                `${full} достался правилу без display:none — тело правила: ${rule.body.trim().slice(0, 80)}`,
            );
        }
    }
});

test('подстраховка кнопки выхода стоит своим правилом, а не в чужом списке', () => {
    const owning = rules.filter((r) => r.selectors.includes('.game-home-menu'));
    assert.equal(owning.length, 1, 'ожидалось ровно одно правило для .game-home-menu');
    assert.deepEqual(
        owning[0].selectors,
        ['.game-home-menu'],
        'к подстраховке кнопки прилипли чужие селекторы — они получат её position:fixed вместо своих свойств',
    );
});
