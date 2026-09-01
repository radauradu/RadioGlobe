"use client";

import Hls from "hls.js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { RadioStation } from "@/lib/radioApi";
import {
  configurePlatformAudioSession,
  syncMediaSessionPlaybackState,
  syncNowPlayingMetadata,
  useDirectAudioOutput,
} from "@/lib/mediaSession";
import { fadeAudioVolume, playTuningJingle, stopTuningSound } from "@/lib/tuningSound";
import {
  DIRECT_READY_SLOW_TIMEOUT_MS,
  DIRECT_READY_TIMEOUT_MS,
  MAX_STALL_RECONNECTS,
  RELAY_HARD_SWAP_GUARD_MS,
  RELAY_OVERLAP_LEAD_MS,
  RELAY_OVERLAP_SETTLE_MS,
  RELAY_ROTATE_MS,
  RELAY_VERCEL_MAX_MS,
  STALL_RECONNECT_MS,
  canReconnectLiveStream,
  directPlaybackUrl,
  nextPlaybackMode,
  relayPlaybackUrl,
} from "@/lib/streamPlayback";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export type PlayerStatus =
  | "idle"
  | "loading"
  | "reconnecting"
  | "playing"
  | "paused"
  | "error";

const EMPTY_LEVELS = Array.from({ length: 18 }, () => 0);

interface RadioGlobeWindow extends Window {
  __radioGlobeAudioElements?: Set<HTMLAudioElement>;
}

function audioElementRegistry() {
  const browserWindow = window as RadioGlobeWindow;
  browserWindow.__radioGlobeAudioElements ??= new Set();
  return browserWindow.__radioGlobeAudioElements;
}

function hardStopAudioElement(audio: HTMLAudioElement) {
  audio.muted = true;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function createPlayerAudioElement() {
  const audio = document.createElement("audio");
  audio.id = "radioglobe-player";
  audio.preload = "auto";
  audio.volume = 0.72;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "true");
  audio.style.cssText =
    "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
  document.body.appendChild(audio);
  return audio;
}

function destroyStandbyAudio(
  standbyRef: MutableRefObject<HTMLAudioElement | null>,
  unlockedRef: MutableRefObject<boolean>,
) {
  const standby = standbyRef.current;
  if (!standby) return;
  hardStopAudioElement(standby);
  standby.remove();
  standbyRef.current = null;
  unlockedRef.current = false;
}

function createStandbyAudioElement() {
  const audio = document.createElement("audio");
  audio.id = "radioglobe-player-standby";
  audio.preload = "auto";
  audio.volume = 0.72;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "true");
  audio.style.cssText =
    "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
  document.body.appendChild(audio);
  return audio;
}

function promoteOverlapToPrimary(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  overlap: HTMLAudioElement,
) {
  const registry = audioElementRegistry();
  const previous = audioRef.current;
  if (previous && previous !== overlap) {
    registry.delete(previous);
    hardStopAudioElement(previous);
    previous.remove();
  }
  overlap.id = "radioglobe-player";
  registry.add(overlap);
  audioRef.current = overlap;
}

function waitForOverlapSettled(
  audio: HTMLAudioElement,
  timeoutMs = DIRECT_READY_TIMEOUT_MS,
): Promise<boolean> {
  if (hasStreamLoadError(audio)) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let playingSince: number | null = null;
    let baselineTime: number | null = null;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("error", onError);
      resolve(ready);
    };

    const checkSettled = () => {
      if (hasStreamLoadError(audio)) {
        finish(false);
        return;
      }
      if (
        !audio.paused &&
        audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
      ) {
        if (playingSince == null) {
          playingSince = performance.now();
          baselineTime = audio.currentTime;
        } else if (
          baselineTime != null &&
          audio.currentTime > baselineTime &&
          performance.now() - playingSince >= RELAY_OVERLAP_SETTLE_MS
        ) {
          finish(true);
        }
      }
    };

    const onPlaying = () => checkSettled();
    const onTimeUpdate = () => checkSettled();
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), timeoutMs);

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("error", onError);
    checkSettled();
  });
}

function replaceSharedAudioElement(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
) {
  const registry = audioElementRegistry();
  const previous = audioRef.current;
  if (previous) {
    hardStopAudioElement(previous);
    previous.remove();
    registry.delete(previous);
  }
  const audio = createPlayerAudioElement();
  registry.add(audio);
  audioRef.current = audio;
  return audio;
}

function getSharedAudioElement(registry: Set<HTMLAudioElement>) {
  const existing = registry.values().next().value;
  if (existing) return existing;

  const audio =
    typeof document !== "undefined"
      ? createPlayerAudioElement()
      : new Audio();
  audio.preload = "auto";
  audio.volume = 0.72;
  registry.add(audio);
  return audio;
}

function bindSharedAudioElement(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
) {
  if (typeof window === "undefined") return null;
  if (!audioRef.current) {
    audioRef.current = getSharedAudioElement(audioElementRegistry());
  }
  return audioRef.current;
}

function waitForPlaybackReady(
  audio: HTMLAudioElement,
  timeoutMs = DIRECT_READY_TIMEOUT_MS,
): Promise<boolean> {
  if (
    audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ||
    (!audio.paused && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
  ) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onPlaying = () => finish(true);
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
  });
}

function hasStreamLoadError(audio: HTMLAudioElement) {
  return audio.error != null && audio.error.code !== MediaError.MEDIA_ERR_ABORTED;
}

