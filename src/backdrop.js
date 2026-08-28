/**
 * Поле боя: слои силуэтов с глубиной.
 *
 * Раньше арена была подсвеченной коробкой, и бойцы стояли в пустоте. Здесь
 * четыре плана — небо, дальний хребет, средний силуэт и передний край, — и
 * чем ближе слой, тем он темнее. Этого хватает, чтобы глаз прочитал глубину,
 * а бойцы читались как фигуры перед задником, а не как рисунки на стене.
 *
 * Свой набор форм у каждой стихии: гореть, лить и гнуть должно по-разному.
 */

import { ELEMENT } from './rules.js';

let seq = 0;

/** Небо: два цвета от горизонта вверх плюс зарево у линии земли. */
const SKY = {
    fire: { top: '#150a12', bottom: '#3a1408', haze: '#f97316' },
    water: { top: '#07131f', bottom: '#0b3247', haze: '#38bdf8' },
    wind: { top: '#0b1418', bottom: '#1d2e18', haze: '#a3e635' },
};

/** Дальний план — самый светлый, он почти растворён в небе. */
const FAR = {
    fire: 'M0 126 L20 112 L34 120 L50 104 L66 118 L82 108 L98 122 L114 106 L130 120'
        + ' L148 110 L164 124 L180 108 L196 120 L214 106 L230 122 L248 110 L264 124'
        + ' L280 108 L296 120 L314 108 L330 122 L348 110 L364 122 L382 108 L400 120'
        + ' L400 200 L0 200 Z',
    water: 'M0 122 L28 112 L52 118 L78 106 L104 118 L132 110 L158 120 L186 108'
        + ' L212 120 L240 110 L266 120 L294 108 L320 118 L348 110 L374 120 L400 112'
        + ' L400 200 L0 200 Z',
    wind: 'M0 132 C30 122 54 136 82 130 C110 124 134 136 162 130 C190 124 214 136 242 130'
        + ' C270 124 294 136 322 130 C350 124 374 134 400 128 L400 200 L0 200 Z',
};

/** Средний план: то, что делает место узнаваемым. */
const MID = {
    // Обломки колонн и разбитые ворота на пепелище.
    fire: '<path d="M0 140 L26 116 L52 138 L78 112 L104 140 L130 120 L156 142 L184 118'
        + ' L212 140 L242 116 L268 138 L296 118 L324 140 L352 120 L378 138 L400 122 L400 200 L0 200 Z"/>'
        + '<rect x="52" y="96" width="13" height="48"/><rect x="46" y="90" width="25" height="8"/>'
        + '<rect x="318" y="86" width="13" height="58"/><rect x="312" y="80" width="25" height="8"/>'
        + '<rect x="46" y="76" width="291" height="7" opacity=".55"/>',
    // Мост и пагода над водой.
    water: '<path d="M0 146 L400 146 L400 200 L0 200 Z"/>'
        + '<path d="M96 146 C132 108 176 100 216 100 C256 100 292 110 320 146 Z" opacity=".92"/>'
        + '<rect x="196" y="60" width="10" height="44"/>'
        + '<path d="M172 62 L230 62 L214 50 L188 50 Z"/><path d="M178 46 L224 46 L214 34 L188 34 Z"/>'
        + '<path d="M184 32 L218 32 L201 20 Z"/>',
    // Согнутые сосны на гребне.
    wind: '<path d="M0 150 C70 138 120 152 190 146 C258 140 320 154 400 144 L400 200 L0 200 Z"/>'
        + '<path d="M74 148 C70 126 76 108 92 96 C78 104 70 118 68 132 Z"/>'
        + '<path d="M92 96 C112 92 132 96 146 106 C126 96 106 92 92 96 Z"/>'
        + '<path d="M300 146 C292 122 298 104 316 92 C300 100 290 116 290 130 Z"/>'
        + '<path d="M316 92 C338 88 358 94 372 104 C350 92 330 88 316 92 Z"/>',
};

/** Передний край — самый тёмный, обрамляет кадр по бокам. */
const NEAR = {
    fire: '<path d="M0 200 L0 150 C14 158 22 172 26 200 Z"/>'
        + '<path d="M400 200 L400 142 C382 152 372 170 368 200 Z"/>',
    water: '<path d="M0 200 L0 158 C18 166 28 180 32 200 Z"/>'
        + '<path d="M400 200 L400 152 C378 162 366 178 362 200 Z"/>',
    wind: '<path d="M4 200 C10 176 8 160 2 148 C16 158 22 178 22 200 Z"/>'
        + '<path d="M396 200 C390 172 392 156 398 144 C384 156 378 176 378 200 Z"/>',
};

export function backdropSvg(element = 'fire') {
    const uid = `b${(seq += 1)}`;
    const sky = SKY[element] ?? SKY.fire;
    const glow = ELEMENT[element]?.color ?? '#94a3b8';

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

  <g class="layer-far" fill="#0a1018" opacity=".7"><path d="${FAR[element] ?? FAR.fire}"/></g>
  <g class="layer-mid" fill="#070b12" opacity=".94">${MID[element] ?? MID.fire}</g>
  <g class="layer-near" fill="#02040a">${NEAR[element] ?? NEAR.fire}</g>
</svg>`.trim();
}
