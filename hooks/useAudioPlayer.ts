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
import { fadeAudioVolume, playTuningJingle, stopTuningSound } from "@/lib/tuningSound";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

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

function getSharedAudioElement(registry: Set<HTMLAudioElement>) {
  const existing = registry.values().next().value;
  if (existing) return existing;

  const audio = new Audio();
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
  timeoutMs = 15000,
): Promise<boolean> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
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
      resolve(ready);
    };
    const onReady = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("loadeddata", onReady);
  });
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

  bindSharedAudioElement(audioRef);

  useEffect(() => {
    unavailableRef.current = onStationUnavailable;
  }, [onStationUnavailable]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

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
    const audio = bindSharedAudioElement(audioRef);
    if (!audio || typeof AudioContext === "undefined") return;

    try {
      const context =
        audioContextRef.current ??
        new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = context;
      if (!sourceRef.current) {
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        const outputGain = context.createGain();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);
        analyser.connect(outputGain);
        outputGain.connect(context.destination);
        sourceRef.current = source;
        analyserRef.current = analyser;
        outputGainRef.current = outputGain;
      }
    } catch {
      analyserRef.current = null;
      outputGainRef.current = null;
    }
  }, []);

  const restoreAudibleOutput = useCallback(async () => {
    const audio = bindSharedAudioElement(audioRef);
    if (!audio) return;

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

  const haltAudioOutput = useCallback(() => {
    attachGenerationRef.current += 1;
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
  }, [destroyHls, silencePlaybackOutput]);

  const cancelPlaybackIntent = useCallback(() => {
    playbackGenerationRef.current += 1;
    wantPlayingRef.current = false;
    setWantsPlayback(false);
    startedPlayingRef.current = false;
    clearAutoUnmute();
    haltAudioOutput();
  }, [clearAutoUnmute, haltAudioOutput]);

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
        ? `/api/stream/${encodeURIComponent(nextStation.id)}`
        : nextStation.streamUrl,
    [],
  );

  const attachSource: (nextStation: RadioStation, relay: boolean) => void =
    useCallback(
    (nextStation: RadioStation, relay: boolean) => {
      const audio = bindSharedAudioElement(audioRef);
      if (!audio) return;
      if (!wantPlayingRef.current) return;

      haltAudioOutput();
      const attachGen = attachGenerationRef.current;
      usingRelayRef.current = relay;

      const url = sourceFor(nextStation, relay);
      const isHls =
        /\.m3u8(?:$|\?)/i.test(nextStation.streamUrl) ||
        nextStation.codec.includes("HLS");

      if (isHls && Hls.isSupported()) {
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
          if (!usingRelayRef.current) {
            attachSourceRef.current(nextStation, true);
            void audio.play();
          } else {
            wantPlayingRef.current = false;
            setWantsPlayback(false);
            startedPlayingRef.current = false;
            audio.pause();
            setStatus("error");
            setError("Station disconnected. Press play to retry.");
            unavailableRef.current?.(nextStation);
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

      const ready = await waitForPlaybackReady(audio);
      if (!stillWanted()) return false;
      if (!ready) {
        const slowReady = await waitForPlaybackReady(audio, 20000);
        if (!stillWanted() || !slowReady) {
          if (!usingRelayRef.current) {
            attachSource(nextStation, true);
            if (!(await waitForPlaybackReady(audio, 20000)) || !stillWanted()) {
              return false;
            }
          } else {
            return false;
          }
        }
      }

      const mutedFirst =
        !userInitiated &&
        (prefersMutedAutoplay() || !startedPlayingRef.current);
      if (await tryPlay(mutedFirst)) return true;

      if (!usingRelayRef.current) {
        attachSource(nextStation, true);
        if (!(await waitForPlaybackReady(audio)) || !stillWanted()) return false;
        return tryPlay(true);
      }

      return false;
    },
    [armAutoUnmute, attachSource, restoreAudibleOutput],
  );

  useEffect(() => {
    bindSharedAudioElement(audioRef);

    const audio = audioRef.current;
    if (!audio) return;

    const onPlaying = () => {
      if (!wantPlayingRef.current) {
        hardStopAudioElement(audio);
        haltAudioOutput();
        return;
      }
      startedPlayingRef.current = true;
      setStatus("playing");
      setError(null);
    };
    const onPause = () => {
      if (
        !wantPlayingRef.current &&
        stationRef.current &&
        !audio.ended
      ) {
        setStatus("paused");
      }
    };
    const onWaiting = () => {
      if (wantPlayingRef.current && !startedPlayingRef.current) {
        setStatus("loading");
      }
    };
    const onError = () => {
      const current = stationRef.current;
      if (!current || !wantPlayingRef.current) return;
      if (!usingRelayRef.current) {
        attachSource(current, true);
        void audio.play().catch(() => {
          wantPlayingRef.current = false;
          setWantsPlayback(false);
          audio.muted = true;
          setStatus("error");
          setError("This station could not be played.");
        });
      } else {
        wantPlayingRef.current = false;
        setWantsPlayback(false);
        startedPlayingRef.current = false;
        audio.pause();
        setStatus("error");
        setError("Station disconnected. Press play to retry.");
        unavailableRef.current?.(current);
      }
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
    };
  }, [attachSource, haltAudioOutput]);

  const pausePlayback = useCallback(() => {
    cancelPlaybackIntent();
    setStatus("paused");

    window.setTimeout(() => {
      if (!wantPlayingRef.current) {
        haltAudioOutput();
      }
    }, 0);
  }, [cancelPlaybackIntent, haltAudioOutput]);

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
      setStation(nextStation);
      setStreamTitle(null);
      setError(null);

      if (!shouldPlay) {
        cancelPlaybackIntent();
        setStatus("paused");
        return;
      }

      playbackGenerationRef.current += 1;
      const generation = playbackGenerationRef.current;

      setStatus("loading");
      audio.muted = mutedRef.current;
      attachSource(nextStation, true);

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
    try {
      attachSource(stationToPlay, true);
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
  ]);

  const setVolume = useCallback((value: number) => {
    const normalized = Math.max(0, Math.min(1, value));
    setVolumeState(normalized);
    if (audioRef.current) audioRef.current.volume = normalized;
    if (normalized > 0) {
      setMutedState(false);
      mutedRef.current = false;
      if (audioRef.current) audioRef.current.muted = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((current) => {
      const next = !current;
      mutedRef.current = next;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!station || status !== "playing") return;
    const controller = new AbortController();

    const updateMetadata = async () => {
      try {
        const response = await fetch(
          `/api/metadata/${encodeURIComponent(station.id)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          streamTitle: string | null;
        };
        setStreamTitle(data.streamTitle);
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
  }, [status]);

  return {
    station,
    status,
    isPlaying: status === "playing" || (wantsPlayback && status === "loading"),
    wantsPlayback,
    awaitingUnmute,
    volume,
    muted,
    streamTitle,
    error,
    levels: status === "playing" ? levels : EMPTY_LEVELS,
    tune,
    togglePlayback,
    setVolume,
    toggleMute,
  };
}
