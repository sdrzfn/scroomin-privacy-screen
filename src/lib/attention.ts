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

let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
let landmarker: FaceLandmarker | null = null;

export async function initializeVision(
  wasmPath: string,
  modelAssetPath: string
): Promise<void> {
  if (vision && landmarker) return;

  vision = await FilesetResolver.forVisionTasks(wasmPath);

  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numFaces: 2,
  });
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
  let stream: MediaStream | null = null;
  let animationId = 0;
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

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: config.facingMode ?? "user",
        width: { ideal: config.width ?? 640 },
        height: { ideal: config.height ?? 480 },
        frameRate: { ideal: config.frameRate ?? 15, max: config.frameRate ?? 24 },
      },
    });

    if (stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return () => {};
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    await initializeVision(config.wasmPath, config.modelAssetPath);

    const loop = () => {
      if (stopped || !landmarker) return;

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      ) {
        const now = performance.now();
        const detection = detectFaces(video, now);

        if (!detection) {
          animationId = requestAnimationFrame(loop);
          return;
        }

        const { multipleFaces, faceDetected } = detection;

        if (multipleFaces) {
          awaySince = null;
          attendingSince = null;

          if (multipleFacesSince === null) {
            multipleFacesSince = now;
          }

          if (now - multipleFacesSince >= 250) {
            publish("multiple-faces");
          }
        } else if (faceDetected) {
          multipleFacesSince = null;
          awaySince = null;

          if (attendingSince === null) {
            attendingSince = now;
          }

          if (now - attendingSince >= 250) {
            publish("attending");
          }
        } else {
          attendingSince = null;
          multipleFacesSince = null;

          if (awaySince === null) {
            awaySince = now;
          }

          if (now - awaySince >= 700) {
            publish("away");
          }
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationId);

      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  } catch (error) {
    stopped = true;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    console.error("Scroomin attention monitor error:", error);
    onStateChange("error");
    throw error;
  }
}