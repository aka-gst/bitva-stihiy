# Битва Стихий — задание на звук

Задание самодостаточное: всё, что нужно знать об игре, есть ниже. Промты
написаны по-английски, потому что генераторы обучены на английских описаниях
музыки и понимают жанровые термины точнее. Пояснения, имена файлов и правила —
по-русски.

У каждого куска два вида промта: **короткая строка стиля** (для Suno, где
промт — это список тегов) и **развёрнутое описание** (для ElevenLabs Music и
Stable Audio, где промт — это фраза). Брать нужно один из двух, а не оба.

## Что за игра

Тактический файтинг про двух магов. Игрок заранее собирает цепочку из пяти
ходов, потом цепочка разыгрывается ход за ходом, и повлиять по дороге уже
нельзя. Три стихии: **огонь** `#fb923c`, **вода** `#38bdf8`, **ветер**
`#a3e635`. Огонь бьёт ветер, вода бьёт огонь, ветер бьёт воду.

Три узора — **ВАЛ**, **СВЯЗКА**, **ПРИЗМА** — складываются из соседних ходов
и усиливают их. Стихия арены меняется каждый раунд и удваивает узор на ней.

Темп игры — не боевой, а **настольный**: долгая тишина, пока игрок думает,
и короткий залп, когда цепочка разыгрывается. Музыка не должна подгонять.

Картинка: почти чёрные силуэты гор и руин на цветном небе, палитра
`#0e1524`–`#1a2338`, вся яркость — свечение стихий, а не заливка.

## Правила выдачи

- **Музыка:** MP3, 128–160 kbps, 60–120 секунд, **бесшовная петля** — обрезать
  ровно по такту, иначе на стыке будет слышна дырка. Без вокала и без слов:
  голос перетягивает внимание с поля.
- **Звуки:** WAV 44.1 кГц на выходе генератора, в игру кладём OGG или MP3.
  Короткие, **без хвоста тишины** в конце файла — хвост слышен как задержка.
  Пик −3 дБ, все звуки нормализовать между собой.
- **Вес:** каталог уезжает на публичный сайт вместе с игрой. Три минуты музыки
  в 128 kbps — около 3 МБ, это порядок веса всей остальной игры.
- **Права:** файлы публикуются. Сгенерированное своё — можно.
- Один промт — один файл. Не сводить несколько звуков в один трек.

---

# Музыка

## 1. `music/battle.mp3` — основной цикл боя

Играет всё время, пока идёт бой, включая паузы на раздумье. Поэтому главное
требование к нему — **не надоесть за двадцать минут**. Пустые такты здесь
важнее полных: короткая петля с барабаном в каждом такте давит через минуту,
даже если сама по себе приятная.

Строка стиля для Suno:

```
dark ritual ambient, slow tribal percussion, 84 BPM, D minor, frame drum,
low drone, sparse hammered dulcimer, no vocals, loopable, patient, mythic
```

Развёрнутое описание для ElevenLabs Music или Stable Audio:

```
A patient, dark ritual instrumental loop for a turn-based fantasy duel game.
84 BPM, D minor. Sparse frame drum on beats one and three, a low sustained
drone underneath, and occasional hammered dulcimer figures that leave long
gaps of near-silence. No melody that draws attention to itself, no vocals,
no build-up and no drop — the piece stays at one calm intensity throughout.
Ancient and mythic rather than orchestral or cinematic. Seamless loop,
90 seconds.
```

## 2. `music/menu.mp3` — меню и выбор режима

Тише и разреженнее боевого, тот же мир. Играет, пока игрок читает правила и
выбирает противника, поэтому в нём вообще не должно быть ритма — только фон.

Строка стиля для Suno:

```
ambient drone, no percussion, 60 BPM, D minor, bowed metal, soft air texture,
no vocals, loopable, calm, spacious
```

Развёрнутое описание:

```
A quiet ambient drone for a game menu. D minor, no percussion at all, no
discernible pulse. Bowed metal and soft breathy air textures fading in and
out of each other. Extremely sparse and calm — this plays while the player
reads and chooses, and must not compete for attention. No vocals, no melody.
Seamless loop, 60 seconds.
```

## 3–5. Три стингера арены — `music/arena-fire.mp3`, `arena-water.mp3`, `arena-wind.mp3`

Не музыка, а короткая заставка на 2–3 секунды. Играет один раз в начале
раунда, когда арена меняет стихию, и объявляет игроку, какой узор сейчас
удвоится. Три файла должны быть **узнаваемо разными на слух с первой ноты** —
это их единственная работа.

Огонь:

