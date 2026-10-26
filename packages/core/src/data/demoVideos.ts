import type { DemoVideo } from "../types";

/* Original HELIX demo clips (Higgsfield), keyed by exercise id. Male avatar by default;
   the female avatar performs yoga, mobility and women-focused movements. */
const CLIP = "https://d8j0ntlcm91z4.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";

export const DEMO_VIDEOS: Record<number, DemoVideo> = {
  1: { src: `${CLIP}hf_20261026_194431_6396fb00-dbce-45ae-8511-ed44bf5a17d0.mp4`, avatar: "male" },
  2: { src: `${CLIP}hf_20261026_194410_6b716d2b-07c4-44cd-b6fe-5b7a95ded3c5.mp4`, avatar: "male" },
  8: { src: `${CLIP}hf_20261026_194842_a7432182-d66f-4b27-862d-15895a583615.mp4`, avatar: "female" },
  9: { src: `${CLIP}hf_20261026_194411_7ba0881c-8a90-4964-becc-2e6263040ff0.mp4`, avatar: "female" },
  14: { src: `${CLIP}hf_20261026_194410_3521b374-fc08-418b-83bc-a717a2e61c45.mp4`, avatar: "male" },
  534: { src: `${CLIP}hf_20261026_192433_e5317418-e3d8-4955-ac35-7bf2f3978bca.mp4`, avatar: "female" },
  623: { src: `${CLIP}hf_20261026_192433_f1165e7a-99a4-4daf-abce-dbbadd43d1b4.mp4`, avatar: "male" },
  624: { src: `${CLIP}hf_20261026_192433_16943087-3920-4234-9949-e64c9d2c20a3.mp4`, avatar: "male" },
};
