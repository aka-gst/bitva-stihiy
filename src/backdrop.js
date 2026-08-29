/**
 * Поле боя: слои силуэтов с глубиной.
 *
 * Четыре плана — небо, дальний хребет, средний силуэт и передний край, — и
 * чем ближе слой, тем он темнее. Этого хватает, чтобы глаз прочитал глубину,
 * а бойцы читались как фигуры перед задником, а не как рисунки на стене.
 *
 * Небо по-прежнему рисуется кодом: это два цвета и зарево, которые дешевле
 * посчитать, чем возить картинкой, и они должны точно совпадать с цветом
 * стихии. Три силуэта — нарисованные файлы: руины, мост с пагодой и гнутые
 * сосны узнаются с первого взгляда, а код на такое способен не был.
 *
 * Все девять слоёв весят 25 КБ вместе, поэтому грузятся сразу: ждать их
 * незачем, а мигание пустой ареной было бы заметнее самой картинки.
 */

import { ELEMENT } from './rules.js';

let seq = 0;

/** Небо: два цвета от горизонта вверх плюс зарево у линии земли. */
const SKY = {
    fire: { top: '#150a12', bottom: '#3a1408', haze: '#f97316' },
    water: { top: '#07131f', bottom: '#0b3247', haze: '#38bdf8' },
    wind: { top: '#0b1418', bottom: '#1d2e18', haze: '#a3e635' },
};

/** Слои силуэтов: три файла на стихию, поверх неба, от дальнего к переднему. */
export const BACKDROP_LAYERS = ['far', 'mid', 'near'];

/** Путь к слою. Имена заведены под заказ один в один. */
export function layerSrc(element, layer) {
    return `./assets/bg-${element}-${layer}.webp`;
}

export function backdropSvg(element = 'fire') {
    const uid = `b${(seq += 1)}`;
    const sky = SKY[element] ?? SKY.fire;

    return `
<svg class="backdrop" viewBox="0 0 400 200" preserveAspectRatio="none"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="sky-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
      <stop offset="0%" stop-color="${sky.top}"/>
      <stop offset="100%" stop-color="${sky.bottom}"/>
    </linearGradient>
    <radialGradient id="haze-${uid}" gradientUnits="userSpaceOnUse" cx="200" cy="150" r="190">
      <stop offset="0%" stop-color="${sky.haze}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${sky.haze}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="200" fill="url(#sky-${uid})"/>
  <ellipse cx="200" cy="152" rx="190" ry="76" fill="url(#haze-${uid})"/>
</svg>`.trim();
}
