/**
 * Боец: силуэт-каратист. Чистая функция, профиль → SVG-строка.
 *
 * Рисуется не одной фигурой, а скелетом: каждый сустав — своя группа, которая
 * поворачивается на угол из CSS-переменной. Поза становится набором углов,
 * переход между позами — обычным CSS-переходом, и одно и то же действие можно
 * показать разными позами, не перерисовывая фигуру.
 *
 * Силуэт выбран сознательно: чёрная фигура на светящемся фоне читается на любом
 * размере и не требует прорисовки, которая в SVG выглядела бы бедно.
 */

import { ELEMENT } from './rules.js';

let seq = 0;

/** Толщина частей: бёдра толще голеней, плечи толще предплечий. */
const LIMB = { thigh: 15, shin: 11, upper: 11, fore: 9 };

export function fighterSvg({ element = 'fire', side = 'player' } = {}) {
    const uid = `f${(seq += 1)}`;
    const glow = ELEMENT[element]?.color ?? '#94a3b8';

    return `
<svg viewBox="0 0 120 170" preserveAspectRatio="xMidYMax meet"
     xmlns="http://www.w3.org/2000/svg" role="img" class="fighter-svg">
  <defs>
    <!-- userSpaceOnUse обязателен: доли ограничивающего прямоугольника
         вырождаются на вертикальной линии, и конечности не рисуются вовсе. -->
    <linearGradient id="body-${uid}" gradientUnits="userSpaceOnUse"
                    x1="20" y1="20" x2="96" y2="164">
      <stop offset="0%" stop-color="#1b2130"/>
      <stop offset="100%" stop-color="#04060b"/>
    </linearGradient>
    <!-- Свет из-под ног, а не шар вокруг бойца: силуэт должен читаться
         на фоне, а не сидеть в пузыре. -->
    <radialGradient id="rim-${uid}" gradientUnits="userSpaceOnUse" cx="58" cy="150" r="58">
      <stop offset="0%" stop-color="${glow}" stop-opacity=".38"/>
      <stop offset="55%" stop-color="${glow}" stop-opacity=".1"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse class="ground-shadow" cx="58" cy="163" rx="30" ry="5" fill="#000" opacity=".45"/>
  <ellipse class="aura" cx="58" cy="150" rx="56" ry="34" fill="url(#rim-${uid})"/>

  <g class="fig" stroke="url(#body-${uid})" fill="none" stroke-linecap="round">
    <!-- дальние конечности темнее: так силуэт не сливается в пятно -->
    <g class="leg-back" opacity=".72">
      <path d="M58 96 L58 128" stroke-width="${LIMB.thigh}"/>
      <g class="shin-back">
        <path d="M58 128 L58 156" stroke-width="${LIMB.shin}"/>
        <path class="foot" d="M58 156 L74 156" stroke-width="${LIMB.shin}"/>
      </g>
    </g>
    <g class="arm-back" opacity=".72">
      <path d="M58 62 L58 88" stroke-width="${LIMB.upper}"/>
      <g class="fore-back">
        <path d="M58 88 L58 110" stroke-width="${LIMB.fore}"/>
        <circle class="fist" cx="58" cy="112" r="7" fill="url(#body-${uid})" stroke="none"/>
      </g>
    </g>

    <g class="torso">
      <path d="M58 98 L58 58" stroke-width="26"/>
      <path class="belt" d="M46 92 L70 92" stroke="${glow}" stroke-width="4" opacity=".8"/>
      <g class="head">
        <circle cx="58" cy="42" r="14" fill="url(#body-${uid})" stroke="none"/>
        <path class="band" d="M45 38 L71 38" stroke="${glow}" stroke-width="3.4" opacity=".9"/>
        <path class="band-tail" d="M45 38 L33 30" stroke="${glow}" stroke-width="3" opacity=".75"/>
        <ellipse class="eye" cx="64" cy="43" rx="4" ry="2.4" fill="${glow}" stroke="none"/>
      </g>

      <g class="arm-front">
        <path d="M58 62 L58 88" stroke-width="${LIMB.upper}"/>
        <g class="fore-front">
          <path d="M58 88 L58 110" stroke-width="${LIMB.fore}"/>
          <circle class="fist" cx="58" cy="112" r="7.5" fill="url(#body-${uid})" stroke="none"/>
        </g>
      </g>
    </g>

    <g class="leg-front">
      <path d="M58 96 L58 128" stroke-width="${LIMB.thigh}"/>
      <g class="shin-front">
        <path d="M58 128 L58 156" stroke-width="${LIMB.shin}"/>
        <path class="foot" d="M58 156 L74 156" stroke-width="${LIMB.shin}"/>
      </g>
    </g>
  </g>
</svg>`.trim();
}

