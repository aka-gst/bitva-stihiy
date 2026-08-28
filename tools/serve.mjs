/**
 * Локальный статик-сервер для разработки.
 *
 * Игра собрана из ES-модулей, поэтому её нельзя открыть двойным щелчком
 * по index.html — нужен HTTP. Штатного сервера у проекта нет, а
 * `python3 -m http.server` однопоточный и подвисает на параллельных
 * запросах браузера.
 *
 *   npm start            → http://localhost:4189
 *   npm start -- 5000    → другой порт
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4189);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

// Игра ссылается на корень сайта-хоста, которого локально нет. Без этих
// файлов предпросмотр врёт: кнопка «НА ГЛАВНУЮ» не появляется, а на бою она
// висит поверх арены. Копии лежат в tools/host/ — см. README там же.
const HOST = new Map([
    ['/game-menu.css', 'tools/host/game-menu.css'],
    ['/player-name.js', 'tools/host/player-name.js'],
]);

const send = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
};

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;

    // Не выпускаем за пределы каталога проекта.
    const target = join(ROOT, HOST.get(path) ?? normalize(decodeURIComponent(path)));
    if (!target.startsWith(ROOT)) return send(res, 403, 'Forbidden');

    try {
        const info = await stat(target);
        if (info.isDirectory()) return send(res, 404, 'Not found');
        res.writeHead(200, {
            'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
            'Content-Length': info.size,
            'Cache-Control': 'no-cache',
        });
        createReadStream(target).pipe(res);
    } catch {
        // Таблица результатов (/api/...) локально отсутствует — это ожидаемо,
        // игра работает и без неё.
        send(res, 404, 'Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Битва Стихий → http://localhost:${PORT}`);
});
