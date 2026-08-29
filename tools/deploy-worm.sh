#!/usr/bin/env sh
# Выкладка прототипа «Кольчатого» на aka-gst.ru/worm/.
#
#   sh tools/deploy-worm.sh            показать, что уедет
#   sh tools/deploy-worm.sh --deploy   и выложить
#
# Это отдельная от «Битвы Стихий» страница: один самодостаточный файл без
# зависимостей, поэтому едет он один и в свой каталог. Обвязка сайта
# (game-menu.css, player-name.js, лидерборд) прототипу не нужна.
set -eu

DEPLOY=no
[ "${1:-}" = "--deploy" ] && DEPLOY=yes
SSH_HOST="${SSH_HOST:-bonita}"
SITE_ROOT="${SITE_ROOT:-/opt/zakriva/caddy/site}"
GAME_PATH="${GAME_PATH:-worm}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/prototype/worm.html"
[ -f "$SRC" ] || { echo "ОШИБКА: нет prototype/worm.html" >&2; exit 1; }

# Файл обязан быть самодостаточным: ни одной внешней ссылки, иначе на сервере
# будет пустой экран, а проверять его будут с телефона в дороге.
if grep -Eq '(src|href)="(https?:)?//|(src|href)="/' "$SRC"; then
  echo "ОШИБКА: в прототипе появилась внешняя ссылка — он больше не самодостаточен" >&2
  exit 1
fi

echo "уедет в $SITE_ROOT/$GAME_PATH/index.html: $(wc -c < "$SRC" | tr -d ' ') байт"
[ "$DEPLOY" = yes ] || { echo; echo "это была проверка. для выкладки: sh tools/deploy-worm.sh --deploy"; exit 0; }

# Сервер иногда отвечает на SSH дольше 15 секунд, и выкладка срывалась на
# полпути. Ждём дольше и не считаем неудачный mkdir поводом всё бросить.
REMOTE_SHELL="ssh -o BatchMode=yes -o ConnectTimeout=45 -o ServerAliveInterval=10"
$REMOTE_SHELL "$SSH_HOST" "mkdir -p $SITE_ROOT/$GAME_PATH" || true
rsync -az -e "$REMOTE_SHELL" "$SRC" "$SSH_HOST:$SITE_ROOT/$GAME_PATH/index.html"

code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://aka-gst.ru/$GAME_PATH/" || echo "нет ответа")
echo "  /$GAME_PATH/  $code"
[ "$code" = 200 ] || { echo "ОШИБКА: страница не отвечает 200" >&2; exit 1; }
echo
echo "готово: https://aka-gst.ru/$GAME_PATH/"
