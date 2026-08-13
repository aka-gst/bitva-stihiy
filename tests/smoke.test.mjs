import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("standalone game keeps required interface regions", () => {
  for (const id of ["start-menu", "g-zone", "p-slots", "c-slots", "chat", "end-screen"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("all four game modes remain available", () => {
  for (const mode of ["easy", "medium", "hard", "duel"]) {
    assert.match(html, new RegExp(`selectDiff\\(["']${mode}["']\\)`));
  }
});

test("critical combat functions remain present", () => {
  for (const name of ["launchGame", "runRound", "useSuper", "updateSlots", "startTimer"]) {
    assert.match(html, new RegExp(`function\\s+${name}\\s*\\(`));
  }
});

test("Russian player-facing actions remain present", () => {
  for (const label of ["ИГРАТЬ", "В БОЙ", "РЕСТАРТ"]) {
    assert.ok(html.includes(label), `missing label: ${label}`);
  }
});
