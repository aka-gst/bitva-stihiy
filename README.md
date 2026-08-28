# KNB: Tactical Evolution

A browser tactical fighter built on elements: two mages trade spells while the
player composes a chain of five moves in advance.

![Status](https://img.shields.io/badge/status-playable%20prototype-4c9aff)
![Runtime](https://img.shields.io/badge/runtime-browser-55f58b)
![License](https://img.shields.io/badge/license-MIT-blue)

## Play

The game is built from ES modules, so it needs to be served over HTTP rather
than opened directly from the filesystem:

```bash
npm start
```

Then open `http://localhost:4189/`. No build step, no dependencies, and no
backend — the server is a 60-line static file server used only for local
development; deployment is plain static hosting.

## Deployment

The build is static, but it is no longer a single file: `index.html` loads
`./src/main.js` as an ES module. Copying `index.html` alone serves a blank page.

```bash
sh tools/deploy.sh            # проверить сборку и показать, что уедет
sh tools/deploy.sh --deploy   # и выложить
```

The script runs the tests first, ships only what belongs on the server, and
then checks that the live paths answer 200. Deployed by hand, the file set is:

```
index.html
src/
styles/
```

`tools/`, `tests/`, `docs/` and `package.json` are development-only and do not
need to ship. Paths in the markup are relative, so the game works from a
subdirectory such as `/knb`. The host page is expected to provide
`/game-menu.css`, `/player-name.js` and the `/api/leaderboard/*` endpoints; when
they are missing the game still runs, just without the site chrome and the
scoreboard.

## Design idea

Classic rock-paper-scissors has clear rules but almost no long-term tactical
choice, and — more importantly — no reason why one gesture beats another. This
build replaces it with three elements, so every matchup carries its own
explanation:

| | beats | why |
|---|---|---|
| 🔥 Fire | 🌪 Wind | fire flares up in wind |
| 💧 Water | 🔥 Fire | water puts out fire |
| 🌪 Wind | 💧 Water | wind scatters water |

A round is five clashes. Both sides fill their chain in secret, then the chains
are revealed and resolved slot by slot.

- **Signature.** Every mage favours one element — and nothing on screen names it.
  A strip above the arena keeps only what you actually saw: how often each
  element has come at you, and the opponent's previous chain in full. The
  conclusion is yours to draw. Beat the signature and you gain charge — and once
  per round you also stun the opponent, who then skips the next slot. Lose to the
  signature and you take double damage.
- **Bait.** Answering the signature every time is obvious, and the opponent
  notices. They start mixing in the element that beats your expected answer. The
  counter-play is to sometimes cast their own signature: it draws against the
  signature and burns the bait.
- **Combos.** Three consecutive slots can form a pattern, highlighted while you
  build the chain rather than revealed afterwards. `AAA` is a **surge** — three
  wins required, three damage. `ABA` is a **pierce** — two wins, one damage, and
  it holds even when one exchange is broken. `ABC` is a **prism** — two wins, two
  charge, paid for not being readable. A combo amplifies success rather than
  replacing it: exchanges must be won, not merely survived. The tension is
  deliberate — the strongest pattern needs repetition, and repetition is what the
  opponent reads. Higher tiers answer a habitual combo with one precise strike
  inside it instead of blanket-countering the whole chain.
- **Special.** Charge comes from beating a signature and from calling an element
  exactly right (matching elements cancel, and the collision charges you). Three
  charges arm a strike worth 2 damage — and **you** choose which slot in the chain
  carries it. That choice matters: a blazing staff is visible, so an opponent who
  has seen you strike from the same slot twice will close it. Lose that exchange
  and the 2 come back at you; run into the same element and both simply cancel.
- **Pattern reading.** Opponents past the first tier remember recent moves and
  lock part of their chain to a hard counter when one element dominates.
- **Rhythm reading.** The top tiers remember by *position*: if slot three gets
  the same kind of answer round after round, that slot gets a precise reply.
  Even a clean alternation is a pattern — though three consistent rounds are
  required before an opponent will claim to see one, so ordinary variance is not
  mistaken for a habit. The strongest play is to have no readable habit at all —
  which is the point the whole campaign builds toward.

## Modes

**Story** — the Tower of Three Elements: five opponents in ascending order.
Health and charge carry between fights, and part of the health is restored after
each win. The player starts with more health than the early opponents on purpose:
with the signature hidden, the first round of any fight is a guess, and a guess
should cost you dearly without ending the run. Each tier introduces exactly one new idea: the signature, pattern
reading, stunning, a mask that switches mid-chain, and a second boss phase.

**Free fight** — four variants against a random mage: full log, hidden damage,
round summary only, and a fencing mode with a single exchange at a time.

## Controls

Mouse or keyboard: `1`/`2`/`3` (or `Q`/`W`/`E`) for elements, `Backspace` to
undo, `Enter` to fight, `Space` for the special. Animation speed is switchable
from the battle header and respects `prefers-reduced-motion`.

## Architecture

Logic is separated from rendering: a move is data, not a DOM mutation.
`resolveRound` takes both prepared chains and returns a new state together with
a list of events; the animation simply replays that list.

| Path | Purpose |
|---|---|
| `index.html` | Shell: screen markup |
| `styles/game.css` | Styling, arena, and animation keyframes |
| `src/rules.js` | Elements and the reason each one beats another |
| `src/combos.js` | Chain patterns: what they are and what they cost |
| `src/engine.js` | Round resolution as an event stream, DOM-free |
| `src/ai.js` | Opponent behaviour: signature, baits, pattern and rhythm reading |
| `src/campaign.js` | Five tower tiers and their text |
| `src/modes.js` | Free-fight modes |
| `src/arena.js` | Mages, arena atmosphere, and the spell-exchange animation |
| `src/mage.js` | Mage artwork (SVG) |
| `src/ui.js` | Interface rendering and the tutorial screen |
| `src/main.js` | Wiring: screens, story flow, battle loop |
| `tools/serve.mjs` | Local static server for development |
| `tools/deploy.sh` | Ships the build to aka-gst.ru/knb/ |
| `tools/balance.mjs` | Balance simulator for tuning opponents |
| `tests/` | Rules, AI, campaign, and build-structure tests |
| `docs/` | Early design document and concept art |

## Quality check

```bash
npm test
```

Tests cover: the element wheel is a closed cycle, round resolution (draw, crit,
parry, stun cap, special placement and fizzle, knockout), observation bookkeeping,
the engine never touches the DOM, AI behaviour (signature frequency, baits,
pattern reading, rhythm detection, punishment budget, mask switching), campaign
structure, and shell integrity.

Balance is tuned against a simulation rather than by feel:

```bash
npm run balance
```

## My role

I created the concept, rules, game-design documentation, interaction flow, and
playable prototype. AI tools were used to accelerate implementation drafts and
iterations; I directed the work, reviewed behavior, balanced the rules, and
kept the prototype aligned with the design goals.

## Status and limitations

This is a playable prototype, not a finished commercial game.

- Balance is derived from simulation, not from feel, and the simulated players
  infer the signature from what they have seen — the same information a human
  gets. A player who mixes their answers descends ≈91 / 84 / 74 / 64 / 53 %
  across the five tiers; random flailing stays far below at every tier. Purely
  mechanical countering is comfortable through tier four and then falls behind
  at the finale, which is the intended arc rather than an oversight.
- The AI reads three things: a dominant element, methodical signature
  countering, and a per-slot habit. It still has no model of the player beyond
  those, so a human who deliberately mixes will stay ahead of it.
- None of this has been validated by live playtesting at scale.
- There is no network multiplayer yet.

## Next steps

- asynchronous link-based multiplayer on top of the now-stable rules;
- live playtests to validate the balance model;
- character progression and cosmetic variety between fighters.

## License

Code in this repository is released under the MIT License. The included design
document and concept art are portfolio materials by the repository author.
