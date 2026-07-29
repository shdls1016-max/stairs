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

  assert.equal(PRELOAD_ASSETS.length, 19);
  await Promise.all(
    PRELOAD_ASSETS.map((asset) =>
      access(new URL(`../public${asset}`, import.meta.url)),
    ),
  );
});

test("result sound assets use the current failure cue", async () => {
  const component = await readFile(new URL("../app/LumiClimbGame.tsx", import.meta.url), "utf8");

  await access(new URL("../public/assets/audio/game-out2.mp3", import.meta.url));
  assert.match(component, /game-out2\.mp3/);
  assert.doesNotMatch(component, /game-out3\.mp3/);
});

test("height regions blend continuously and resolve to one full background", async () => {
  const {
    backgroundWeights,
    comboLevelForStreak,
    directionForFloor,
    laneForPlatform,
    sceneryOpacity,
    stageForFloor,
  } = await importGameConfig();

  for (const floor of [0, 15, 29, 30, 45, 59, 60, 75, 89, 90, 105, 119, 120, 999]) {
    const weights = backgroundWeights(floor);
    assert.equal(weights.length, 5);
    assert.ok(weights.every((weight) => weight >= 0 && weight <= 1));
    assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);

    const opacity = sceneryOpacity(floor);
    assert.ok(Object.values(opacity).every((value) => value >= 0 && value <= 1));
  }

  assert.equal(stageForFloor(0).name, "초원");
  assert.equal(stageForFloor(30).name, "숲의 입구");
  assert.equal(stageForFloor(60).name, "깊은 숲");
  assert.equal(stageForFloor(90).name, "나무 꼭대기");
  assert.equal(stageForFloor(120).name, "낮은 하늘");
  assert.equal(comboLevelForStreak(4), 0);
  assert.equal(comboLevelForStreak(5), 1);
  assert.equal(comboLevelForStreak(10), 2);
  assert.equal(comboLevelForStreak(20), 3);

  for (let currentFloor = 2; currentFloor < 60; currentFloor += 1) {
    const cameraShift = directionForFloor(currentFloor + 1);
    assert.equal(laneForPlatform(currentFloor, currentFloor), 0);

    for (let targetFloor = currentFloor - 1; targetFloor <= currentFloor + 4; targetFloor += 1) {
      assert.equal(
        laneForPlatform(currentFloor + 1, targetFloor),
        laneForPlatform(currentFloor, targetFloor) - cameraShift,
      );
    }
  }
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
  assert.doesNotMatch(component, /NEW RECORD|>Retry<|>Home</);
  assert.match(component, /aria-label="STARBOUND STEPS"/);
  assert.match(component, /className="play-label">PLAY</);
  assert.doesNotMatch(component, /className="home-best"|className="control-hint"/);
  assert.match(component, /className="home-ambience"/);
  assert.match(component, /key={`combo-\$\{floor\}`}/);
  assert.match(component, /<strong>{floor\.toLocaleString\(\)}<\/strong>/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /userScalable:\s*false/);
  assert.doesNotMatch(component, /<canvas|<svg/i);
  assert.match(component, /TravelSparkles/);
  assert.match(component, /player-trails/);
  assert.match(component, /recordCelebration/);
  assert.match(component, /meadow-dandelion-seed/);
  assert.match(component, /meadow-butterfly/);
  assert.doesNotMatch(component, /SPRITES\.feather/);
  assert.match(css, /travel-spark/);
  assert.match(css, /clamp\(/);
  assert.match(css, /--ui-lavender:\s*#ad9bef/i);
  assert.match(css, /--ui-mint:\s*#91dfc8/i);
  assert.match(css, /@keyframes panel-jelly-in/);
  assert.match(css, /\.primary-button:active/);
  assert.match(css, /@keyframes player-combo-pop/);
  assert.match(css, /@keyframes home-mote-drift/);
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
  assert.match(html, /STARBOUND STEPS/);
  assert.match(html, /screen-loading/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

await access(projectRoot);
