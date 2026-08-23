let tuningContext: AudioContext | null = null;
const activeTuningNodes = new Set<AudioScheduledSourceNode>();

function tuningAudioContext() {
  if (typeof AudioContext === "undefined") return null;
  tuningContext ??= new AudioContext();
  return tuningContext;
}

function trackTuningNode(node: AudioScheduledSourceNode) {
  activeTuningNodes.add(node);
  node.addEventListener(
    "ended",
    () => {
      activeTuningNodes.delete(node);
    },
    { once: true },
  );
}

export function stopTuningSound() {
  for (const node of activeTuningNodes) {
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    try {
      node.disconnect();
    } catch {
      // Already disconnected.
    }
  }
  activeTuningNodes.clear();

  if (tuningContext?.state === "running") {
    void tuningContext.suspend().catch(() => undefined);
  }
}

export async function playTuningJingle() {
  const context = tuningAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    await context.resume().catch(() => undefined);
  }

  const start = context.currentTime;
  const output = context.createGain();
  output.connect(context.destination);
  output.gain.setValueAtTime(0.0001, start);
  output.gain.exponentialRampToValueAtTime(0.07, start + 0.015);
  output.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);

  const noiseLength = Math.floor(context.sampleRate * 0.28);
  const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseLength; index += 1) {
    const decay = 1 - index / noiseLength;
    samples[index] = (Math.random() * 2 - 1) * decay * decay;
  }

  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;

  const sweep = context.createOscillator();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(920, start);
  sweep.frequency.exponentialRampToValueAtTime(240, start + 0.24);

  noise.connect(output);
  sweep.connect(output);
  trackTuningNode(noise);
  trackTuningNode(sweep);
  noise.start(start);
  noise.stop(start + 0.28);
  sweep.start(start);
  sweep.stop(start + 0.28);
}

export function fadeAudioVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  shouldContinue?: () => boolean,
) {
  const steps = Math.max(1, Math.round(durationMs / 16));
  const stepMs = durationMs / steps;
  let step = 0;
  audio.volume = from;

  return new Promise<void>((resolve) => {
    const tick = () => {
      if (shouldContinue && !shouldContinue()) {
        resolve();
        return;
      }
      step += 1;
      const progress = step / steps;
      audio.volume = from + (to - from) * progress;
      if (step >= steps) {
        resolve();
        return;
      }
      window.setTimeout(tick, stepMs);
    };
    tick();
  });
}
