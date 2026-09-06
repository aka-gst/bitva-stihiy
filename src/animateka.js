/*
 * Первое подключение Аниматеки в игру.
 * Источник: ~/dev/animateka/animateka.json, версия 0.1.0.
 * Игра хранит малый адаптер локально, чтобы боевой сайт не зависел от
 * соседней папки на машине разработчика.
 */
export const ANIMATEKA = Object.freeze({
    pageMs: 600,
    softOut: 'cubic-bezier(.22,.61,.36,1)',
    fadeIn: 'cubic-bezier(.4,0,.2,1)',
    fadeOut: 'cubic-bezier(.4,0,1,1)',
});
