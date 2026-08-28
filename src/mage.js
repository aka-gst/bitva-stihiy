/** Рисунок мага. Чистая функция: профиль → SVG-строка. */

import { ELEMENT } from './rules.js';

/** Палитры мантий по стихии; игрок носит нейтральную. */
const ROBES = {
    player: { light: '#6155ad', mid: '#413878', dark: '#211c44', trim: '#8a7cdc', skin: '#e8c49c' },
    fire: { light: '#93452a', mid: '#6b2f1c', dark: '#361409', trim: '#cd6c3d', skin: '#dfb188' },
    water: { light: '#26608e', mid: '#1a4467', dark: '#0c1f33', trim: '#4295c9', skin: '#d9c3b0' },
    wind: { light: '#4f7c33', mid: '#39591f', dark: '#18280f', trim: '#86b750', skin: '#e2c9a2' },
};

let seq = 0;

/**
 * @param {object} opts
 * @param {string} opts.element  стихия для ауры, глаз и орба
 * @param {'player'|'enemy'} opts.side
 */
export function mageSvg({ element = 'fire', side = 'player' } = {}) {
    const uid = `m${(seq += 1)}`;
    const palette = ROBES[side === 'player' ? 'player' : element] ?? ROBES.player;
    const glow = ELEMENT[element]?.color ?? '#94a3b8';

    return `
<svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <radialGradient id="aura-${uid}" cx="50%" cy="45%" r="52%">
      <stop offset="0%" stop-color="${glow}" stop-opacity=".34"/>
      <stop offset="70%" stop-color="${glow}" stop-opacity=".06"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="robe-${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="${palette.light}"/>
      <stop offset="55%" stop-color="${palette.mid}"/>
      <stop offset="100%" stop-color="${palette.dark}"/>
    </linearGradient>
    <linearGradient id="hood-${uid}" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${palette.trim}"/>
      <stop offset="100%" stop-color="${palette.mid}"/>
    </linearGradient>
  </defs>

  <ellipse cx="58" cy="150" rx="33" ry="6.5" fill="#000" opacity=".4"/>
  <circle class="aura" cx="58" cy="74" r="60" fill="url(#aura-${uid})"/>

  <!-- дальняя рука, чтобы силуэт не был плоским -->
  <path d="M40 60 Q26 72 24 92" stroke="${palette.dark}" stroke-width="12"
        stroke-linecap="round" fill="none" opacity=".85"/>

  <!-- мантия -->
  <path d="M58 40 C40 40 32 58 28 92 L19 145 Q58 153 97 145 L88 92 C84 58 76 40 58 40 Z"
        fill="url(#robe-${uid})"/>
  <!-- складки -->
  <path d="M58 48 L53 148" stroke="#000" stroke-opacity=".22" stroke-width="3" fill="none"/>
  <path d="M42 66 L34 143" stroke="#000" stroke-opacity=".13" stroke-width="2" fill="none"/>
  <path d="M74 66 L82 143" stroke="#000" stroke-opacity=".13" stroke-width="2" fill="none"/>
  <!-- подол -->
  <path d="M19 145 Q58 153 97 145 L97 149 Q58 157 19 149 Z" fill="${palette.dark}" opacity=".75"/>

  <!-- оплечье -->
  <path d="M58 42 C44 42 36 50 33 62 Q58 70 83 62 C80 50 72 42 58 42 Z"
        fill="${palette.trim}" opacity=".55"/>
  <!-- пояс -->
  <path d="M34 95 Q58 103 83 95 L85 104 Q58 113 32 104 Z" fill="${palette.trim}" opacity=".9"/>
  <!-- камень на груди -->
  <circle cx="58" cy="80" r="4.6" fill="${glow}" opacity=".85"/>
  <circle cx="58" cy="80" r="2" fill="#fff" opacity=".7"/>

  <g class="arm">
    <rect x="98" y="26" width="5" height="122" rx="2.5" fill="#6d4a2c"/>
    <rect x="98" y="26" width="2" height="122" rx="1" fill="#8a613b" opacity=".7"/>
    <path d="M74 58 Q94 64 100 90" stroke="${palette.light}" stroke-width="14"
          stroke-linecap="round" fill="none"/>
    <path d="M74 58 Q94 64 100 90" stroke="#fff" stroke-opacity=".08" stroke-width="6"
          stroke-linecap="round" fill="none"/>
    <circle cx="100" cy="92" r="6.5" fill="${palette.skin}"/>
    <circle class="orb staff-orb" cx="100.5" cy="22" r="11" fill="${glow}" opacity=".92"/>
    <circle class="staff-core" cx="100.5" cy="22" r="4.5" fill="#fff" opacity=".85"/>
  </g>

  <!-- капюшон -->
  <path d="M58 10 C39 10 29 27 31 48 C36 58 80 58 85 48 C87 27 77 10 58 10 Z"
        fill="url(#hood-${uid})"/>
  <path d="M58 10 C39 10 29 27 31 48 L38 50 C36 30 45 16 58 15 Z" fill="#fff" opacity=".14"/>
  <path d="M31 48 C36 58 80 58 85 48 L83 55 C76 62 40 62 33 55 Z" fill="${palette.dark}" opacity=".55"/>
  <ellipse cx="58" cy="41" rx="16" ry="14" fill="#070c17"/>
  <ellipse class="eye" cx="51.5" cy="41" rx="3.6" ry="2.7" fill="${glow}"/>
  <ellipse class="eye" cx="64.5" cy="41" rx="3.6" ry="2.7" fill="${glow}"/>
</svg>`.trim();
}
