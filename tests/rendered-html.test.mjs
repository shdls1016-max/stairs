import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);

async function importGameConfig() {
  const source = await readFile(new URL("../app/game-config.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("all configured game artwork exists in public assets", async () => {
  const { PRELOAD_ASSETS } = await importGameConfig();

  assert.equal(PRELOAD_ASSETS.length, 15);
  await Promise.all(
    PRELOAD_ASSETS.map((asset) =>
      access(new URL(`../public${asset}`, import.meta.url)),
    ),
  );
});

test("height regions blend continuously and resolve to one full background", async () => {
  const { backgroundWeights, comboLevelForStreak, sceneryOpacity, stageForFloor } =
    await importGameConfig();

  for (const floor of [0, 79, 80, 100, 119, 120, 199, 200, 239, 240, 319, 320, 359, 360, 999]) {
    const weights = backgroundWeights(floor);
    assert.equal(weights.length, 5);
    assert.ok(weights.every((weight) => weight >= 0 && weight <= 1));
    assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);

    const opacity = sceneryOpacity(floor);
    assert.ok(Object.values(opacity).every((value) => value >= 0 && value <= 1));
  }

  assert.equal(stageForFloor(0).name, "초원");
  assert.equal(stageForFloor(80).name, "숲의 입구");
  assert.equal(stageForFloor(120).name, "깊은 숲");
  assert.equal(stageForFloor(240).name, "높은 나무");
  assert.equal(stageForFloor(320).name, "나무 꼭대기");
  assert.equal(stageForFloor(360).name, "낮은 하늘");
  assert.equal(comboLevelForStreak(4), 0);
  assert.equal(comboLevelForStreak(5), 1);
  assert.equal(comboLevelForStreak(10), 2);
  assert.equal(comboLevelForStreak(20), 3);
});

test("responsive shell uses dynamic viewport and safe-area rules", async () => {
  const [css, component, layout] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/LumiClimbGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(component, /localStorage\.setItem\(BEST_KEY/);
  assert.match(component, /ArrowLeft/);
  assert.match(component, /onPointerDown/);
  assert.match(component, /최고 기록 갱신!/);
  assert.match(component, /다시 도전/);
  assert.match(component, /홈으로/);
  assert.doesNotMatch(component, /NEW RECORD|>Retry<|>Home<|>PLAY/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /userScalable:\s*false/);
  assert.doesNotMatch(component, /<canvas|<svg/i);
  assert.match(component, /LandingBurst/);
  assert.match(component, /player-trails/);
  assert.match(component, /recordCelebration/);
  assert.match(css, /landing-particle/);
  assert.match(css, /clamp\(/);
});

test("production worker renders the game document", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /루미: 끝없는 오르기/);
  assert.match(html, /screen-loading/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

await access(projectRoot);
