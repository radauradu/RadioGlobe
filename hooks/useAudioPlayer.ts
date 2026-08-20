"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RadioStation } from "@/lib/radioApi";
import { fadeAudioVolume, playTuningJingle } from "@/lib/tuningSound";

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
  const usingRelayRef = useRef(false);
  const unavailableRef = useRef(onStationUnavailable);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const attachSourceRef = useRef<
    (nextStation: RadioStation, relay: boolean) => void
  >(() => undefined);
  const autoUnmuteCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unavailableRef.current = onStationUnavailable;
  }, [onStationUnavailable]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const clearAutoUnmute = useCallback(() => {
    autoUnmuteCleanupRef.current?.();
    autoUnmuteCleanupRef.current = null;
    setAwaitingUnmute(false);
  }, []);

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
      const audio = audioRef.current;
      if (audio && wantPlayingRef.current) {
        audio.muted = mutedRef.current;
        const context = audioContextRef.current;
        if (context?.state === "suspended") {
          void context.resume().catch(() => undefined);
        }
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
  }, [clearAutoUnmute]);

  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || typeof AudioContext === "undefined") return;

    try {
      const context =
        audioContextRef.current ??
        new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = context;
      if (!sourceRef.current) {
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);
        analyser.connect(context.destination);
        sourceRef.current = source;
        analyserRef.current = analyser;
      }
      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
    } catch {
      analyserRef.current = null;
    }
  }, []);

  // Autoplay can start the media element while leaving Web Audio suspended.
  // Resume the analyser on the next genuine user gesture so the spectrum
  // follows the music instead of remaining a flat line.
  useEffect(() => {
    const resumeAnalyser = () => {
      const context = audioContextRef.current;
      if (
        context?.state === "suspended" &&
        wantPlayingRef.current
      ) {
        void context.resume().catch(() => undefined);
      }
    };
    window.addEventListener("pointerdown", resumeAnalyser, { passive: true });
    window.addEventListener("keydown", resumeAnalyser);
    window.addEventListener("touchstart", resumeAnalyser, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", resumeAnalyser);
      window.removeEventListener("keydown", resumeAnalyser);
      window.removeEventListener("touchstart", resumeAnalyser);
    };
  }, []);

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
      const audio = audioRef.current;
      if (!audio) return;
      destroyHls();
      usingRelayRef.current = relay;

      const url = sourceFor(nextStation, relay);
      const isHls =
        /\.m3u8(?:$|\?)/i.test(nextStation.streamUrl) ||
        nextStation.codec.includes("HLS");

      audio.pause();
      audio.removeAttribute("src");
      audio.load();

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
          if (!wantPlayingRef.current) {
            hls.stopLoad();
            return;
          }
          hls.loadSource(url);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (!wantPlayingRef.current) {
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
      [destroyHls, sourceFor],
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
    async (nextStation: RadioStation, generation: number) => {
      const audio = audioRef.current;
      if (!audio) return false;

      const stillWanted = () =>
        playbackGenerationRef.current === generation &&
        wantPlayingRef.current;

      const tryMuted = async () => {
        audio.muted = true;
        await audio.play();
        if (!stillWanted()) return false;
        armAutoUnmute();
        return true;
      };

      try {
        await audio.play();
        return stillWanted();
      } catch (playError) {
        if (!stillWanted()) return false;

        const blockedBySound =
          playError instanceof DOMException &&
          playError.name === "NotAllowedError";

        if (blockedBySound) {
          try {
            return await tryMuted();
          } catch {
            if (!stillWanted()) return false;
          }
        }

        if (!usingRelayRef.current) {
          attachSource(nextStation, true);
          try {
            return await tryMuted();
          } catch {
            if (!stillWanted()) return false;
          }
        }

        return false;
      }
    },
    [armAutoUnmute, attachSource],
  );

  useEffect(() => {
    const registry = audioElementRegistry();
    // Strict Mode, hot reloads, or a previous interrupted mount must never
    // leave a second radio playing behind the current player.
    for (const existingAudio of registry) {
      hardStopAudioElement(existingAudio);
    }
    const audio = new Audio();
    audio.preload = "none";
    // Streams are played through our same-origin relay before entering Web
    // Audio. A cross-origin stream connected directly to Web Audio is
    // intentionally silenced by browsers.
    audio.volume = 0.72;
    audioRef.current = audio;
    registry.add(audio);

    const onPlaying = () => {
      if (!wantPlayingRef.current) {
        audio.muted = true;
        audio.pause();
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
      hardStopAudioElement(audio);
      registry.delete(audio);
      destroyHls();
      autoUnmuteCleanupRef.current?.();
      autoUnmuteCleanupRef.current = null;
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
      audioRef.current = null;
    };
  }, [attachSource, destroyHls]);

  const pausePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    clearAutoUnmute();
    playbackGenerationRef.current += 1;
    wantPlayingRef.current = false;
    setWantsPlayback(false);
    startedPlayingRef.current = false;
    destroyHls();
    for (const radioAudio of audioElementRegistry()) {
      hardStopAudioElement(radioAudio);
    }
    if (audioContextRef.current?.state === "running") {
      void audioContextRef.current.suspend().catch(() => undefined);
    }
    setStatus("paused");

    // Belt-and-suspenders: if any in-flight async step (e.g. a delayed
    // AudioContext resume) manages to call play() right around this tick,
    // make sure it gets shut down too.
    window.setTimeout(() => {
      if (!wantPlayingRef.current && !audio.paused) {
        audio.muted = true;
        audio.pause();
      }
    }, 0);
  }, [clearAutoUnmute, destroyHls]);

  const tune = useCallback(
    async (nextStation: RadioStation, autoplay = true) => {
      const audio = audioRef.current;
      if (!audio) return;

      const previousStation = stationRef.current;
      const isSwitch =
        previousStation != null &&
        previousStation.id !== nextStation.id &&
        autoplay;

      if (isSwitch && !audio.paused && !mutedRef.current && audio.volume > 0) {
        await fadeAudioVolume(audio, audio.volume, 0, 160);
      }
      if (isSwitch) {
        void playTuningJingle();
      }

      playbackGenerationRef.current += 1;
      const generation = playbackGenerationRef.current;

      stationRef.current = nextStation;
      startedPlayingRef.current = false;
      setStation(nextStation);
      setStreamTitle(null);
      setError(null);
      setStatus(autoplay ? "loading" : "paused");
      wantPlayingRef.current = autoplay;
      setWantsPlayback(autoplay);
      audio.muted = autoplay ? mutedRef.current : true;
      attachSource(nextStation, true);

      if (autoplay) {
        clearAutoUnmute();
        try {
          ensureAnalyser();
          if (
            playbackGenerationRef.current !== generation ||
            !wantPlayingRef.current
          ) {
            return;
          }
          const started = await attemptPlayback(nextStation, generation);
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
            if (isSwitch && !mutedRef.current) {
              audio.volume = 0;
              await fadeAudioVolume(audio, 0, volumeRef.current, 220);
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
      } else {
        hlsRef.current?.stopLoad();
      }
    },
    [attachSource, attemptPlayback, clearAutoUnmute, ensureAnalyser],
  );

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
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
    startedPlayingRef.current = false;
    audio.muted = mutedRef.current;
    setStatus("loading");
    const stationToPlay = stationRef.current;
    try {
      attachSource(stationToPlay, true);
      ensureAnalyser();
      if (
        playbackGenerationRef.current !== generation ||
        !wantPlayingRef.current
      ) {
        return;
      }
      const started = await attemptPlayback(stationToPlay, generation);
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
    ensureAnalyser,
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
    isPlaying: status === "playing",
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
