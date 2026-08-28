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
python3 -m http.server 4189
```

Then open `http://localhost:4189/`. No build step and no backend are required —
everything else is static.

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

- **Signature.** Every mage favours one element, shown above the arena. Beat the
  signature and you gain charge — and once per round you also stun the opponent,
  who then skips the next slot. Lose to the signature and you take double damage.
- **Bait.** Answering the signature every time is obvious, and the opponent
  notices. They start mixing in the element that beats your expected answer. The
  counter-play is to sometimes cast their own signature: it draws against the
  signature and burns the bait.
- **Special.** Three charges arm a strike that deals 2 in the first slot of the
  round — but if that slot is not won, the same 2 come back at you.
- **Pattern reading.** Opponents past the first tier remember recent moves and
  lock part of their chain to a hard counter when one element dominates.

## Modes

**Story** — the Tower of Three Elements: five opponents in ascending order.
Health and charge carry between fights, and part of the health is restored after
each win. Each tier introduces exactly one new idea: the signature, pattern
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
| `src/engine.js` | Round resolution as an event stream, DOM-free |
| `src/ai.js` | Opponent behaviour: signature, baits, pattern reading |
| `src/campaign.js` | Five tower tiers and their text |
| `src/modes.js` | Free-fight modes |
| `src/arena.js` | Mages and the spell-exchange animation |
| `src/mage.js` | Mage artwork (SVG) |
| `src/ui.js` | Interface rendering and the tutorial screen |
| `src/main.js` | Wiring: screens, story flow, battle loop |
| `tools/balance.mjs` | Balance simulator for tuning opponents |
| `tests/` | Rules, AI, campaign, and build-structure tests |
| `docs/` | Early design document and concept art |

## Quality check

```bash
npm test
```

55 tests: the element wheel is a closed cycle, round resolution (draw, crit,
parry, stun cap, special, knockout), the engine never touches the DOM, AI
behaviour (signature frequency, baits, pattern reading, mask switching),
campaign structure, and shell integrity.

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

- Balance is derived from simulation: the five tiers give a descending win rate
  (≈100 / 88 / 74 / 69 / 53 % for a player who simply counters the signature),
  and a strategy that accounts for baits wins noticeably more often — but that
  is a model, not live playtesting.
- The AI catches two patterns: a repeated element and methodical signature
  countering. More complex shapes — strict alternation between two elements,
  for instance — still go unnoticed.
- There is no network multiplayer yet.

## Next steps

- multiplayer on top of the now-stable rules;
- detection of periodic patterns in player behaviour;
- live playtests to validate the balance model.

## License

Code in this repository is released under the MIT License. The included design
document and concept art are portfolio materials by the repository author.
