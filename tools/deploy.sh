#!/usr/bin/env sh
# Выкладка игры на aka-gst.ru/stihii/.
#
#   sh tools/deploy.sh                    проверить сборку и показать, что уедет
#   sh tools/deploy.sh --deploy           и выложить
#   GAME_PATH=knb sh tools/deploy.sh --deploy   выложить по старому адресу
#
# Каталог игры живёт только на сервере: в дереве сайта его нет, и выкладывается
# он отсюда. Поэтому --delete здесь безопасен и нужен — он убирает остатки
# предыдущих сборок.
#
# Игра переехала с /knb/ на /stihii/ вместе с переименованием. Пока на сервере
# не появился редирект, старый адрес держим живым: по нему уже расходились
# ссылки, и отдавать по ним протухшую сборку хуже, чем лишний раз залить.
set -eu

DEPLOY=no
[ "${1:-}" = "--deploy" ] && DEPLOY=yes
SSH_HOST="${SSH_HOST:-bonita}"
SITE_ROOT="${SITE_ROOT:-/opt/zakriva/caddy/site}"
GAME_PATH="${GAME_PATH:-stihii}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Сборка перестала быть одним файлом: index.html грузит ./src/main.js как
# ES-модуль. Копируется дерево целиком, иначе на сервере будет белый экран.
SHIP="index.html src styles"

echo "проверка правил и структуры"
npm test --silent >/dev/null || {
  echo "ОШИБКА: тесты не проходят, выкладка отменена" >&2
  exit 1
}

for entry in $SHIP; do
  [ -e "$HERE/$entry" ] || { echo "ОШИБКА: нет $entry" >&2; exit 1; }
  cp -R "$HERE/$entry" "$STAGE/"
done

# Игра ссылается на обвязку сайта абсолютными путями — из подкаталога они
# обязаны оставаться абсолютными, а свои файлы, наоборот, относительными.
grep -q 'src="\./src/main\.js' "$STAGE/index.html" || {
  echo "ОШИБКА: index.html не грузит ./src/main.js — проверь пути" >&2
  exit 1
}

echo
echo "уедет в $SITE_ROOT/$GAME_PATH:"
( cd "$STAGE" && find . -type f | sort | sed 's|^\./|  |' )
echo "  итого: $(cd "$STAGE" && find . -type f | wc -l | tr -d ' ') файлов, $(du -sh "$STAGE" | cut -f1)"

[ "$DEPLOY" = yes ] || { echo; echo "это была проверка. для выкладки: sh tools/deploy.sh --deploy"; exit 0; }

echo
echo "выкладка на $SSH_HOST:$SITE_ROOT/$GAME_PATH"
REMOTE_SHELL="ssh -o BatchMode=yes -o ConnectTimeout=15"
if ! rsync -az --delete -e "$REMOTE_SHELL" "$STAGE/" "$SSH_HOST:$SITE_ROOT/$GAME_PATH/"; then
  echo "ОШИБКА: игра не выложена" >&2
  exit 1
fi

failed=0
for path in "/$GAME_PATH/" "/$GAME_PATH/src/main.js" "/$GAME_PATH/src/engine.js" "/$GAME_PATH/styles/game.css"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://aka-gst.ru$path" || echo "нет ответа")
  printf "  %-28s %s\n" "$path" "$code"
  [ "$code" = 200 ] || failed=1
done
[ "$failed" = 0 ] || { echo "ОШИБКА: не все файлы отвечают 200" >&2; exit 1; }
echo
echo "готово: https://aka-gst.ru/$GAME_PATH/"
