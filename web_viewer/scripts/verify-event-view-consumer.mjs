import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../src/App.vue", import.meta.url), "utf8");
const source = app.match(/async function loadEventDetail\([^]*?\n\}/)[0];
const root = () => ({
  id: "410001",
  view: {
    schemaVersion: 2,
    identity: { id: 410001 },
    episodes: [],
    cards: [],
    cast: [],
    units: [],
    castReferences: [],
    readingEntries: [],
    provenance: { eventId: 410001 },
    rewards: { generalPages: [{ url: "p1" }, { url: "p2" }], generalCount: 2 },
  },
});
function setup() {
  const data = new Map([
    ["detail", root()],
    ["p1", { rows: [{ eventId: 410001, sourceRowId: 1 }] }],
    ["p2", { rows: [{ eventId: 410001, sourceRowId: 2 }] }],
  ]);
  const calls = [];
  const context = vm.createContext({
    navigation: { getLoadOptions: () => ({}) },
    loadEventCatalog: async () => [{ id: "410001", detail: { url: "detail" } }],
    readModelClient: {
      load: async (descriptor, options) => {
        calls.push(descriptor.url);
        const value = structuredClone(data.get(descriptor.url));
        options?.validate?.(value);
        return value;
      },
    },
  });
  vm.runInContext(source, context);
  return { data, calls, load: () => context.loadEventDetail("410001") };
}
{
  const t = setup(),
    result = await t.load();
  assert.equal(result.view.rewards.general.length, 2);
  assert.deepEqual(t.calls, ["detail", "p1", "p2"]);
  assert.equal(result.view.event, undefined);
  assert.equal(result.view.masterEvent, undefined);
}
for (const corrupt of [
  (t) => (t.data.get("detail").view.schemaVersion = 1),
  (t) => (t.data.get("detail").view.identity.id = 410002),
  (t) => (t.data.get("detail").view.rewards.generalCount = 3),
  (t) => (t.data.get("p2").rows[0].eventId = 410002),
  (t) => (t.data.get("p1").rows = null),
]) {
  const t = setup();
  corrupt(t);
  await assert.rejects(t.load(), /identity|shape/i);
}
console.log(
  "Event v2 consumer: descriptor-only reward hydration, old contract rejection, mixed IDs and incomplete pages rejected",
);
