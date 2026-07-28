"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ASSETS,
  PRELOAD_ASSETS,
  backgroundWeights,
  comboLevelForStreak,
  directionForFloor,
  sceneryOpacity,
  stageForFloor,
  type Direction,
} from "./game-config";

type Screen =
  | "loading"
  | "home"
  | "playing"
  | "paused"
  | "gameover"
  | "record"
  | "settings";

type Settings = {
  effects: boolean;
  haptics: boolean;
  reducedMotion: boolean;
};

const BEST_KEY = "lumi-climb-best";
const CURRENT_KEY = "lumi-climb-current";
const SETTINGS_KEY = "lumi-climb-settings";

const defaultSettings: Settings = {
  effects: true,
  haptics: true,
  reducedMotion: false,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type SpriteCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SpriteSheet = {
  source: string;
  width: number;
  height: number;
};

const SPRITE_SHEETS = {
  meadow: { source: ASSETS.sheets.meadow, width: 1402, height: 1122 },
  forest: { source: ASSETS.sheets.forest, width: 1024, height: 1536 },
  sky: { source: ASSETS.sheets.sky, width: 1536, height: 1024 },
  stairs: { source: ASSETS.sheets.stairs, width: 1122, height: 1402 },
  particles: { source: ASSETS.sheets.particles, width: 1680, height: 850 },
} satisfies Record<string, SpriteSheet>;

const SPRITES = {
  grass1: { x: 133, y: 123, width: 249, height: 122 },
  grass2: { x: 569, y: 95, width: 227, height: 149 },
  grass3: { x: 983, y: 99, width: 234, height: 147 },
  flower1: { x: 97, y: 372, width: 134, height: 159 },
  flower2: { x: 351, y: 341, width: 163, height: 198 },
  flower3: { x: 626, y: 365, width: 121, height: 170 },
  rock1: { x: 857, y: 416, width: 263, height: 121 },
  rock2: { x: 1120, y: 447, width: 181, height: 90 },
  shrub1: { x: 103, y: 645, width: 247, height: 178 },
  shrub2: { x: 350, y: 657, width: 350, height: 165 },
  tree1: { x: 700, y: 618, width: 278, height: 216 },
  tree2: { x: 1087, y: 598, width: 202, height: 236 },
  butterfly: { x: 963, y: 934, width: 132, height: 106 },
  trunk1: { x: 130, y: 64, width: 291, height: 531 },
  trunk2: { x: 570, y: 95, width: 330, height: 504 },
  branch1: { x: 44, y: 670, width: 212, height: 221 },
  branch2: { x: 256, y: 668, width: 256, height: 235 },
  branch3: { x: 512, y: 706, width: 256, height: 203 },
  branch4: { x: 768, y: 717, width: 204, height: 187 },
  leaves1: { x: 42, y: 977, width: 214, height: 181 },
  leaves2: { x: 256, y: 969, width: 256, height: 189 },
  leaves3: { x: 512, y: 974, width: 256, height: 191 },
  nest: { x: 768, y: 1011, width: 215, height: 156 },
  bird1: { x: 98, y: 1218, width: 255, height: 195 },
  bird2: { x: 350, y: 1230, width: 341, height: 191 },
  feather: { x: 781, y: 1244, width: 149, height: 171 },
  cloud1: { x: 115, y: 99, width: 337, height: 216 },
  cloud2: { x: 557, y: 94, width: 381, height: 227 },
  cloud3: { x: 1042, y: 97, width: 381, height: 223 },
  longCloud1: { x: 102, y: 406, width: 647, height: 178 },
  longCloud2: { x: 818, y: 418, width: 604, height: 164 },
  smallCloud1: { x: 399, y: 675, width: 203, height: 69 },
  smallCloud2: { x: 910, y: 663, width: 227, height: 95 },
  flock: { x: 279, y: 835, width: 201, height: 98 },
  stone: { x: 59, y: 166, width: 464, height: 184 },
  wood: { x: 49, y: 491, width: 481, height: 186 },
  branchStep: { x: 52, y: 798, width: 462, height: 173 },
  cloudStep: { x: 60, y: 1084, width: 465, height: 211 },
  lightDot: { x: 1104, y: 251, width: 81, height: 81 },
  lightDiamond: { x: 1324, y: 249, width: 84, height: 84 },
  starShard1: { x: 326, y: 548, width: 126, height: 164 },
  starShard2: { x: 588, y: 548, width: 133, height: 163 },
} satisfies Record<string, SpriteCrop>;

function SheetCrop({
  sheet,
  crop,
  className = "",
}: {
  sheet: SpriteSheet;
  crop: SpriteCrop;
  className?: string;
}) {
  const style = {
    aspectRatio: `${crop.width} / ${crop.height}`,
    "--sheet-width": `${(sheet.width / crop.width) * 100}%`,
    "--sheet-left": `${-(crop.x / crop.width) * 100}%`,
    "--sheet-top": `${-(crop.y / crop.height) * 100}%`,
  } as CSSProperties;

  return (
    <span className={`sheet-crop ${className}`} style={style}>
      <img src={sheet.source} alt="" draggable="false" />
    </span>
  );
}

function preloadImages(onProgress: (value: number) => void) {
  let completed = 0;
  return Promise.all(
    PRELOAD_ASSETS.map(
      (source) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          const finish = () => {
            completed += 1;
            onProgress(Math.round((completed / PRELOAD_ASSETS.length) * 100));
            resolve();
          };
          image.onload = finish;
          image.onerror = finish;
          image.src = source;
        }),
    ),
  );
}

