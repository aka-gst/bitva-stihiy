# KNB: Tactical Evolution

A playable browser prototype that turns rock-paper-scissors into a compact
tactical combat system.

![Status](https://img.shields.io/badge/status-playable%20prototype-4c9aff)
![Runtime](https://img.shields.io/badge/runtime-browser-55f58b)
![License](https://img.shields.io/badge/license-MIT-blue)

## Play

Open `index.html` in a modern browser. No installation, account, or server is
required.

## Design idea

Classic rock-paper-scissors has clear rules but almost no long-term tactical
choice. This prototype explores how it changes when the player must compose a
sequence of moves and manage combat resources.

The current build includes:

- four difficulty/mode variants;
- five-action rounds and a one-action fencing mode;
- health, damage, stun, and special attacks;
- opponents with distinct visual identities;
- a battle log and per-gesture statistics;
- a timer and restartable end state.

## My role

I created the concept, rules, game-design documentation, interaction flow, and
playable prototype. AI tools were used to accelerate implementation drafts and
iterations; I directed the work, reviewed behavior, balanced the rules, and
kept the prototype aligned with the design goals.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Complete playable browser prototype |
| `docs/game-design-document.docx` | Early game-design document |
| `docs/concept-art.png` | Early visual reference |
| `tests/smoke.test.mjs` | Structural regression checks |

## Quality check

```bash
node --test tests/smoke.test.mjs
```

The smoke test confirms that the standalone build keeps the required game
modes, combat functions, UI regions, and Russian interface text.

## Status and limitations

This is a playable prototype, not a finished commercial game. The code is
currently packaged as one HTML file, balance is based on exploratory testing,
and the game has no automated browser-play suite yet.

## Next steps

- separate combat logic from the DOM;
- add deterministic unit tests for round resolution and special attacks;
- add keyboard and accessibility support;
- test mobile layouts;
- publish the current build through GitHub Pages;
- record a short gameplay GIF for the project page.

## License

Code in this repository is released under the MIT License. The included design
document and concept art are portfolio materials by the repository author.
