import type { DemoVideo } from "../types";

/* Original HELIX demo clips (Higgsfield), keyed by exercise id. Male avatar by default;
   the female avatar performs yoga, mobility and women-focused movements. */
const CLIP = "https://d8j0ntlcm91z4.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";
/* Clips trimmed after generation (e.g. to cut a stray ending) live in Higgsfield's upload store. */
const UPLOAD = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";

export const DEMO_VIDEOS: Record<number, DemoVideo> = {
  1: { src: `${UPLOAD}d402455e-206e-4c33-8028-564a09240de0.mp4`, avatar: "male" },
  2: { src: `${UPLOAD}400ebf52-de60-4922-b651-0b4e50331c42.mp4`, avatar: "male" },
  4: { src: `${CLIP}hf_20261026_223004_d874eb6a-3ce5-4e3e-9492-de99196da773.mp4`, avatar: "male" },
  6: { src: `${CLIP}hf_20261026_222648_25c5f966-00e7-4039-bbc9-6dcee843f255.mp4`, avatar: "male" },
  8: { src: `${CLIP}hf_20261026_194842_a7432182-d66f-4b27-862d-15895a583615.mp4`, avatar: "female" },
  9: { src: `${CLIP}hf_20261026_194411_7ba0881c-8a90-4964-becc-2e6263040ff0.mp4`, avatar: "female" },
  14: { src: `${CLIP}hf_20261026_194410_3521b374-fc08-418b-83bc-a717a2e61c45.mp4`, avatar: "male" },
  17: { src: `${CLIP}hf_20261026_201449_94282063-4842-4f1e-8444-f080461a67ac.mp4`, avatar: "male" },
  83: { src: `${CLIP}hf_20261026_201448_095616b7-9b37-42ad-8832-1c5e2f65aeb3.mp4`, avatar: "female" },
  89: { src: `${CLIP}hf_20261026_213007_2d23a04e-67da-448e-a5fa-590783048f09.mp4`, avatar: "female" },
  109: { src: `${CLIP}hf_20261026_201448_b7b9e676-99ac-4c73-bef8-b7af755f802f.mp4`, avatar: "female" },
  112: { src: `${UPLOAD}e606fb84-11ed-41c2-a871-a7c8d8660636.mp4`, avatar: "male" },
  120: { src: `${CLIP}hf_20261026_201450_ad54d444-9b3f-4c65-ada7-e42565cb7fcf.mp4`, avatar: "male" },
  132: { src: `${CLIP}hf_20261026_201606_2bf21193-eafc-4eaa-b58c-fb53d2f4b802.mp4`, avatar: "male" },
  140: { src: `${CLIP}hf_20261026_203827_f0b5f47b-e5af-4b2e-925f-2774af1f727b.mp4`, avatar: "male" },
  304: { src: `${UPLOAD}925d99cb-a2a4-4130-b761-9a17067ea856.mp4`, avatar: "female" },
  534: { src: `${CLIP}hf_20261026_192433_e5317418-e3d8-4955-ac35-7bf2f3978bca.mp4`, avatar: "female" },
  536: { src: `${CLIP}hf_20261026_203854_5da7fb40-2f5f-4434-9d32-d4d306613239.mp4`, avatar: "female" },
  623: { src: `${CLIP}hf_20261026_192433_f1165e7a-99a4-4daf-abce-dbbadd43d1b4.mp4`, avatar: "male" },
  624: { src: `${CLIP}hf_20261026_192433_16943087-3920-4234-9949-e64c9d2c20a3.mp4`, avatar: "male" },
};