function WorldBackground({ floor, pulse }: { floor: number; pulse: number }) {
  const weights = backgroundWeights(floor);
  const opacity = sceneryOpacity(floor);
  const youngForest = clamp((floor - 55) / 75, 0, 1);
  const highForest = clamp((floor - 155) / 95, 0, 1) * (1 - clamp((floor - 320) / 55, 0, 1));
  const forestLife = clamp((floor - 175) / 90, 0, 1) * (1 - clamp((floor - 335) / 35, 0, 1));
  const cloudCover = clamp((floor - 295) / 75, 0, 1);
  const worldStyle = {
    "--world-shift": `${-((floor % 10) * 1.7)}px`,
    "--cloud-speed": `${clamp(34 - floor / 24, 18, 34)}s`,
  } as CSSProperties;

  return (
    <div className={`world world--pulse-${pulse % 2}`} style={worldStyle} aria-hidden="true">
      <div className="sky-wash" />
      {ASSETS.backgrounds.map((source, index) => (
        <div
          className={`far-layer far-layer--${index + 1}`}
          key={source}
          style={{ backgroundImage: `url("${source}")`, opacity: weights[index] }}
        />
      ))}

      <div className="scenery scenery--meadow" style={{ opacity: opacity.meadow }}>
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.grass1} className="scene-object meadow-grass meadow-grass--1" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.grass2} className="scene-object meadow-grass meadow-grass--2" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.grass3} className="scene-object meadow-grass meadow-grass--3" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.flower1} className="scene-object meadow-flower meadow-flower--1" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.flower3} className="scene-object meadow-flower meadow-flower--2" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.rock1} className="scene-object meadow-rock meadow-rock--1" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.rock2} className="scene-object meadow-rock meadow-rock--2" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.shrub1} className="scene-object meadow-shrub meadow-shrub--1" />
        <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.shrub2} className="scene-object meadow-shrub meadow-shrub--2" />
        <div className="young-tree-group" style={{ opacity: youngForest }}>
          <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.tree1} className="scene-object young-tree young-tree--1" />
          <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.tree2} className="scene-object young-tree young-tree--2" />
          <SheetCrop sheet={SPRITE_SHEETS.meadow} crop={SPRITES.tree1} className="scene-object young-tree young-tree--3" />
        </div>
      </div>

      <div className="scenery scenery--forest" style={{ opacity: opacity.forest }}>
        <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.trunk1} className="scene-object forest-trunk forest-trunk--1" />
        <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.trunk2} className="scene-object forest-trunk forest-trunk--2" />
        <div className="high-forest-group" style={{ opacity: highForest }}>
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.branch1} className="scene-object forest-branch forest-branch--1" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.branch3} className="scene-object forest-branch forest-branch--2" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.leaves1} className="scene-object forest-leaves forest-leaves--1" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.leaves2} className="scene-object forest-leaves forest-leaves--2" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.leaves3} className="scene-object forest-leaves forest-leaves--3" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.nest} className="scene-object forest-nest" />
        </div>
        <div className="forest-life-group" style={{ opacity: forestLife }}>
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.bird1} className="scene-object forest-bird forest-bird--1" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.bird2} className="scene-object forest-bird forest-bird--2" />
          <SheetCrop sheet={SPRITE_SHEETS.forest} crop={SPRITES.feather} className="scene-object forest-feather" />
        </div>
      </div>

      <div className="scenery scenery--sky" style={{ opacity: opacity.sky }}>
        <div className="sky-object-group" style={{ opacity: cloudCover }}>
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.cloud1} className="scene-object sky-cloud sky-cloud--1" />
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.cloud2} className="scene-object sky-cloud sky-cloud--2" />
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.cloud3} className="scene-object sky-cloud sky-cloud--3" />
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.longCloud1} className="scene-object sky-cloud sky-cloud--4" />
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.smallCloud2} className="scene-object sky-cloud sky-cloud--5" />
          <SheetCrop sheet={SPRITE_SHEETS.sky} crop={SPRITES.flock} className="scene-object sky-flock" />
        </div>
      </div>
      <div className="light-haze" />
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  className = "",
}: {
  label: string;
  icon: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <section className="loading-screen" data-testid="screen-loading">
      <div className="loading-glow" />
      <img className="loading-star" src={ASSETS.character.idle} alt="" />
      <div className="loading-copy">
        <p>별빛을 모으는 중</p>
        <div className="loading-track" aria-label={`로딩 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>{progress}%</small>
      </div>
    </section>
  );
}

function HomeScreen({
  best,
  onPlay,
  onSettings,
}: {
  best: number;
  onPlay: () => void;
  onSettings: () => void;
}) {
  return (
    <section className="home-screen" data-testid="screen-home">
      <WorldBackground floor={0} pulse={0} />
      <IconButton label="설정 열기" icon="⚙︎" onClick={onSettings} className="home-settings" />
      <div className="home-title">
        <div className="game-logo" aria-label="STARBOUND STEPS">
          <span className="logo-emblem" aria-hidden="true">★</span>
          <span className="logo-topline">STARBOUND</span>
          <strong>STEPS</strong>
        </div>
      </div>
      <div className="home-content">
        <div className="home-hero">
          <div className="hero-aura" />
          <img src={ASSETS.character.idle} alt="별빛 여행자 루미" />
        </div>
        <div className="home-actions">
          <div className="home-best">
            <span className="best-star" aria-hidden="true">★</span>
            <span className="best-copy">
              <small>최고 높이</small>
              <strong>{best.toLocaleString()}층</strong>
            </span>
          </div>
          <button className="primary-button play-button" type="button" onClick={onPlay}>
            <span className="play-symbol" aria-hidden="true" />
            <span className="play-label">PLAY</span>
          </button>
          <p className="control-hint">
            화면 좌우 터치 · 키보드 ← →
          </p>
        </div>
      </div>
    </section>
  );
}

function Hud({
  floor,
  best,
  recordTarget,
  comboLevel,
  time,
  stage,
  onPause,
  onSettings,
}: {
  floor: number;
  best: number;
  recordTarget: number;
  comboLevel: number;
  time: number;
  stage: string;
  onPause: () => void;
  onSettings: () => void;
}) {
  const floorsToRecord = recordTarget - floor;
  const isNearRecord = recordTarget > 0 && floorsToRecord >= 0 && floorsToRecord <= 10;

  return (
    <header className="hud">
      <div className="score-cluster">
        <div className="score-readout score-readout--current">
          <span>현재 높이</span>
          <strong data-testid="height-value">{floor.toLocaleString()}층</strong>
        </div>
        <div className={`score-readout score-readout--best ${isNearRecord ? "is-near-record" : ""}`}>
          <span>최고 기록</span>
          <strong data-testid="best-value">{best.toLocaleString()}층</strong>
        </div>
        <div className="stage-label">{stage}</div>
      </div>
      {comboLevel > 0 ? (
        <div className={`combo-indicator combo-indicator--${comboLevel}`} key={comboLevel}>
          <span>COMBO</span>
          <strong>{comboLevel}</strong>
        </div>
      ) : null}
      <div className="hud-actions">
        <IconButton label="설정" icon="⚙" onClick={onSettings} />
        <IconButton label="일시정지" icon="Ⅱ" onClick={onPause} />
      </div>
      <div className="time-gauge" aria-label={`남은 시간 ${Math.round(time)}%`}>
        <span className={time < 30 ? "is-low" : ""} style={{ width: `${time}%` }} />
      </div>
    </header>
  );
}

function Platform({
  floor,
  index,
}: {
  floor: number;
  index: number;
}) {
  const direction = index === 0 ? 0 : directionForFloor(floor);
  const positionClass =
    direction === 0 ? "platform--center" : direction < 0 ? "platform--left" : "platform--right";
  const progressPick = Math.abs(Math.sin((floor + 9) * 18.734)) % 1;
  let platformKind: "stone" | "wood" | "branchStep" | "cloudStep" = "stone";
  if (floor >= 360) platformKind = "cloudStep";
  else if (floor >= 320) platformKind = progressPick < (floor - 320) / 40 ? "cloudStep" : "branchStep";
  else if (floor >= 240) platformKind = "branchStep";
  else if (floor >= 200) platformKind = progressPick < (floor - 200) / 40 ? "branchStep" : "wood";
  else if (floor >= 120) platformKind = "wood";
  else if (floor >= 80) platformKind = progressPick < (floor - 80) / 40 ? "wood" : "stone";
  const style = {
    "--platform-bottom": `${14 + index * 12}%`,
    "--platform-depth": `${1 - index * 0.055}`,
  } as CSSProperties;

  return (
    <div
      className={`platform platform--${platformKind} ${positionClass} ${floor % 2 ? "is-mirrored" : ""}`}
      style={style}
      data-platform-floor={floor}
      aria-hidden="true"
    >
      <SheetCrop sheet={SPRITE_SHEETS.stairs} crop={SPRITES[platformKind]} className="platform-art" />
    </div>
  );
}

function ParticleField({ floor, pulse }: { floor: number; pulse: number }) {
  const type = floor >= 340 ? "light" : floor >= 120 ? "leaf" : "light";
  return (
    <div className={`particle-field particle-field--${type} particle-field--${pulse % 2}`} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <i
          key={index}
          style={
            {
              "--particle-left": `${14 + index * 14}%`,
              "--particle-top": `${21 + (index % 3) * 23}%`,
              "--particle-duration": `${5 + index * 0.7}s`,
              "--particle-delay": `${index * -0.8}s`,
              "--particle-x": `${(index % 3) * 20}%`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function LandingBurst({
  comboLevel,
  pulse,
}: {
  comboLevel: number;
  pulse: number;
}) {
  const particleCount = Math.min(10, 4 + comboLevel * 2);

  return (
    <div className="landing-burst" key={pulse} aria-hidden="true">
      {Array.from({ length: particleCount }, (_, index) => {
        const isStar = comboLevel > 0 && index % 3 === 0;
        const crop = isStar
          ? index % 2
            ? SPRITES.starShard1
            : SPRITES.starShard2
          : index % 2
            ? SPRITES.lightDot
            : SPRITES.lightDiamond;

        return (
          <span
            className={`landing-particle ${isStar ? "is-star" : "is-light"}`}
            key={`${pulse}-${index}`}
            style={
              {
                "--burst-x": `${(index - (particleCount - 1) / 2) * 18}px`,
                "--burst-y": `${-28 - (index % 3) * 13}px`,
                "--burst-rotate": `${-55 + index * 21}deg`,
                "--burst-delay": `${(index % 3) * 14}ms`,
              } as CSSProperties
            }
          >
            <SheetCrop sheet={SPRITE_SHEETS.particles} crop={crop} />
          </span>
        );
      })}
    </div>
  );
}

function PlayScreen({
  floor,
  best,
  recordTarget,
  time,
  pulse,
  facing,
  pose,
  shaking,
  recordCelebration,
  effectsEnabled,
  onInput,
  onPause,
  onSettings,
}: {
  floor: number;
  best: number;
  recordTarget: number;
  time: number;
  pulse: number;
  facing: Direction;
  pose: "climb" | "turn";
  shaking: boolean;
  recordCelebration: boolean;
  effectsEnabled: boolean;
  onInput: (direction: Direction) => void;
  onPause: () => void;
  onSettings: () => void;
}) {
  const nextDirection = directionForFloor(floor + 1);
  const platforms = Array.from({ length: 7 }, (_, index) => floor + index);
  const comboLevel = comboLevelForStreak(floor);
  const isNewRecord = floor > recordTarget;
  const playerSource = recordCelebration
    ? ASSETS.character.record
    : pose === "turn"
      ? ASSETS.character.turn
      : ASSETS.character.climb;

  const handlePointer = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    onInput(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  };

  return (
    <section
      className={`play-screen ${shaking ? "is-shaking" : ""} ${effectsEnabled && isNewRecord ? "is-record-zoom" : ""}`}
      data-testid="screen-playing"
      data-next-direction={nextDirection < 0 ? "left" : "right"}
      onPointerDown={handlePointer}
    >
      <WorldBackground floor={floor} pulse={pulse} />
      <ParticleField floor={floor} pulse={pulse} />
      <div className={`platform-field platform-field--pulse-${pulse % 2}`}>
        {platforms.map((platformFloor, index) => (
          <Platform floor={platformFloor} index={index} key={`${platformFloor}-${index}`} />
        ))}
      </div>
      <div
        className={`player player--${pose} player--${facing < 0 ? "left" : "right"} player--pulse-${pulse % 2} ${recordCelebration ? "is-celebrating" : ""}`}
      >
        {effectsEnabled && comboLevel >= 2 && !recordCelebration ? (
          <div className="player-trails" aria-hidden="true">
            <img className="player-trail player-trail--1" src={playerSource} alt="" />
            <img className="player-trail player-trail--2" src={playerSource} alt="" />
          </div>
        ) : null}
        <img
          key={`${pulse}-${pose}`}
          src={playerSource}
          alt="계단을 오르는 루미"
          draggable="false"
        />
      </div>
      {effectsEnabled && floor > 0 ? <LandingBurst comboLevel={comboLevel} pulse={pulse} /> : null}
      <Hud
        floor={floor}
        best={best}
        recordTarget={recordTarget}
        comboLevel={comboLevel}
        time={time}
        stage={stageForFloor(floor).name}
        onPause={onPause}
        onSettings={onSettings}
      />
      <div className="touch-guide touch-guide--left" aria-hidden="true">←</div>
      <div className="touch-guide touch-guide--right" aria-hidden="true">→</div>
    </section>
  );
}

function Overlay({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`screen-overlay ${className}`}>
      <div className="overlay-scrim" />
      <section className="overlay-panel">
        <div className="overlay-heading">
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {children}
      </section>
    </div>
  );
}

function PauseScreen({
  onResume,
  onRetry,
  onHome,
}: {
  onResume: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <Overlay eyebrow="잠시 쉬어가요" title="일시정지" className="pause-overlay">
      <div className="menu-buttons" data-testid="screen-paused">
        <button className="primary-button" type="button" onClick={onResume}>계속하기</button>
        <button className="secondary-button" type="button" onClick={onRetry}>다시 시작</button>
        <button className="text-button" type="button" onClick={onHome}>홈으로</button>
      </div>
    </Overlay>
  );
}

function ResultScreen({
  isRecord,
  floor,
  best,
  onRetry,
  onHome,
}: {
  isRecord: boolean;
  floor: number;
  best: number;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <Overlay
      eyebrow={isRecord ? "별빛이 더 높이 빛났어요!" : "조금만 더 올라가 볼까요?"}
      title={isRecord ? "최고 기록 갱신!" : "이번 오르기"}
      className={`result-overlay ${isRecord ? "is-record" : "is-gameover"}`}
    >
      <div className="result-layout" data-testid={isRecord ? "screen-record" : "screen-gameover"}>
        <div className="result-character">
          <div className="result-aura" />
          <img
            className={isRecord ? "record-character" : "fail-character"}
            src={isRecord ? ASSETS.character.record : ASSETS.character.fail}
            alt={isRecord ? "최고 기록을 기뻐하는 루미" : "균형을 잃은 루미"}
          />
        </div>
        <div className="result-details">
          <div className={`result-number ${isRecord ? "is-bouncing" : ""}`}>
            <span>{isRecord ? "새로운 높이" : "현재 기록"}</span>
            <strong>{floor.toLocaleString()}층</strong>
          </div>
          <p>최고 기록 <b>{best.toLocaleString()}층</b></p>
          <div className="result-buttons">
            <button className="primary-button" type="button" onClick={onRetry}>다시 도전</button>
            <button className="secondary-button" type="button" onClick={onHome}>홈으로</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onBack,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onBack: () => void;
}) {
  return (
    <Overlay eyebrow="플레이 환경" title="설정" className="settings-overlay">
      <div className="settings-list" data-testid="screen-settings">
        <Toggle
          label="효과 연출"
          description="흔들림과 착지 반동"
          checked={settings.effects}
          onChange={(effects) => onChange({ ...settings, effects })}
        />
        <Toggle
          label="진동 피드백"
          description="지원하는 모바일 기기"
          checked={settings.haptics}
          onChange={(haptics) => onChange({ ...settings, haptics })}
        />
        <Toggle
          label="움직임 줄이기"
          description="패럴랙스와 전환 완화"
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => onChange({ ...settings, reducedMotion })}
        />
        <button className="primary-button settings-back" type="button" onClick={onBack}>완료</button>
      </div>
    </Overlay>
  );
}

export function LumiClimbGame() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [settingsReturn, setSettingsReturn] = useState<Screen>("home");
  const [progress, setProgress] = useState(0);
  const [floor, setFloor] = useState(0);
  const [best, setBest] = useState(0);
  const [recordTarget, setRecordTarget] = useState(0);
  const [time, setTime] = useState(100);
  const [pulse, setPulse] = useState(0);
  const [facing, setFacing] = useState<Direction>(-1);
  const [pose, setPose] = useState<"climb" | "turn">("climb");
  const [shaking, setShaking] = useState(false);
  const [recordCelebration, setRecordCelebration] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const lockedRef = useRef(false);
  const floorRef = useRef(0);
  const bestRef = useRef(0);
  const runStartBestRef = useRef(0);
  const facingRef = useRef<Direction>(-1);
  const recordCelebratedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let savedBest = 0;
    let savedSettings: Partial<Settings> | null = null;

    try {
      const storedBest = Number(localStorage.getItem(BEST_KEY) || 0);
      savedBest = Number.isFinite(storedBest) ? storedBest : 0;
      savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      bestRef.current = savedBest;
    } catch {
      // Storage is optional; the game remains playable without it.
    }

    queueMicrotask(() => {
      if (!active) return;
      setBest(savedBest);
      if (savedSettings) setSettings({ ...defaultSettings, ...savedSettings });
    });

    const minimum = new Promise((resolve) => window.setTimeout(resolve, 900));
    Promise.all([preloadImages(setProgress), minimum]).then(() => {
      if (active) setScreen("home");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  useEffect(() => {
    const prevent = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, []);

  const persistRecord = useCallback((currentFloor: number, currentBest: number) => {
    try {
      localStorage.setItem(CURRENT_KEY, String(currentFloor));
      localStorage.setItem(BEST_KEY, String(currentBest));
    } catch {
      // Storage is optional.
    }
  }, []);

  const finishRun = useCallback(() => {
    if (screen !== "playing") return;
    const finalFloor = floorRef.current;
    const finalBest = Math.max(bestRef.current, finalFloor);
    const newRecord = finalFloor > runStartBestRef.current;
    setBest(finalBest);
    bestRef.current = finalBest;
    persistRecord(finalFloor, finalBest);
    setShaking(true);
    if (settings.haptics && navigator.vibrate) navigator.vibrate(45);
    window.setTimeout(() => {
      setShaking(false);
      setScreen(newRecord ? "record" : "gameover");
    }, settings.reducedMotion ? 80 : 280);
  }, [persistRecord, screen, settings.haptics, settings.reducedMotion]);

  useEffect(() => {
    if (screen !== "playing") return;
    const timer = window.setInterval(() => {
      setTime((current) => {
        const next = current - 0.72;
        if (next <= 0) {
          window.clearInterval(timer);
          window.setTimeout(() => finishRun(), 0);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [finishRun, screen]);

  const startGame = useCallback(() => {
    runStartBestRef.current = bestRef.current;
    setRecordTarget(bestRef.current);
    floorRef.current = 0;
    setFloor(0);
    setTime(100);
    setPulse((current) => current + 1);
    setFacing(-1);
    facingRef.current = -1;
    setPose("climb");
    setRecordCelebration(false);
    recordCelebratedRef.current = false;
    lockedRef.current = false;
    persistRecord(0, bestRef.current);
    setScreen("playing");
  }, [persistRecord]);

  const handleInput = useCallback(
    (direction: Direction) => {
      if (screen !== "playing" || lockedRef.current) return;
      lockedRef.current = true;
      const expected = directionForFloor(floorRef.current + 1);

      if (direction !== expected) {
        setFacing(direction);
        facingRef.current = direction;
        window.setTimeout(() => {
          lockedRef.current = false;
          finishRun();
        }, settings.reducedMotion ? 40 : 120);
        return;
      }

      const changedDirection = direction !== facingRef.current;
      setFacing(direction);
      facingRef.current = direction;
      setPose(changedDirection ? "turn" : "climb");
      const nextFloor = floorRef.current + 1;
      floorRef.current = nextFloor;
      setFloor(nextFloor);
      setPulse((current) => current + 1);
      setTime(100);
      const nextBest = Math.max(bestRef.current, nextFloor);
      if (nextBest !== bestRef.current) {
        bestRef.current = nextBest;
        setBest(nextBest);
      }
      persistRecord(nextFloor, nextBest);
      if (settings.haptics && navigator.vibrate) navigator.vibrate(10);
      if (nextFloor > runStartBestRef.current && !recordCelebratedRef.current) {
        recordCelebratedRef.current = true;
        setRecordCelebration(true);
        window.setTimeout(
          () => setRecordCelebration(false),
          settings.reducedMotion ? 60 : 420,
        );
      }

      window.setTimeout(() => setPose("climb"), settings.reducedMotion ? 40 : 130);
      window.setTimeout(() => {
        lockedRef.current = false;
      }, settings.reducedMotion ? 70 : 190);
    },
    [finishRun, persistRecord, screen, settings.haptics, settings.reducedMotion],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (screen === "playing" && (event.key === "ArrowLeft" || event.key.toLowerCase() === "a")) {
        event.preventDefault();
        handleInput(-1);
      }
      if (screen === "playing" && (event.key === "ArrowRight" || event.key.toLowerCase() === "d")) {
        event.preventDefault();
        handleInput(1);
      }
      if (screen === "playing" && (event.key === "Escape" || event.key.toLowerCase() === "p")) {
        event.preventDefault();
        setScreen("paused");
      } else if (screen === "paused" && (event.key === "Escape" || event.key.toLowerCase() === "p")) {
        event.preventDefault();
        setScreen("playing");
      }
      if (screen === "home" && event.key === "Enter") startGame();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleInput, screen, startGame]);

  const updateSettings = (nextSettings: Settings) => {
    setSettings(nextSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch {
      // Storage is optional.
    }
  };

  const openSettings = (returnTo: Screen) => {
    setSettingsReturn(returnTo);
    setScreen("settings");
  };

  const appClass = useMemo(
    () => `game-app ${settings.reducedMotion ? "reduce-motion" : ""}`,
    [settings.reducedMotion],
  );

  return (
    <main className={appClass} data-testid="game-root" data-screen={screen}>
      {screen === "loading" ? <LoadingScreen progress={progress} /> : null}
      {screen === "home" ? (
        <HomeScreen best={best} onPlay={startGame} onSettings={() => openSettings("home")} />
      ) : null}
      {["playing", "paused", "settings", "gameover", "record"].includes(screen) ? (
        <PlayScreen
          floor={floor}
          best={best}
          recordTarget={recordTarget}
          time={time}
          pulse={pulse}
          facing={facing}
          pose={pose}
          shaking={shaking}
          recordCelebration={recordCelebration}
          effectsEnabled={settings.effects}
          onInput={handleInput}
          onPause={() => setScreen("paused")}
          onSettings={() => openSettings("playing")}
        />
      ) : null}
      {screen === "paused" ? (
        <PauseScreen onResume={() => setScreen("playing")} onRetry={startGame} onHome={() => setScreen("home")} />
      ) : null}
      {screen === "gameover" || screen === "record" ? (
        <ResultScreen
          isRecord={screen === "record"}
          floor={floor}
          best={best}
          onRetry={startGame}
          onHome={() => setScreen("home")}
        />
      ) : null}
      {screen === "settings" ? (
        <SettingsScreen
          settings={settings}
          onChange={updateSettings}
          onBack={() => setScreen(settingsReturn)}
        />
      ) : null}
    </main>
  );
}
