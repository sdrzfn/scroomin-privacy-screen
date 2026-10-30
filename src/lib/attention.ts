import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

export type AttentionState =
  | "idle"
  | "attending"
  | "away"
  | "multiple-faces"
  | "error";

export type AttentionCallback = (
  state: AttentionState
) => void;

export interface DetectionResult {
  faceCount: number;
  multipleFaces: boolean;
  faceDetected: boolean;
}

export interface AttentionMonitorConfig {
  modelAssetPath: string;
  wasmPath: string;
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  frameRate?: number;
}

/** How long a condition must hold before the state is published (debounce). */
const ATTEND_AFTER_MS = 250;
const MULTIPLE_AFTER_MS = 250;
const AWAY_AFTER_MS = 700;

let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
let landmarker: FaceLandmarker | null = null;
let initializing: Promise<void> | null = null;

export async function initializeVision(
  wasmPath: string,
  modelAssetPath: string
): Promise<void> {
  if (vision && landmarker) return;

  if (!initializing) {
    initializing = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(wasmPath);

      const instance = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
      });

      vision = fileset;
      landmarker = instance;
    })().finally(() => {
      initializing = null;
    });
  }

  await initializing;
}

export function detectFaces(
  video: HTMLVideoElement,
  timestamp: number
): DetectionResult | null {
  if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
    return null;
  }

  const result = landmarker.detectForVideo(video, timestamp);
  const faceCount = result.faceLandmarks.length;

  return {
    faceCount,
    multipleFaces: faceCount > 1,
    faceDetected: faceCount > 0,
  };
}

export function closeVision(): void {
  landmarker?.close();
  landmarker = null;
  vision = null;
}

export async function startAttentionMonitor(
  video: HTMLVideoElement,
  onStateChange: AttentionCallback,
  config: AttentionMonitorConfig
): Promise<() => void> {
  const frameRate = config.frameRate ?? 15;
  // Run detection at the camera's frame rate instead of the display refresh rate.
  // A timer (not requestAnimationFrame) is used so it keeps running in a hidden offscreen document.
  const detectIntervalMs = Math.round(1000 / frameRate);

  let stream: MediaStream | null = null;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  let currentState: AttentionState = "idle";
  let awaySince: number | null = null;
  let attendingSince: number | null = null;
  let multipleFacesSince: number | null = null;

  const publish = (state: AttentionState) => {
    if (currentState === state) return;
    currentState = state;
    onStateChange(state);
  };

  const release = () => {
    stopped = true;
    clearTimeout(timerId);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  };

  // The camera was unplugged, taken by another app, or detection threw while running.
  // Stop and report "error" so the caller can fail closed instead of silently going blind.
  const fail = (error: unknown) => {
    if (stopped) return;
    console.error("Scroomin attention monitor lost the camera:", error);
    release();
    publish("error");
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: config.facingMode ?? "user",
        width: { ideal: config.width ?? 640 },
        height: { ideal: config.height ?? 480 },
        frameRate: { ideal: frameRate, max: Math.max(frameRate, 24) },
      },
    });

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => fail(new Error("Camera track ended")));
    });

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    await initializeVision(config.wasmPath, config.modelAssetPath);

    const tick = () => {
      if (stopped) return;

      try {
        const now = performance.now();
        const detection = detectFaces(video, now);

        if (detection) {
          const { multipleFaces, faceDetected } = detection;

          if (multipleFaces) {
            awaySince = null;
            attendingSince = null;

            if (multipleFacesSince === null) {
              multipleFacesSince = now;
            }

            if (now - multipleFacesSince >= MULTIPLE_AFTER_MS) {
              publish("multiple-faces");
            }
          } else if (faceDetected) {
            multipleFacesSince = null;
            awaySince = null;

            if (attendingSince === null) {
              attendingSince = now;
            }

            if (now - attendingSince >= ATTEND_AFTER_MS) {
              publish("attending");
            }
          } else {
            attendingSince = null;
            multipleFacesSince = null;

            if (awaySince === null) {
              awaySince = now;
            }

            if (now - awaySince >= AWAY_AFTER_MS) {
              publish("away");
            }
          }
        }
      } catch (error) {
        fail(error);
        return;
      }

      timerId = setTimeout(tick, detectIntervalMs);
    };

    timerId = setTimeout(tick, 0);

    return () => {
      release();
      closeVision();
    };
  } catch (error) {
    release();
    console.error("Scroomin attention monitor error:", error);
    onStateChange("error");
    throw error;
  }
}