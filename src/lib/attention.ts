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

export async function startAttentionMonitor(
  video: HTMLVideoElement,
  onStateChange: AttentionCallback
): Promise<() => void> {
  let stream: MediaStream | null = null;
  let landmarker: FaceLandmarker | null = null;
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
    // Request camera access only after the user starts monitoring.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 24 },
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

    const modelUrl = chrome.runtime.getURL("models/face_landmarker.task");
    const wasmUrl = chrome.runtime.getURL("wasm");
    console.log("Scroomin: Model URL:", modelUrl);
    console.log("Scroomin: WASM URL:", wasmUrl);

    // Verify model file is accessible
    const modelCheck = await fetch(modelUrl, { method: "HEAD" });
    if (!modelCheck.ok) {
      throw new Error(`Model file not accessible: ${modelCheck.status} ${modelCheck.statusText}`);
    }
    console.log("Scroomin: Model file verified accessible");

    const vision = await FilesetResolver.forVisionTasks(wasmUrl);

    landmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
      }
    );

    const loop = () => {
      if (stopped || !landmarker) return;

      // Wait until the video has actual frames.
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      ) {
        const now = performance.now();

        const result = landmarker.detectForVideo(
          video,
          now
        );

        const faceCount = result.faceLandmarks.length;
        const multipleFaces = faceCount > 1;
        const faceDetected = faceCount > 0;

        if (multipleFaces) {
          awaySince = null;
          attendingSince = null;

          if (multipleFacesSince === null) {
            multipleFacesSince = now;
          }

          // Require a short stable detection before triggering.
          if (now - multipleFacesSince >= 250) {
            publish("multiple-faces");
          }
        } else if (faceDetected) {
          multipleFacesSince = null;
          awaySince = null;

          if (attendingSince === null) {
            attendingSince = now;
          }

          // Require a short stable detection before restoring.
          if (now - attendingSince >= 250) {
            publish("attending");
          }
        } else {
          attendingSince = null;
          multipleFacesSince = null;

          if (awaySince === null) {
            awaySince = now;
          }

          // Require sustained absence to avoid flickering.
          if (now - awaySince >= 700) {
            publish("away");
          }
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    // The caller uses this function to stop the camera and detector.
    return () => {
      stopped = true;
      cancelAnimationFrame(animationId);

      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;

      landmarker?.close();
      landmarker = null;
    };
  } catch (error) {
    stopped = true;

    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;

    landmarker?.close();
    landmarker = null;

    console.error("Scroomin attention monitor error:", error);
    onStateChange("error");

    throw error;
  }
}