```
short cinematic sting, 3 seconds, low brass swell into a dry ember crackle,
D minor, no melody, no vocals, dark orange energy
```

Вода:

```
short cinematic sting, 3 seconds, glass bowl resonance into a deep water
swell, D minor, cold and clear, no melody, no vocals
```

Ветер:

```
short cinematic sting, 3 seconds, rising air rush into a high metallic
shimmer, D minor, weightless and sharp, no melody, no vocals
```

## 6. `music/victory.mp3` и `music/defeat.mp3` — итог боя

По 4–6 секунд, играют один раз на экране итога. Не зацикливаются.

Победа:

```
short victory fanfare, 5 seconds, frame drum and low brass resolving to
D major, warm and earned, restrained rather than triumphant, no vocals
```

Поражение:

```
short defeat sting, 5 seconds, low drone collapsing downward, single struck
gong, D minor, quiet and final, not comedic, no vocals
```

---

# Звуки

Сейчас все они синтезируются в `src/audio.js` парой осцилляторов. Файлы
заменят синтез там, где живой звук лучше квадратной волны; остальное можно
оставить как есть.

Каждый промт ниже — для генератора звуковых эффектов (ElevenLabs SFX,
Stable Audio). Длительность указана в самом промте, потому что это главный
параметр: длинный звук в быстрой игре читается как лаг.

## Удары стихий

`sfx/hit-fire.wav`

```
Fire spell impact, 0.4 seconds. A short whoosh igniting into a dry crackling
burst, then immediate decay. Punchy and close, not a distant explosion. Mono,
no reverb tail.
```

`sfx/hit-water.wav`

```
Water spell impact, 0.4 seconds. A heavy slap of water hitting stone with a
short pressurised hiss underneath. Clean and cold. Mono, no reverb tail.
```

`sfx/hit-wind.wav`

```
Wind spell impact, 0.4 seconds. A sharp compressed air cut, like a blade of
wind, with a brief high metallic edge. Weightless, no low end. Mono, no
reverb tail.
```

`sfx/hit-critical.wav`

```
Critical magic impact, 0.7 seconds. The same energy as a spell hit but
doubled: a deep sub-bass thud layered with a bright shattering crack on top.
Must read as clearly bigger than a normal hit within the first 50
milliseconds. Mono.
```

## Узоры

`sfx/pattern-complete.wav` — узор сложился, это хорошая новость и главный
момент удовольствия в игре.

```
Magical pattern completion chime, 0.6 seconds. Three ascending struck metal
tones locking into a consonant chord, bright and clean. Rewarding, not
cartoonish. Mono.
```

`sfx/pattern-broken.wav` — узор сорвался. Раньше осечка молчала, и игрок
не понимал, что потерял; этот звук должен быть заметным, но не наказывающим.

```
Failed magic chime, 0.5 seconds. Two struck metal tones sliding apart into a
dissonant interval and dying quickly. Clearly wrong but quiet and short — a
small disappointment, not a punishment. Mono.
```

## Интерфейс

`sfx/pick.wav`

```
UI selection tick for a fantasy game, 0.08 seconds. A single dry wooden
click with a faint metallic ring. Very short and quiet. Mono.
```

`sfx/undo.wav`

```
UI cancel tick, 0.1 seconds. A dry wooden click pitched downward, softer
than a selection click. Mono.
```

`sfx/chain-lock.wav` — игрок закончил цепочку из пяти ходов и отправил её в бой.

```
Commitment sound for a turn-based game, 0.5 seconds. A heavy stone or metal
mechanism locking into place — a low mechanical thunk with a short ring.
Final and irreversible in character. Mono.
```

`sfx/crown.wav` — противник получает скрытую коронку. Игрок не знает, что
именно произошло: звук должен читаться как «случилось что-то особенное»,
не объясняя, что.

```
Mysterious magical reveal, 0.9 seconds. A low bell struck once, with a long
metallic shimmer rising behind it instead of decaying. Ominous and curious
rather than threatening — the listener should want to know what it meant.
Mono.
```

---

# Что делать с готовыми файлами

1. Музыку положить в `music/`, звуки — в `assets/sfx/`.
2. Приёмника файлов в игре пока нет: `src/audio.js` умеет только синтез
   (52 строки, `tone` и `sweep`). Его нужно будет дописать — это отдельная
   задача после того, как файлы появятся и станет ясно, что из них годится.
   Готовый образец такого приёмника лежит в другой игре:
   `~/dev/odin-udar/src/audio.js` читает `music/manifest.json` и переключается
   с синтеза на файлы, не трогая остальной код.
3. Пока файлов нет — игра звучит синтезом и не ломается.
