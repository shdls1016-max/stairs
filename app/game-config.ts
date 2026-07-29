export const ASSETS = {
  character: {
    idle: "/assets/characters/lumi/base/lumi-idle-base.png",
    climb: "/assets/characters/lumi/poses/lumi-climb-left-up-v2.png",
    turn: "/assets/characters/lumi/poses/lumi-direction-turn.png",
    fail: "/assets/characters/lumi/poses/lumi-fail-misstep.png",
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
  ui: {
    wideButton: "/assets/ui/ui-button-wide.png",
    iconButton: "/assets/ui/ui-button-icon.png",
    recordPanel: "/assets/ui/ui-panel-record.png",
    pauseIcon: "/assets/ui/ui-icon-pause.png",
    chevron: "/assets/ui/ui-chevron-down.png",
  },
} as const;

export const PRELOAD_ASSETS = [
  ...Object.values(ASSETS.character),
  ...ASSETS.backgrounds,
  ...Object.values(ASSETS.sheets),
  ...Object.values(ASSETS.ui),
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

export function laneForPlatform(currentFloor: number, targetFloor: number) {
  let lane = 0;

  if (targetFloor > currentFloor) {
    for (let step = currentFloor + 1; step <= targetFloor; step += 1) {
      lane += directionForFloor(step);
    }
  } else {
    for (let step = currentFloor; step > targetFloor; step -= 1) {
      lane -= directionForFloor(step);
    }
  }

  return lane;
}

export function stageForFloor(floor: number) {
  if (floor < 30) return { name: "초원", platformRow: 0 };
  if (floor < 60) return { name: "숲의 입구", platformRow: 0 };
  if (floor < 90) return { name: "깊은 숲", platformRow: 1 };
  if (floor < 120) return { name: "나무 꼭대기", platformRow: 2 };
  return { name: "낮은 하늘", platformRow: 3 };
}

function mix(from: number, to: number, value: number) {
  const progress = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return progress * progress * (3 - 2 * progress);
}

export function backgroundWeights(floor: number) {
  const weights = [0, 0, 0, 0, 0];
  const clampedFloor = Math.max(0, floor);
  const currentTheme = Math.min(4, Math.floor(clampedFloor / 30));

  if (currentTheme === 4) {
    weights[4] = 1;
    return weights;
  }

  const progress = mix(currentTheme * 30, (currentTheme + 1) * 30, clampedFloor);
  weights[currentTheme] = 1 - progress;
  weights[currentTheme + 1] = progress;
  return weights;
}

export function sceneryOpacity(floor: number) {
  const weights = backgroundWeights(floor);

  return {
    meadow: weights[0] + weights[1] * 0.35,
    forest: weights[1] * 0.65 + weights[2] + weights[3] * 0.7,
    sky: weights[3] * 0.3 + weights[4],
  };
}
