import type { DemoVideo } from "../types";

/* Original HELIX demo clips (Higgsfield), keyed by exercise id. Male avatar by default;
   the female avatar performs yoga, mobility and women-focused movements. */
const CLIP = "https://d8j0ntlcm91z4.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";
/* Clips trimmed after generation (e.g. to cut a stray ending) live in Higgsfield's upload store. */
const UPLOAD = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";

export const DEMO_VIDEOS: Record<number, DemoVideo> = {
  1: { src: `${UPLOAD}2e360aff-6591-48c3-81e4-ea103c0abb7e.mp4`, avatar: "male" },
  2: { src: `${UPLOAD}e0d69d6f-6a73-47eb-afd1-75399f66343f.mp4`, avatar: "male" },
  3: { src: `${CLIP}hf_20261027_194210_ccf2d90e-7bef-48c2-a6b0-7a9951a352e1.mp4`, avatar: "male" },
  4: { src: `${CLIP}hf_20261026_223004_d874eb6a-3ce5-4e3e-9492-de99196da773.mp4`, avatar: "male" },
  5: { src: `${UPLOAD}dca3899c-4c56-4faf-8b12-353cce98a50c.mp4`, avatar: "male" },
  6: { src: `${UPLOAD}61dd0905-4f7a-47dc-8043-31ef3f956df9.mp4`, avatar: "male" },
  7: { src: `${CLIP}hf_20261027_192055_99bbbfcf-367c-49ee-b989-7ca176dbefbe.mp4`, avatar: "male" },
  8: { src: `${CLIP}hf_20261027_195200_b14629d3-d8bc-4f03-8cbe-c061c3c6ab40.mp4`, avatar: "female" },
  9: { src: `${CLIP}hf_20261027_195050_af42dc90-38e0-4394-95d0-e2680b014ea1.mp4`, avatar: "female" },
  10: { src: `${CLIP}hf_20261027_194212_9d0fed20-a209-47ec-9efe-e0672faa2382.mp4`, avatar: "male" },
  11: { src: `${CLIP}hf_20261027_192413_e1a8c687-ef22-4041-9335-239c9bdd1e45.mp4`, avatar: "male" },
  12: { src: `${CLIP}hf_20261027_194324_f87bc8e2-7a89-4d15-a5f2-89838804c571.mp4`, avatar: "male" },
  13: { src: `${CLIP}hf_20261027_194325_e03a48a2-8696-40cd-b937-5f2f6572ecbb.mp4`, avatar: "male" },
  14: { src: `${CLIP}hf_20261027_194506_01c37aaf-5010-400f-8eda-840231697df4.mp4`, avatar: "male" },
  15: { src: `${CLIP}hf_20261027_195048_1b5c827c-4507-4611-b40d-59b51293af03.mp4`, avatar: "male" },
  17: { src: `${CLIP}hf_20261026_201449_94282063-4842-4f1e-8444-f080461a67ac.mp4`, avatar: "male" },
  83: { src: `${CLIP}hf_20261026_201448_095616b7-9b37-42ad-8832-1c5e2f65aeb3.mp4`, avatar: "female" },
  89: { src: `${UPLOAD}fe3fd79a-8ae3-44c7-a335-2a22dace9d15.mp4`, avatar: "female" },
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