function prefersMutedAutoplay() {
  if (typeof navigator === "undefined") return true;
  return !navigator.userActivation?.hasBeenActive;
}

export function useAudioPlayer(
  onStationUnavailable?: (station: RadioStation) => void,
) {
  const [station, setStation] = useState<RadioStation | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [volume, setVolumeState] = useState(0.72);
  const [muted, setMutedState] = useState(false);
  const [streamTitle, setStreamTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState(EMPTY_LEVELS);
  const [wantsPlayback, setWantsPlayback] = useState(false);
  const [awaitingUnmute, setAwaitingUnmute] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stationRef = useRef<RadioStation | null>(null);
  const wantPlayingRef = useRef(false);
  const startedPlayingRef = useRef(false);
  const mutedRef = useRef(false);
  const volumeRef = useRef(0.72);
  const playbackGenerationRef = useRef(0);
  const attachGenerationRef = useRef(0);
  const usingRelayRef = useRef(false);
  const unavailableRef = useRef(onStationUnavailable);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const attachSourceRef = useRef<
    (nextStation: RadioStation, relay: boolean) => void
  >(() => undefined);
  const autoUnmuteCleanupRef = useRef<(() => void) | null>(null);
  const suppressPlatformPauseRef = useRef(false);
  const streamTitleRef = useRef<string | null>(null);
  const stallTimerRef = useRef<number | null>(null);
  const stallReconnectCountRef = useRef(0);
  const directAttemptsRef = useRef(0);
  const relayPrepTimerRef = useRef<number | null>(null);
  const relayCommitTimerRef = useRef<number | null>(null);
  const relayHardSwapTimerRef = useRef<number | null>(null);
  const relayOverlapAudioRef = useRef<HTMLAudioElement | null>(null);
  const relayOverlapGenRef = useRef(0);
  const relayOverlapCommittingRef = useRef(false);
  const scheduleRelayRotationRef = useRef<() => void>(() => undefined);
  const beginRelayOverlapRef = useRef<() => Promise<void>>(async () => undefined);
  const tryCommitRelayOverlapRef = useRef<() => Promise<void>>(async () => undefined);
  const forceHardSwapRelayRef = useRef<() => Promise<void>>(async () => undefined);
  const reconnectingRef = useRef(false);
  const relayHandoffRef = useRef(false);
  const outgoingAudioRef = useRef<HTMLAudioElement | null>(null);
  const standbyAudioRef = useRef<HTMLAudioElement | null>(null);
  const standbyUnlockedRef = useRef(false);
  const reconnectFromStallRef = useRef<() => Promise<void>>(
    async () => undefined,
  );
  const [audioEpoch, setAudioEpoch] = useState(0);

  bindSharedAudioElement(audioRef);

  useEffect(() => {
    configurePlatformAudioSession();
  }, []);

  useEffect(() => {
    streamTitleRef.current = streamTitle;
  }, [streamTitle]);

  useEffect(() => {
    unavailableRef.current = onStationUnavailable;
  }, [onStationUnavailable]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current == null) return;
    window.clearTimeout(stallTimerRef.current);
    stallTimerRef.current = null;
  }, []);

  const clearRelayCommitTimer = useCallback(() => {
    if (relayCommitTimerRef.current == null) return;
    window.clearTimeout(relayCommitTimerRef.current);
    relayCommitTimerRef.current = null;
  }, []);

  const clearRelayHardSwapTimer = useCallback(() => {
    if (relayHardSwapTimerRef.current == null) return;
    window.clearTimeout(relayHardSwapTimerRef.current);
    relayHardSwapTimerRef.current = null;
  }, []);

  const clearRelayPrepTimer = useCallback(() => {
    if (relayPrepTimerRef.current == null) return;
    window.clearTimeout(relayPrepTimerRef.current);
    relayPrepTimerRef.current = null;
  }, []);

  const clearRelayOverlap = useCallback(() => {
    relayOverlapGenRef.current += 1;
    const overlap = relayOverlapAudioRef.current;
    if (!overlap) return;
    const registry = audioElementRegistry();
    if (registry.has(overlap)) {
      registry.delete(overlap);
    }
    hardStopAudioElement(overlap);
    overlap.remove();
    relayOverlapAudioRef.current = null;
    if (standbyAudioRef.current === overlap) {
      standbyAudioRef.current = null;
      standbyUnlockedRef.current = false;
    }
  }, []);

  const clearRelayRotationTimers = useCallback(() => {
    clearRelayCommitTimer();
    clearRelayPrepTimer();
    clearRelayHardSwapTimer();
  }, [clearRelayCommitTimer, clearRelayHardSwapTimer, clearRelayPrepTimer]);

  const destroyHls = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    try {
      hls.stopLoad();
    } catch {
      // Already stopped.
    }
    try {
      hls.detachMedia();
    } catch {
      // Already detached.
    }
    try {
      hls.destroy();
    } catch {
      // Already destroyed.
    }
    hlsRef.current = null;
  }, []);

  const clearAutoUnmute = useCallback(() => {
    autoUnmuteCleanupRef.current?.();
    autoUnmuteCleanupRef.current = null;
    setAwaitingUnmute(false);
  }, []);

  const ensureAnalyser = useCallback(() => {
    // Live radio plays through the native <audio> element so Icecast URLs
    // do not need CORS. Web Audio would force a same-origin relay and the
    // Vercel function would cut the stream after a short time.
    return;
  }, []);

  const restoreAudibleOutput = useCallback(async () => {
    const audio = bindSharedAudioElement(audioRef);
    if (!audio) return;

    if (useDirectAudioOutput()) {
      audio.muted = mutedRef.current;
      audio.volume = volumeRef.current;
      return;
    }

    ensureAnalyser();
    audio.muted = mutedRef.current;
    audio.volume = volumeRef.current;

    const context = audioContextRef.current;
    const outputGain = outputGainRef.current;
    if (context && outputGain) {
      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }
      outputGain.gain.setValueAtTime(1, context.currentTime);
    }
  }, [ensureAnalyser]);

  // Browsers block unmuted autoplay without a prior user gesture. To make
  // the radio genuinely "already playing" on load, we fall back to a
  // muted autoplay and restore real sound the moment the visitor interacts
  // with the page in any way (click, tap, key, scroll).
  const armAutoUnmute = useCallback(() => {
    clearAutoUnmute();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];
    const handler = () => {
      if (audioRef.current && wantPlayingRef.current) {
        void restoreAudibleOutput();
      }
      clearAutoUnmute();
    };
    events.forEach((event) =>
      window.addEventListener(event, handler, { once: true, passive: true }),
    );
    autoUnmuteCleanupRef.current = () => {
      events.forEach((event) => window.removeEventListener(event, handler));
    };
    setAwaitingUnmute(true);
  }, [clearAutoUnmute, restoreAudibleOutput]);

  const silencePlaybackOutput = useCallback(() => {
    stopTuningSound();
  }, []);

  const unlockStandbyAudio = useCallback(async () => {
    if (standbyUnlockedRef.current && standbyAudioRef.current) return;

    const standby = standbyAudioRef.current ?? createStandbyAudioElement();
    standbyAudioRef.current = standby;
    standby.muted = true;
    try {
      standby.src = SILENT_WAV;
      await standby.play();
      standby.pause();
      standby.removeAttribute("src");
      standby.load();
      standbyUnlockedRef.current = true;
    } catch {
      destroyStandbyAudio(standbyAudioRef, standbyUnlockedRef);
    }
  }, []);

  const beginRelayHandoff = useCallback((outgoing: HTMLAudioElement | null) => {
    relayHandoffRef.current = true;
    outgoingAudioRef.current = outgoing;
    suppressPlatformPauseRef.current = true;
    reconnectingRef.current = true;
  }, []);

  const endRelayHandoff = useCallback(() => {
    relayHandoffRef.current = false;
    outgoingAudioRef.current = null;
    suppressPlatformPauseRef.current = false;
    reconnectingRef.current = false;
  }, []);

  const isOutgoingAudioEvent = useCallback((target: EventTarget | null) => {
    const outgoing = outgoingAudioRef.current;
    return outgoing != null && target === outgoing;
  }, []);

  const haltAudioOutput = useCallback(() => {
    relayHandoffRef.current = false;
    outgoingAudioRef.current = null;
    suppressPlatformPauseRef.current = true;
    attachGenerationRef.current += 1;
    clearStallTimer();
    clearRelayRotationTimers();
    clearRelayOverlap();
    destroyStandbyAudio(standbyAudioRef, standbyUnlockedRef);
    silencePlaybackOutput();
    destroyHls();
    const audio = bindSharedAudioElement(audioRef);
    if (audio) hardStopAudioElement(audio);
    for (const radioAudio of audioElementRegistry()) {
      hardStopAudioElement(radioAudio);
    }
    const context = audioContextRef.current;
    const outputGain = outputGainRef.current;
    if (context && outputGain) {
      try {
        outputGain.gain.setValueAtTime(0, context.currentTime);
      } catch {
        // Context may be closed.
      }
    }
    if (context?.state === "running") {
      void context.suspend().catch(() => undefined);
    }
    window.setTimeout(() => {
      suppressPlatformPauseRef.current = false;
    }, 0);
  }, [clearRelayOverlap, clearRelayRotationTimers, clearStallTimer, destroyHls, silencePlaybackOutput]);

  const cancelPlaybackIntent = useCallback(() => {
    playbackGenerationRef.current += 1;
    wantPlayingRef.current = false;
    setWantsPlayback(false);
    startedPlayingRef.current = false;
    clearAutoUnmute();
    haltAudioOutput();
  }, [clearAutoUnmute, haltAudioOutput]);

  const pausePlayback = useCallback(() => {
    suppressPlatformPauseRef.current = true;
    playbackGenerationRef.current += 1;
    wantPlayingRef.current = false;
    setWantsPlayback(false);
    startedPlayingRef.current = false;
    stallReconnectCountRef.current = 0;
    directAttemptsRef.current = 0;
    relayHandoffRef.current = false;
    outgoingAudioRef.current = null;
    reconnectingRef.current = false;
    clearAutoUnmute();
    destroyHls();
    clearStallTimer();
    clearRelayRotationTimers();
    clearRelayOverlap();
    destroyStandbyAudio(standbyAudioRef, standbyUnlockedRef);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setStatus("paused");
    syncMediaSessionPlaybackState("paused");
    window.setTimeout(() => {
      suppressPlatformPauseRef.current = false;
    }, 0);
  }, [clearAutoUnmute, clearRelayOverlap, clearRelayRotationTimers, clearStallTimer, destroyHls]);

  // Autoplay can start the media element while leaving Web Audio suspended.
  // Resume the analyser on the next genuine user gesture so the spectrum
  // follows the music instead of remaining a flat line.
  useEffect(() => {
    const resumeAnalyser = () => {
      if (!wantPlayingRef.current || !sourceRef.current) return;
      void restoreAudibleOutput();
    };
    window.addEventListener("pointerdown", resumeAnalyser, { passive: true });
    window.addEventListener("keydown", resumeAnalyser);
    window.addEventListener("touchstart", resumeAnalyser, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", resumeAnalyser);
      window.removeEventListener("keydown", resumeAnalyser);
      window.removeEventListener("touchstart", resumeAnalyser);
    };
  }, [restoreAudibleOutput]);

  const sourceFor = useCallback(
    (nextStation: RadioStation, relay: boolean) =>
      relay
        ? relayPlaybackUrl(nextStation.id)
        : directPlaybackUrl(
            nextStation.streamUrl,
            typeof window === "undefined" ? "https:" : window.location.protocol,
          ),
    [],
  );

  const hardSwapRelay = useCallback(() => {
    const current = stationRef.current;
    const audio = audioRef.current;
    if (!current || !audio || !wantPlayingRef.current || !usingRelayRef.current) {
      return;
    }

    clearRelayOverlap();
    beginRelayHandoff(audio);
    audio.src = relayPlaybackUrl(current.id);
    audio.load();
    void audio.play().catch(() => undefined);
  }, [beginRelayHandoff, clearRelayOverlap]);

  const commitRelayOverlap = useCallback(async () => {
    if (relayOverlapCommittingRef.current) return;

    const overlap = relayOverlapAudioRef.current;
    const primary = audioRef.current;
    const current = stationRef.current;
    if (
      !overlap ||
      !primary ||
      !current ||
      !wantPlayingRef.current ||
      !usingRelayRef.current
    ) {
      return;
    }

    const settled = await waitForOverlapSettled(overlap, 1_000);
    if (!settled) return;

    relayOverlapCommittingRef.current = true;
    clearRelayRotationTimers();
    beginRelayHandoff(primary);

    try {
      overlap.muted = mutedRef.current;
      overlap.volume = volumeRef.current;
      primary.muted = true;
      promoteOverlapToPrimary(audioRef, overlap);
      relayOverlapAudioRef.current = null;
      setAudioEpoch((epoch) => epoch + 1);
      syncNowPlayingMetadata(current, streamTitleRef.current, audioRef.current);
      void unlockStandbyAudio();
    } finally {
      relayOverlapCommittingRef.current = false;
      scheduleRelayRotationRef.current();
    }
  }, [beginRelayHandoff, clearRelayRotationTimers, unlockStandbyAudio]);

  const tryCommitRelayOverlap = useCallback(async () => {
    const overlap = relayOverlapAudioRef.current;
    if (!overlap || relayOverlapCommittingRef.current) return;
    await commitRelayOverlap();
  }, [commitRelayOverlap]);

  const beginRelayOverlap = useCallback(async () => {
    if (
      relayOverlapAudioRef.current ||
      relayOverlapCommittingRef.current ||
      !usingRelayRef.current ||
      !wantPlayingRef.current
    ) {
      return;
    }

    const current = stationRef.current;
    if (!current) return;

    if (!standbyUnlockedRef.current || !standbyAudioRef.current) {
      return;
    }

    const overlapGen = relayOverlapGenRef.current + 1;
    relayOverlapGenRef.current = overlapGen;
    const overlap = standbyAudioRef.current;
    standbyAudioRef.current = null;
    standbyUnlockedRef.current = false;
    relayOverlapAudioRef.current = overlap;

    overlap.title = current.name;
    overlap.setAttribute("title", current.name);
    overlap.src = relayPlaybackUrl(current.id);
    overlap.muted = true;
    overlap.volume = volumeRef.current;
    overlap.load();

    try {
      await overlap.play();
    } catch {
      if (relayOverlapGenRef.current !== overlapGen) return;
      clearRelayOverlap();
      return;
    }

    const ready = await waitForPlaybackReady(overlap, DIRECT_READY_TIMEOUT_MS);
    if (
      relayOverlapGenRef.current !== overlapGen ||
      !wantPlayingRef.current ||
      !usingRelayRef.current ||
      relayOverlapAudioRef.current !== overlap ||
      !ready
    ) {
      return;
    }

    const settled = await waitForOverlapSettled(overlap, DIRECT_READY_TIMEOUT_MS);
    if (
      relayOverlapGenRef.current !== overlapGen ||
      !wantPlayingRef.current ||
      !usingRelayRef.current ||
      relayOverlapAudioRef.current !== overlap
    ) {
      return;
    }

    if (settled) {
      await commitRelayOverlap();
    }
  }, [clearRelayOverlap, commitRelayOverlap]);

  const forceHardSwapRelay = useCallback(async () => {
    clearRelayRotationTimers();

    const overlap = relayOverlapAudioRef.current;
    if (overlap && !relayOverlapCommittingRef.current) {
      const settled = await waitForOverlapSettled(overlap, 3_000);
      if (settled) {
        await commitRelayOverlap();
        return;
      }
    }

    clearRelayOverlap();
    hardSwapRelay();
    scheduleRelayRotationRef.current();
  }, [clearRelayOverlap, clearRelayRotationTimers, commitRelayOverlap, hardSwapRelay]);

  const scheduleRelayRotation = useCallback(() => {
    clearRelayRotationTimers();
    if (!usingRelayRef.current || !wantPlayingRef.current) return;

    const prepDelay = Math.max(0, RELAY_ROTATE_MS - RELAY_OVERLAP_LEAD_MS);
    relayPrepTimerRef.current = window.setTimeout(() => {
      relayPrepTimerRef.current = null;
      void beginRelayOverlapRef.current();
    }, prepDelay);

    relayCommitTimerRef.current = window.setTimeout(() => {
      relayCommitTimerRef.current = null;
      void tryCommitRelayOverlapRef.current();
    }, RELAY_ROTATE_MS);

    relayHardSwapTimerRef.current = window.setTimeout(() => {
      relayHardSwapTimerRef.current = null;
      void forceHardSwapRelayRef.current();
    }, RELAY_VERCEL_MAX_MS - RELAY_HARD_SWAP_GUARD_MS);
  }, [clearRelayRotationTimers]);

  useEffect(() => {
    scheduleRelayRotationRef.current = scheduleRelayRotation;
    beginRelayOverlapRef.current = beginRelayOverlap;
    tryCommitRelayOverlapRef.current = tryCommitRelayOverlap;
    forceHardSwapRelayRef.current = forceHardSwapRelay;
  }, [beginRelayOverlap, forceHardSwapRelay, scheduleRelayRotation, tryCommitRelayOverlap]);

  const attachSource: (nextStation: RadioStation, relay: boolean) => void =
    useCallback(
    (nextStation: RadioStation, relay: boolean) => {
      if (!wantPlayingRef.current) return;

      haltAudioOutput();
      const audio = useDirectAudioOutput()
        ? replaceSharedAudioElement(audioRef)
        : bindSharedAudioElement(audioRef);
      if (!audio) return;
      if (useDirectAudioOutput()) {
        setAudioEpoch((epoch) => epoch + 1);
      }

      audio.title = nextStation.name;
      audio.setAttribute("title", nextStation.name);
      const attachGen = attachGenerationRef.current;
      usingRelayRef.current = relay;

      const url = sourceFor(nextStation, relay);
      const isHls =
        /\.m3u8(?:$|\?)/i.test(nextStation.streamUrl) ||
        nextStation.codec.includes("HLS");
      const useHlsJs = isHls && Hls.isSupported() && !useDirectAudioOutput();

      if (useHlsJs) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
        });
        hlsRef.current = hls;
        hls.attachMedia(audio);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (
            attachGenerationRef.current !== attachGen ||
            !wantPlayingRef.current
          ) {
            hls.stopLoad();
            return;
          }
          hls.loadSource(url);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (
            attachGenerationRef.current !== attachGen ||
            !wantPlayingRef.current ||
            !audio.paused
          ) {
            return;
          }
          if (prefersMutedAutoplay()) {
            audio.muted = true;
          }
          void audio.play().catch(() => undefined);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (
            attachGenerationRef.current !== attachGen ||
            !wantPlayingRef.current
          ) {
            hls.destroy();
            if (hlsRef.current === hls) hlsRef.current = null;
            return;
          }
          if (startedPlayingRef.current) {
            void reconnectFromStallRef.current();
            return;
          }
          if (!usingRelayRef.current) {
            attachSourceRef.current(nextStation, true);
            void audio.play();
          } else {
            attachSourceRef.current(nextStation, true);
            void audio.play().catch(() => {
              void reconnectFromStallRef.current();
            });
          }
        });
      } else {
        audio.src = url;
        audio.load();
      }
    },
      [haltAudioOutput, sourceFor],
    );

  useEffect(() => {
    attachSourceRef.current = attachSource;
  }, [attachSource]);

  // Tries to actually start playback for the given generation, retrying
  // through progressively more permissive strategies: as-is, then muted
  // (always allowed, even without a user gesture), then — if the direct
  // stream itself is broken (CORS/mixed-content/network) — through our
  // same-origin relay. Returns whether playback is genuinely underway.
  const attemptPlayback = useCallback(
    async (
      nextStation: RadioStation,
      generation: number,
      options?: { userInitiated?: boolean },
    ) => {
      const audio = bindSharedAudioElement(audioRef);
      if (!audio) return false;

      const userInitiated = options?.userInitiated ?? false;

      const stillWanted = () =>
        playbackGenerationRef.current === generation &&
        wantPlayingRef.current;

      const tryMuted = async () => {
        audio.muted = true;
        await audio.play();
        if (!stillWanted()) return false;
        if (!mutedRef.current) {
          armAutoUnmute();
        }
        return true;
      };

      const tryPlay = async (mutedFirst: boolean) => {
        if (mutedFirst) {
          try {
            const mutedStarted = await tryMuted();
            if (mutedStarted) return true;
          } catch {
            if (!stillWanted()) return false;
          }
        }

        try {
          audio.muted = mutedRef.current;
          await audio.play();
          if (!stillWanted()) return false;
          if (userInitiated) {
            await restoreAudibleOutput();
          }
          return true;
        } catch (playError) {
          if (!stillWanted()) return false;

          const blockedBySound =
            playError instanceof DOMException &&
            playError.name === "NotAllowedError";

          if (blockedBySound || mutedFirst) {
            try {
              const mutedStarted = await tryMuted();
              if (mutedStarted && userInitiated) {
                await restoreAudibleOutput();
              }
              return mutedStarted;
            } catch {
              if (!stillWanted()) return false;
            }
          }

          return false;
        }
      };

      const ensureStreamReady = async () => {
        let ready = await waitForPlaybackReady(audio, DIRECT_READY_TIMEOUT_MS);
        if (!ready) {
          ready = await waitForPlaybackReady(audio, DIRECT_READY_SLOW_TIMEOUT_MS);
        }
        return ready;
      };

      const fallbackToRelay = async () => {
        if (!stillWanted()) return false;

        const mode = nextPlaybackMode({
          usingRelay: usingRelayRef.current,
          directAttempts: directAttemptsRef.current,
        });
        if (mode === "direct") {
          directAttemptsRef.current += 1;
          attachSource(nextStation, false);
          if (
            (await ensureStreamReady()) &&
            stillWanted() &&
            (await tryPlay(true))
          ) {
            return true;
          }
        }

        attachSource(nextStation, true);
        if (!(await ensureStreamReady()) || !stillWanted()) return false;
        return tryPlay(true);
      };

      if (!usingRelayRef.current) {
        const ready = await ensureStreamReady();
        if (!stillWanted()) return false;

        const mutedFirst =
          !userInitiated &&
          (prefersMutedAutoplay() || !startedPlayingRef.current);
        if (ready && (await tryPlay(mutedFirst))) return true;

        if (hasStreamLoadError(audio) || !ready) {
          return fallbackToRelay();
        }

        if (await tryPlay(true)) return true;
        return hasStreamLoadError(audio) ? fallbackToRelay() : false;
      }

      const relayReady = await ensureStreamReady();
      if (!stillWanted() || !relayReady) return false;
      return tryPlay(true);
    },
    [armAutoUnmute, attachSource, restoreAudibleOutput],
  );

  const reconnectFromStall = useCallback(async () => {
    const current = stationRef.current;
    if (!current || !wantPlayingRef.current || reconnectingRef.current) return;

    if (
      !canReconnectLiveStream({
        wantsPlayback: true,
        hasStarted: true,
        reconnectAttempts: stallReconnectCountRef.current,
      })
    ) {
      wantPlayingRef.current = false;
      setWantsPlayback(false);
      startedPlayingRef.current = false;
      clearStallTimer();
      const audio = audioRef.current;
      if (audio) audio.pause();
      setStatus("error");
      setError("Station disconnected. Press play to retry.");
      unavailableRef.current?.(current);
      return;
    }

    reconnectingRef.current = true;
    stallReconnectCountRef.current += 1;
    playbackGenerationRef.current += 1;
    const generation = playbackGenerationRef.current;
    setStatus("reconnecting");
    setError(null);
    const useRelay =
      nextPlaybackMode({
        usingRelay: usingRelayRef.current,
        directAttempts: directAttemptsRef.current,
      }) === "relay";
    if (!useRelay) {
      directAttemptsRef.current = 0;
    }
    attachSource(current, useRelay);

    try {
      const started = await attemptPlayback(current, generation, {
        userInitiated: true,
      });
      if (
        playbackGenerationRef.current !== generation ||
        !wantPlayingRef.current
      ) {
        return;
      }
      if (started) {
        await restoreAudibleOutput();
        startedPlayingRef.current = true;
        setStatus("playing");
        setError(null);
        return;
      }
      if (stallReconnectCountRef.current < MAX_STALL_RECONNECTS) {
        stallTimerRef.current = window.setTimeout(() => {
          stallTimerRef.current = null;
          void reconnectFromStallRef.current();
        }, STALL_RECONNECT_MS);
        return;
      }
      wantPlayingRef.current = false;
      setWantsPlayback(false);
      startedPlayingRef.current = false;
      setStatus("error");
      setError("Station disconnected. Press play to retry.");
      unavailableRef.current?.(current);
    } finally {
      if (playbackGenerationRef.current === generation && !relayHandoffRef.current) {
        reconnectingRef.current = false;
      }
    }
  }, [attachSource, attemptPlayback, clearStallTimer, restoreAudibleOutput]);

  useEffect(() => {
    reconnectFromStallRef.current = reconnectFromStall;
  }, [reconnectFromStall]);

  useEffect(() => {
    bindSharedAudioElement(audioRef);

    const audio = audioRef.current;
    if (!audio) return;

    const scheduleStallReconnect = (target?: EventTarget | null) => {
      if (relayHandoffRef.current) return;
      if (target != null && isOutgoingAudioEvent(target)) return;
      if (suppressPlatformPauseRef.current || reconnectingRef.current) return;
      if (
        !canReconnectLiveStream({
          wantsPlayback: wantPlayingRef.current,
          hasStarted: startedPlayingRef.current,
          reconnectAttempts: stallReconnectCountRef.current,
        })
      ) {
        if (wantPlayingRef.current && !startedPlayingRef.current) {
          setStatus("loading");
        }
        return;
      }
      setStatus("reconnecting");
      if (stallTimerRef.current != null) return;
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null;
        void reconnectFromStallRef.current();
      }, STALL_RECONNECT_MS);
    };

    const onPlaying = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (target !== audioRef.current) return;

      if (!wantPlayingRef.current) {
        hardStopAudioElement(target);
        haltAudioOutput();
        return;
      }
      clearStallTimer();
      stallReconnectCountRef.current = 0;
      if (relayHandoffRef.current) {
        endRelayHandoff();
      } else {
        reconnectingRef.current = false;
      }
      startedPlayingRef.current = true;
      setStatus("playing");
      setError(null);
      if (usingRelayRef.current) {
        scheduleRelayRotation();
      } else {
        clearRelayRotationTimers();
        clearRelayOverlap();
        directAttemptsRef.current = 0;
      }
      syncMediaSessionPlaybackState("playing");
      const currentStation = stationRef.current;
      if (currentStation) {
        syncNowPlayingMetadata(currentStation, streamTitleRef.current, target);
      }
    };
    const onPause = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (target !== audioRef.current) return;
      if (relayHandoffRef.current || isOutgoingAudioEvent(target)) return;
      if (suppressPlatformPauseRef.current || reconnectingRef.current) return;

      if (wantPlayingRef.current && stationRef.current) {
        if (
          target.ended ||
          target.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
        ) {
          scheduleStallReconnect(target);
          return;
        }
        pausePlayback();
        return;
      }

      if (!wantPlayingRef.current && stationRef.current && !target.ended) {
        setStatus("paused");
        syncMediaSessionPlaybackState("paused");
      }
    };
    const onWaiting = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (target !== audioRef.current) return;
      scheduleStallReconnect(target);
    };
    const onStalled = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (target !== audioRef.current) return;
      scheduleStallReconnect(target);
    };
    const onEnded = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (relayHandoffRef.current || isOutgoingAudioEvent(target)) return;
      if (target !== audioRef.current) return;
      if (suppressPlatformPauseRef.current || reconnectingRef.current) return;
      if (!wantPlayingRef.current || !startedPlayingRef.current) return;
      void reconnectFromStallRef.current();
    };
    const onError = (event: Event) => {
      const target = event.currentTarget as HTMLAudioElement;
      if (relayHandoffRef.current || isOutgoingAudioEvent(target)) return;
      if (target !== audioRef.current) return;

      const current = stationRef.current;
      if (!current || !wantPlayingRef.current) return;
      if (suppressPlatformPauseRef.current || reconnectingRef.current) return;
      if (startedPlayingRef.current) {
        scheduleStallReconnect(target);
        return;
      }
      const useRelay =
        nextPlaybackMode({
          usingRelay: usingRelayRef.current,
          directAttempts: directAttemptsRef.current,
        }) === "relay";
      if (!useRelay) {
        directAttemptsRef.current += 1;
      }
      attachSource(current, useRelay);
      void target.play().catch(() => {
        if (startedPlayingRef.current) {
          scheduleStallReconnect(target);
          return;
        }
        wantPlayingRef.current = false;
        setWantsPlayback(false);
        target.muted = true;
        setStatus("error");
        setError("This station could not be played.");
      });
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [
    attachSource,
    clearRelayOverlap,
    clearRelayRotationTimers,
    clearStallTimer,
    endRelayHandoff,
    haltAudioOutput,
    isOutgoingAudioEvent,
    pausePlayback,
    scheduleRelayRotation,
    audioEpoch,
  ]);

  const tune = useCallback(
    async (nextStation: RadioStation, autoplay = true) => {
      const audio = bindSharedAudioElement(audioRef);
      if (!audio) return;

      const previousStation = stationRef.current;
      const isSwitch =
        previousStation != null &&
        previousStation.id !== nextStation.id &&
        autoplay;

      if (isSwitch && !audio.paused && !mutedRef.current && audio.volume > 0) {
        await fadeAudioVolume(
          audio,
          audio.volume,
          0,
          160,
          () => wantPlayingRef.current,
        );
      }

      if (autoplay) {
        wantPlayingRef.current = true;
        setWantsPlayback(true);
      }

      if (isSwitch && wantPlayingRef.current) {
        void playTuningJingle();
      }

      const shouldPlay = autoplay;

      stationRef.current = nextStation;
      startedPlayingRef.current = false;
      stallReconnectCountRef.current = 0;
      directAttemptsRef.current = 0;
      reconnectingRef.current = false;
      setStation(nextStation);
      setStreamTitle(null);
      streamTitleRef.current = null;
      setError(null);
      syncNowPlayingMetadata(nextStation, null, audio);

      if (!shouldPlay) {
        cancelPlaybackIntent();
        setStatus("paused");
        return;
      }

      playbackGenerationRef.current += 1;
      const generation = playbackGenerationRef.current;

      setStatus("loading");
      audio.muted = mutedRef.current;
      void unlockStandbyAudio();
      attachSource(nextStation, false);

      clearAutoUnmute();
      try {
          if (
            playbackGenerationRef.current !== generation ||
            !wantPlayingRef.current
          ) {
            return;
          }
          const started = await attemptPlayback(nextStation, generation, {
            userInitiated: !prefersMutedAutoplay(),
          });
          if (
            playbackGenerationRef.current !== generation ||
            !wantPlayingRef.current
          ) {
            audio.muted = true;
            audio.pause();
            return;
          }
          if (started) {
            if (!prefersMutedAutoplay()) {
              await restoreAudibleOutput();
            }
            startedPlayingRef.current = true;
            setStatus("playing");
            setError(null);
            if (isSwitch && !mutedRef.current && !audio.muted) {
              audio.volume = 0;
              await fadeAudioVolume(
                audio,
                0,
                volumeRef.current,
                220,
                () => wantPlayingRef.current,
              );
            }
          } else {
            wantPlayingRef.current = false;
            setWantsPlayback(false);
            audio.muted = true;
            audio.pause();
            setStatus("paused");
            setError("Tap play to start this station.");
          }
        } catch {
          if (playbackGenerationRef.current !== generation) return;
          wantPlayingRef.current = false;
          setWantsPlayback(false);
          audio.muted = true;
          audio.pause();
          setStatus("paused");
          setError("Tap play to start this station.");
        }
    },
    [
      attachSource,
      attemptPlayback,
      cancelPlaybackIntent,
      clearAutoUnmute,
      restoreAudibleOutput,
      unlockStandbyAudio,
    ],
  );

  const togglePlayback = useCallback(async () => {
    const audio = bindSharedAudioElement(audioRef);
    if (!audio || !stationRef.current) return;

    if (wantPlayingRef.current) {
      pausePlayback();
      return;
    }

    clearAutoUnmute();
    const generation = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = generation;
    wantPlayingRef.current = true;
    setWantsPlayback(true);
    audio.muted = mutedRef.current;
    setStatus("loading");
    const stationToPlay = stationRef.current;
    void unlockStandbyAudio();
    try {
      attachSource(stationToPlay, false);
      if (
        playbackGenerationRef.current !== generation ||
        !wantPlayingRef.current
      ) {
        return;
      }
      const started = await attemptPlayback(stationToPlay, generation, {
        userInitiated: true,
      });
      if (
        playbackGenerationRef.current !== generation ||
        !wantPlayingRef.current
      ) {
        audio.muted = true;
        audio.pause();
        return;
      }
      if (started) {
        startedPlayingRef.current = true;
        setStatus("playing");
        setError(null);
      } else {
        wantPlayingRef.current = false;
        setWantsPlayback(false);
        audio.muted = true;
        audio.pause();
        setStatus("error");
        setError("Playback was blocked. Tap play again.");
      }
    } catch {
      if (playbackGenerationRef.current !== generation) return;
      wantPlayingRef.current = false;
      setWantsPlayback(false);
      audio.muted = true;
      audio.pause();
      setStatus("error");
      setError("Playback was blocked. Tap play again.");
    }
  }, [
    attachSource,
    attemptPlayback,
    clearAutoUnmute,
    pausePlayback,
    unlockStandbyAudio,
  ]);

  const resumePlayback = useCallback(async () => {
    const audio = bindSharedAudioElement(audioRef);
    if (!audio || !stationRef.current) return;
    if (wantPlayingRef.current) return;
    await togglePlayback();
  }, [togglePlayback]);

  const unlockPlayback = useCallback(async () => {
    configurePlatformAudioSession();
    const audio = bindSharedAudioElement(audioRef);
    if (!audio) return;

    audio.muted = false;
    try {
      if (!audio.getAttribute("src")) {
        audio.src =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await audio.play();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } else if (audio.paused) {
        await audio.play();
      }
    } catch {
      // Gesture captured even if this silent start is rejected.
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const normalized = Math.max(0, Math.min(1, value));
    setVolumeState(normalized);
    if (audioRef.current) audioRef.current.volume = normalized;
    if (relayOverlapAudioRef.current) {
      relayOverlapAudioRef.current.volume = normalized;
    }
    if (standbyAudioRef.current) {
      standbyAudioRef.current.volume = normalized;
    }
    if (normalized > 0) {
      setMutedState(false);
      mutedRef.current = false;
      if (audioRef.current) audioRef.current.muted = false;
      if (relayOverlapAudioRef.current) relayOverlapAudioRef.current.muted = false;
      if (standbyAudioRef.current) standbyAudioRef.current.muted = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((current) => {
      const next = !current;
      mutedRef.current = next;
      if (audioRef.current) audioRef.current.muted = next;
      if (relayOverlapAudioRef.current) relayOverlapAudioRef.current.muted = next;
      if (standbyAudioRef.current) standbyAudioRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!station || status !== "playing") return;
    const controller = new AbortController();

    const updateMetadata = async () => {
      const stationId = station.id;
      try {
        const response = await fetch(
          `/api/metadata/${encodeURIComponent(stationId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          streamTitle: string | null;
        };
        if (stationRef.current?.id !== stationId) return;
        setStreamTitle(data.streamTitle);
        streamTitleRef.current = data.streamTitle;
        if (stationRef.current) {
          syncNowPlayingMetadata(stationRef.current, data.streamTitle, audioRef.current);
        }
      } catch {
        // Metadata is optional; playback remains uninterrupted.
      }
    };

    void updateMetadata();
    const interval = window.setInterval(updateMetadata, 25_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [station, status]);

  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    if (analyserRef.current) {
      let frame = 0;
      let lastUpdate = 0;
      const render = (time: number) => {
        if (time - lastUpdate > 70) {
          const analyser = analyserRef.current;
          if (analyser) {
            const values = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(values);
            setLevels(
              EMPTY_LEVELS.map((_, index) => {
                const sample = values[index % values.length] ?? 0;
                return Math.max(0.04, sample / 255);
              }),
            );
          }
          lastUpdate = time;
        }
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
      return () => cancelAnimationFrame(frame);
    }

    let frame = 0;
    const render = (time: number) => {
      setLevels(
        EMPTY_LEVELS.map((_, index) => {
          const wave = Math.sin(time / 180 + index * 0.55);
          return Math.max(0.06, 0.22 + wave * 0.14);
        }),
      );
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  return {
    station,
    status,
    isPlaying:
      status === "playing" ||
      (wantsPlayback && (status === "loading" || status === "reconnecting")),
    wantsPlayback,
    awaitingUnmute,
    volume,
    muted,
    streamTitle,
    error,
    levels: status === "playing" ? levels : EMPTY_LEVELS,
    tune,
    togglePlayback,
    pausePlayback,
    resumePlayback,
    unlockPlayback,
    setVolume,
    toggleMute,
  };
}
