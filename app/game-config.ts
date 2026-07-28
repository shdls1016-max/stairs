export const ASSETS = {
  character: {
    idle: "/assets/characters/lumi/base/lumi-idle-base.png",
    climb: "/assets/characters/lumi/poses/lumi-climb-left-up-v2.png",
    turn: "/assets/characters/lumi/poses/lumi-direction-turn.png",
    fail: "/assets/characters/lumi/poses/lumi-fail-misstep-v2.png",
    record: "/assets/characters/lumi/poses/lumi-new-record-celebration-v3.png",
  },
  backgrounds: [
    "/assets/environment/backgrounds/far-01-meadow-hills.png",
    "/assets/environment/backgrounds/far-02-young-forest.png",
    "/assets/environment/backgrounds/far-03-deep-forest.png",
    "/assets/environment/backgrounds/far-04-treetop-sky.png",
    "/assets/environment/backgrounds/far-05-low-sky-clouds.png",
  ],
  sheets: {
    meadow: "/assets/environment/object-sheets/meadow-objects.png",
    forest: "/assets/environment/object-sheets/forest-objects.png",
    sky: "/assets/environment/object-sheets/sky-objects.png",
    stairs: "/assets/environment/object-sheets/stair-platforms.png",
    particles: "/assets/environment/object-sheets/particles.png",
  },
} as const;

export const PRELOAD_ASSETS = [
  ...Object.values(ASSETS.character),
  ...ASSETS.backgrounds,
  ...Object.values(ASSETS.sheets),
];

export type Direction = -1 | 1;

export function comboLevelForStreak(streak: number) {
  if (streak >= 20) return 3;
  if (streak >= 10) return 2;
  if (streak >= 5) return 1;
  return 0;
}

export function directionForFloor(floor: number): Direction {
  const value = Math.sin((floor + 4) * 12.9898) * 43758.5453;
  return value - Math.floor(value) > 0.5 ? 1 : -1;
}

export function stageForFloor(floor: number) {
  if (floor < 80) return { name: "초원", platformRow: 0 };
  if (floor < 120) return { name: "숲의 입구", platformRow: 0 };
  if (floor < 240) return { name: "깊은 숲", platformRow: 1 };
  if (floor < 320) return { name: "높은 나무", platformRow: 2 };
  if (floor < 360) return { name: "나무 꼭대기", platformRow: 2 };
  return { name: "낮은 하늘", platformRow: 3 };
}

function mix(from: number, to: number, value: number) {
  const progress = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return progress * progress * (3 - 2 * progress);
}

export function backgroundWeights(floor: number) {
  const weights = [0, 0, 0, 0, 0];

  if (floor < 80) {
    weights[0] = 1;
  } else if (floor < 120) {
    const progress = mix(80, 120, floor);
    weights[0] = 1 - progress;
    weights[1] = progress;
  } else if (floor < 200) {
    const progress = mix(120, 200, floor);
    weights[1] = 1 - progress;
    weights[2] = progress;
  } else if (floor < 240) {
    weights[2] = 1;
  } else if (floor < 320) {
    const progress = mix(240, 320, floor);
    weights[2] = 1 - progress;
    weights[3] = progress;
  } else if (floor < 360) {
    const progress = mix(320, 360, floor);
    weights[3] = 1 - progress;
    weights[4] = progress;
  } else {
    weights[4] = 1;
  }

  return weights;
}

export function sceneryOpacity(floor: number) {
  return {
    meadow: 1 - mix(70, 150, floor),
    forest: mix(70, 135, floor) * (1 - mix(315, 365, floor)),
    sky: mix(295, 365, floor),
  };
}