/**
 * Позы. Значения — углы поворота суставов в градусах.
 * Разные позы для одного действия дают разнообразие без новой графики.
 */
export const POSES = {
    idle: { torso: -2, head: 2, armBack: 24, foreBack: -78, armFront: -18, foreFront: -74, legBack: 12, shinBack: -14, legFront: -12, shinFront: 10 },
    guard: { torso: -6, head: 4, armBack: 14, foreBack: -96, armFront: -34, foreFront: -96, legBack: 16, shinBack: -18, legFront: -14, shinFront: 12 },
    punch: { torso: -12, head: 6, armBack: 34, foreBack: -110, armFront: -96, foreFront: -6, legBack: 18, shinBack: -16, legFront: -16, shinFront: 10 },
    hook: { torso: -18, head: 10, armBack: 40, foreBack: -100, armFront: -74, foreFront: -58, legBack: 20, shinBack: -18, legFront: -20, shinFront: 14 },
    kick: { torso: 10, head: -6, armBack: 44, foreBack: -70, armFront: -50, foreFront: -70, legBack: 6, shinBack: -8, legFront: -84, shinFront: 6 },
    highKick: { torso: 18, head: -10, armBack: 56, foreBack: -60, armFront: -62, foreFront: -60, legBack: 4, shinBack: -6, legFront: -116, shinFront: -4 },
    jumpKick: { torso: 6, head: -4, armBack: 62, foreBack: -70, armFront: -70, foreFront: -70, legBack: -46, shinBack: -84, legFront: -100, shinFront: 4 },
    headbutt: { torso: -26, head: 22, armBack: 30, foreBack: -104, armFront: -26, foreFront: -104, legBack: 22, shinBack: -20, legFront: -24, shinFront: 16 },
    hurt: { torso: 22, head: -18, armBack: -34, foreBack: -40, armFront: 30, foreFront: -30, legBack: 18, shinBack: -12, legFront: 8, shinFront: 18 },
    down: { torso: 74, head: -30, armBack: -60, foreBack: -20, armFront: 50, foreFront: -14, legBack: 30, shinBack: -70, legFront: 44, shinFront: -60 },
    win: { torso: -4, head: -4, armBack: 150, foreBack: -30, armFront: 140, foreFront: -26, legBack: 10, shinBack: -10, legFront: -10, shinFront: 8 },
};

/** Разные позы под одно и то же действие — чтобы удары не повторялись. */
export const ATTACK_POSES = ['punch', 'hook', 'kick', 'highKick', 'jumpKick', 'headbutt'];

/** Где вращается каждый сустав, в координатах viewBox. */
export const JOINTS = {
    torso: ['.torso', 58, 98],
    head: ['.head', 58, 58],
    armBack: ['.arm-back', 58, 62],
    foreBack: ['.fore-back', 58, 88],
    armFront: ['.arm-front', 58, 62],
    foreFront: ['.fore-front', 58, 88],
    legBack: ['.leg-back', 58, 96],
    shinBack: ['.shin-back', 58, 128],
    legFront: ['.leg-front', 58, 96],
    shinFront: ['.shin-front', 58, 128],
};

/**
 * Ставит позу: углы уезжают в CSS-переменные, а переход между ними делает
 * сам браузер. Поэтому смена позы — это одна строчка, а не новая анимация.
 */
export function applyPose(node, poseName) {
    const pose = POSES[poseName] ?? POSES.idle;
    for (const joint of Object.keys(JOINTS)) {
        node.style.setProperty(`--${joint}`, `${pose[joint] ?? 0}deg`);
    }
    node.dataset.pose = poseName;
}

/** Поза атаки, не повторяющая предыдущую: одинаковые удары не должны выглядеть одинаково. */
export function pickAttack(previous) {
    const options = ATTACK_POSES.filter((name) => name !== previous);
    return options[Math.floor(Math.random() * options.length)];
}
