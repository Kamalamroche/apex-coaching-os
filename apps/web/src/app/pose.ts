/* MediaPipe's pose model, loaded once from APEX's own site (public/pose, public/pose-model). Used by the camera rep
   counter and the posture assessment. Nothing from the camera leaves the phone for this. */

type PoseLandmarker = import("@mediapipe/tasks-vision").PoseLandmarker;

let loading: Promise<PoseLandmarker> | null = null;
export function loadPose(): Promise<PoseLandmarker> {
  loading ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("/pose");
    const make = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/pose-model/pose_landmarker_lite.task", delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    // Older phones without WebGL2: fall back to the processor.
    return make("GPU").catch(() => make("CPU"));
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
