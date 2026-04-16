/**
 * Warm Editorial brand tokens — spec 019 lobby-visual-foundation.
 *
 * Mirror of the Tailwind `theme.extend.colors.{brand,surface,text,accent}`
 * scales in /Users/ari/git/wottle/tailwind.config.ts. Use these accessors
 * from TS when an inline style or canvas context needs a raw hex value
 * (e.g., generated avatar gradients). Prefer Tailwind utility classes
 * in all other cases.
 */

export const brandHex = {
  50: "#FBF3E0",
  100: "#F5E4B8",
  200: "#F0D48A",
  300: "#ECC261",
  400: "#E8B64C",
  500: "#D9A130",
  600: "#B8821F",
  700: "#96671A",
  800: "#6F4B12",
  900: "#4A320C",
  950: "#2D1E07",
} as const;

export const surfaceHex = {
  0: "#0B1220",
  1: "#141C2E",
  2: "#1C2640",
  3: "#253156",
} as const;

export const textHex = {
  primary: "#F2EAD3",
  secondary: "#C7BDA3",
  muted: "#8A8470",
  inverse: "#0B1220",
} as const;

export const accentHex = {
  focus: "#E8B64C",
  warning: "#F59E0B",
  success: "#10B981",
} as const;

export type BrandShade = keyof typeof brandHex;
export type SurfaceShade = keyof typeof surfaceHex;
export type TextShade = keyof typeof textHex;
export type AccentShade = keyof typeof accentHex;
