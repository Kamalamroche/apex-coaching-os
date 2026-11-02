import type { DemoVideo } from "../types";

/* Original HELIX demo clips (Higgsfield), keyed by exercise id. Male avatar by default;
   the female avatar performs yoga, mobility and women-focused movements. */
const CLIP = "https://d8j0ntlcm91z4.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";
/* Villa-terrace versions (same athletes and movements, graded uploads). */
const TERRACE = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DPpfwYNBnG9nrFE2TptrXXNck3/";

export const DEMO_VIDEOS: Record<number, DemoVideo> = {
  1: { src: `${TERRACE}ec394714-6854-48da-87fa-63c266e1d275.mp4`, avatar: "male" },
  2: { src: `${TERRACE}37b622a6-0fa8-40bb-82ac-042b177eb7bb.mp4`, avatar: "male" },
  3: { src: `${TERRACE}219a6f69-c5f7-4f80-8573-d23b04c906aa.mp4`, avatar: "male" },
  4: { src: `${TERRACE}e9e8dd56-6474-440d-9523-8e4f9749a70f.mp4`, avatar: "male" },
  5: { src: `${TERRACE}51bfe083-8a26-4dbb-b092-194b0d01df0c.mp4`, avatar: "male" },
  6: { src: `${TERRACE}fa556361-3e84-43cb-bb50-2c677df77679.mp4`, avatar: "male" },
  7: { src: `${TERRACE}8bd947eb-be2b-44cd-98dd-077f3a1ceee2.mp4`, avatar: "male" },
  8: { src: `${TERRACE}82b02f2e-b1c2-44a1-b709-52a3298eb608.mp4`, avatar: "female" },
  9: { src: `${TERRACE}faf3ea70-5fdf-4c03-b2c3-48e7441a3b55.mp4`, avatar: "female" },
  10: { src: `${TERRACE}318ba71f-807b-459d-997a-e1e84037d2bc.mp4`, avatar: "male" },
  11: { src: `${TERRACE}555efa77-5895-46d8-9aa8-7a6be17730dc.mp4`, avatar: "male" },
  12: { src: `${TERRACE}7b71d7b3-b003-4210-a7a4-001f41ea7aef.mp4`, avatar: "male" },
  13: { src: `${TERRACE}9d9e58a7-391c-4faa-87d6-3b3e32f5f549.mp4`, avatar: "male" },
  14: { src: `${TERRACE}71a82135-d907-4fb8-8eda-0eab8a492ca6.mp4`, avatar: "male" },
  15: { src: `${CLIP}hf_20261027_195048_1b5c827c-4507-4611-b40d-59b51293af03.mp4`, avatar: "male" },
  16: { src: `${CLIP}hf_20261028_153219_da08b4e4-6bd0-40fb-a381-628b8185dcf0.mp4`, avatar: "male" },
  17: { src: `${CLIP}hf_20261028_094553_277da6d3-5df2-4f17-bc1b-5e8009da7ba5.mp4`, avatar: "male" },
  18: { src: `${CLIP}hf_20261028_150532_c95179a2-acfc-41a9-89cb-b2ee4bf77aeb.mp4`, avatar: "male" },
  26: { src: `${CLIP}hf_20261028_153221_f93ca4a1-791f-4a76-a7af-cc410ef467b7.mp4`, avatar: "male" },
  27: { src: `${CLIP}hf_20261028_152832_00df2a76-c77f-4fb4-97dc-ca1b68b84adc.mp4`, avatar: "male" },
  28: { src: `${CLIP}hf_20261028_152518_b5e68bba-620c-4613-9ac8-ac05e7bb1aca.mp4`, avatar: "male" },
  36: { src: `${CLIP}hf_20261028_153038_3db68a88-fe2e-419b-94e8-f409bbfe8e8f.mp4`, avatar: "male" },
  37: { src: `${CLIP}hf_20261028_153040_931dedd4-aa73-4a39-abaa-f7cab2318d7d.mp4`, avatar: "male" },
  40: { src: `${CLIP}hf_20261028_150727_7e8216a0-4ede-43f1-838d-fd5fa4d80852.mp4`, avatar: "male" },
  73: { src: `${CLIP}hf_20261028_151036_17dc60b2-4918-46e8-8700-0fa012066703.mp4`, avatar: "male" },
  74: { src: `${CLIP}hf_20261028_152830_f6ebc4d9-20a8-450d-8f1b-782fd59c2281.mp4`, avatar: "male" },
  83: { src: `${CLIP}hf_20261028_094555_f10ebb81-2c75-419d-a4f3-0f390edb79de.mp4`, avatar: "female" },
  89: { src: `${CLIP}hf_20261028_095241_11ffd857-5f30-4416-8db8-786a47a0c7f4.mp4`, avatar: "female" },
  109: { src: `${CLIP}hf_20261028_095243_f09c9eb1-c7e8-4ca5-b3d1-3281bf9abd9d.mp4`, avatar: "female" },
  112: { src: `${CLIP}hf_20261027_210837_dbeecc93-8796-48cf-a201-a54541e6cd06.mp4`, avatar: "male" },
  120: { src: `${CLIP}hf_20261027_210951_25102aaf-a46e-4665-8da7-4cb539814cc5.mp4`, avatar: "male" },
  132: { src: `${CLIP}hf_20261027_210952_44091dc1-34b9-49b1-aa01-0cad70e4729d.mp4`, avatar: "male" },
  140: { src: `${CLIP}hf_20261028_154148_49127841-83d9-4c34-b03f-d0318ee76313.mp4`, avatar: "male" },
  304: { src: `${CLIP}hf_20261028_102554_86448167-8596-4890-a343-b8109c72cb7e.mp4`, avatar: "female" },
  534: { src: `${CLIP}hf_20261028_102556_550a3cca-3449-4ffa-b1d2-246db9ad3a37.mp4`, avatar: "female" },
  536: { src: `${CLIP}hf_20261028_103239_1a181830-34ff-4b93-86c2-8f20f4bb1e6d.mp4`, avatar: "female" },
  623: { src: `${CLIP}hf_20261028_103241_c366536e-f66b-42d6-87ae-c0fb2878e33a.mp4`, avatar: "male" },
  624: { src: `${CLIP}hf_20261028_104244_da357f79-5f54-42d7-8e1e-6c30294b0381.mp4`, avatar: "male" },
};
