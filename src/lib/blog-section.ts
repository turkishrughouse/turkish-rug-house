// The article hero crops each photograph into a wide banner, so the crop anchor is
// set per article rather than defaulting everything to dead centre. Values were
// chosen by looking at each image: most hero shots are all-over pile or flatweave
// texture that reads well from the middle, while a few sit their medallion slightly
// high or low in the frame. A plain lookup keeps this free of any per-request query.
const DEFAULT_HERO_FOCAL = "center 50%"

const HERO_FOCAL: Record<string, string> = {
  "how-to-choose-rug-size": "center 55%",
  "rugs-open-living-spaces": "center 45%",
  "colorful-rugs-interior-design": "center 45%",
  "what-is-vegetable-dye": "center 55%",
  "what-makes-anatolian-rugs-unique": "center 42%",
}

export function getBlogHeroFocal(slug: string) {
  return HERO_FOCAL[slug] || DEFAULT_HERO_FOCAL
}
