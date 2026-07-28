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
        <div className="sheet-sprite meadow-sapling meadow-sapling--left" />
        <div className="sheet-sprite meadow-sapling meadow-sapling--right" />
        <div className="sheet-sprite meadow-shrub meadow-shrub--left" />
        <div className="sheet-sprite meadow-shrub meadow-shrub--right" />
      </div>

      <div className="scenery scenery--forest" style={{ opacity: opacity.forest }}>
        <div className="sheet-sprite forest-trunk forest-trunk--left" />
        <div className="sheet-sprite forest-trunk forest-trunk--right" />
        <div className="sheet-sprite forest-leaves forest-leaves--left" />
        <div className="sheet-sprite forest-leaves forest-leaves--right" />
      </div>

      <div className="scenery scenery--sky" style={{ opacity: opacity.sky }}>
        <div className="sheet-sprite sky-cloud sky-cloud--left" />
        <div className="sheet-sprite sky-cloud sky-cloud--right" />
        <div className="sheet-sprite sky-cloud sky-cloud--far" />
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
      <IconButton label="설정 열기" icon="⚙" onClick={onSettings} className="home-settings" />
      <div className="home-content">
        <div className="home-hero">
          <div className="hero-aura" />
          <img src={ASSETS.character.idle} alt="별빛 여행자 루미" />
        </div>
        <div className="home-actions">
          <div className="game-logo" aria-label="루미 끝없는 오르기">
            <span className="logo-kicker">별빛 여행자</span>
            <strong>LUMI</strong>
            <span className="logo-subtitle">ENDLESS CLIMB</span>
          </div>
          <div className="home-best">
            <span>최고 높이</span>
            <strong>{best.toLocaleString()}층</strong>
          </div>
          <button className="primary-button play-button" type="button" onClick={onPlay}>
            <span className="play-symbol" aria-hidden="true">▶</span>
            PLAY
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
  time,
  stage,
  onPause,
  onSettings,
}: {
  floor: number;
  best: number;
  time: number;
  stage: string;
  onPause: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="hud">
      <div className="score-cluster">
        <div className="score-readout score-readout--current">
          <span>현재 높이</span>
          <strong data-testid="height-value">{floor.toLocaleString()}층</strong>
        </div>
        <div className="score-readout">
          <span>최고 기록</span>
          <strong data-testid="best-value">{best.toLocaleString()}층</strong>
        </div>
        <div className="stage-label">{stage}</div>
      </div>
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
  const stage = stageForFloor(floor);
  const direction = index === 0 ? 0 : directionForFloor(floor);
  const column = floor % 2;
  const positionClass =
    direction === 0 ? "platform--center" : direction < 0 ? "platform--left" : "platform--right";
  const style = {
    "--platform-x": column === 0 ? "0%" : "100%",
    "--platform-y": `${stage.platformRow * 33.333}%`,
    "--platform-bottom": `${14 + index * 12}%`,
    "--platform-depth": `${1 - index * 0.055}`,
  } as CSSProperties;

  return (
    <div
      className={`platform ${positionClass}`}
      style={style}
      data-platform-floor={floor}
      aria-hidden="true"
    />
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

function PlayScreen({
  floor,
  best,
  time,
  pulse,
  facing,
  pose,
  shaking,
  onInput,
  onPause,
  onSettings,
}: {
  floor: number;
  best: number;
  time: number;
  pulse: number;
  facing: Direction;
  pose: "climb" | "turn";
  shaking: boolean;
  onInput: (direction: Direction) => void;
  onPause: () => void;
  onSettings: () => void;
}) {
  const nextDirection = directionForFloor(floor + 1);
  const platforms = Array.from({ length: 7 }, (_, index) => floor + index);

  const handlePointer = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    onInput(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  };

  return (
    <section
      className={`play-screen ${shaking ? "is-shaking" : ""}`}
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
        className={`player player--${pose} player--${facing < 0 ? "left" : "right"} player--pulse-${pulse % 2}`}
      >
        <img
          key={`${pulse}-${pose}`}
          src={pose === "turn" ? ASSETS.character.turn : ASSETS.character.climb}
          alt="계단을 오르는 루미"
          draggable="false"
        />
      </div>
      <Hud
        floor={floor}
        best={best}
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
      title={isRecord ? "NEW RECORD" : "이번 오르기"}
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
            <button className="primary-button" type="button" onClick={onRetry}>Retry</button>
            <button className="secondary-button" type="button" onClick={onHome}>Home</button>
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
  const [time, setTime] = useState(100);
  const [pulse, setPulse] = useState(0);
  const [facing, setFacing] = useState<Direction>(-1);
  const [pose, setPose] = useState<"climb" | "turn">("climb");
  const [shaking, setShaking] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const lockedRef = useRef(false);
  const floorRef = useRef(0);
  const bestRef = useRef(0);
  const runStartBestRef = useRef(0);
  const facingRef = useRef<Direction>(-1);

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
    floorRef.current = 0;
    setFloor(0);
    setTime(100);
    setPulse((current) => current + 1);
    setFacing(-1);
    facingRef.current = -1;
    setPose("climb");
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
          time={time}
          pulse={pulse}
          facing={facing}
          pose={pose}
          shaking={shaking}
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
