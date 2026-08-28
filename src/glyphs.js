/**
 * Неоновые знаки стихий.
 *
 * Эмодзи выглядели как символы из чужого набора: у каждой платформы свой
 * рисунок, и три кнопки не читались как одна семья. Здесь знаки нарисованы
 * контуром и светятся, как неоновая вывеска: широкая тусклая обводка под
 * узкой яркой — так неон и устроен.
 */

import { ELEMENT } from './rules.js';

let seq = 0;

const SHAPES = {
    fire: 'M32 8 C34 18 44 22 44 34 C44 43 39 50 32 50 C25 50 20 43 20 34'
        + ' C20 28 24 25 25 20 C29 25 30 15 32 8 Z'
        + ' M32 50 C28 46 27 41 29 36 C31 40 34 40 35 37 C38 41 36 47 32 50 Z',
    water: 'M32 8 C32 8 46 26 46 36 C46 44 40 50 32 50 C24 50 18 44 18 36'
        + ' C18 26 32 8 32 8 Z'
        + ' M26 38 C26 43 29 46 33 46',
    wind: 'M12 22 C22 22 30 22 38 22 C44 22 46 18 44 15 C42 12 38 13 37 16'
        + ' M10 32 C24 32 36 32 46 32 C52 32 54 28 52 25'
        + ' M14 42 C24 42 32 42 39 42 C45 42 47 46 45 49 C43 52 39 51 38 48',
};

/** @param {string} element */
export function elementGlyph(element) {
    const uid = `g${(seq += 1)}`;
    const color = ELEMENT[element]?.color ?? '#94a3b8';
    const path = SHAPES[element] ?? SHAPES.fire;
    const filled = element !== 'wind';

    return `
<svg class="glyph" viewBox="0 0 64 58" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="neon-${uid}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.6" result="soft"/>
      <feMerge><feMergeNode in="soft"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-${uid})">
    <path d="${path}" stroke="${color}" stroke-width="6" opacity=".28"/>
    <path d="${path}" stroke="${color}" stroke-width="2.4" opacity=".95"/>
    <path d="${path}" stroke="#fff" stroke-width="0.9" opacity=".8"/>
  </g>
  ${filled ? `<path d="${path}" fill="${color}" opacity=".07"/>` : ''}
</svg>`.trim();
}
