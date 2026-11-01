// Site-wide news card image ratio, chosen by admins in Dashboard → Site settings.
export const RATIO_OPTIONS = ["4:3", "16:9", "3:2", "1:1"] as const;
export type ImageRatio = (typeof RATIO_OPTIONS)[number];
export const DEFAULT_RATIO: ImageRatio = "4:3";

export const RATIO_CSS: Record<ImageRatio, string> = {
  "4:3": "4 / 3",
  "16:9": "16 / 9",
  "3:2": "3 / 2",
  "1:1": "1 / 1",
};

export const RATIO_LABEL: Record<ImageRatio, string> = {
  "4:3": "Tall (4:3)",
  "16:9": "Wide (16:9)",
  "3:2": "Classic (3:2)",
  "1:1": "Square (1:1)",
};

/** CSS aspect-ratio value for a stored setting, falling back to the default. */
export function ratioCss(value: string | null | undefined): string {
  const key = (value ?? DEFAULT_RATIO) as ImageRatio;
  return RATIO_CSS[key] ?? RATIO_CSS[DEFAULT_RATIO];
}
