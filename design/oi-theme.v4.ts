/**
 * Oimpresso Mobile design tokens — RN port (v4 · DS Office Impresso).
 *
 * v4 (Onda 1): fonte da verdade passa a ser o DS (.cockpit em colors_and_type.css).
 * OKLCH → sRGB hex convertido pela página "Mobile DS Proposta" (mesma fórmula OKLab).
 * Não editar à mão — regenerar a partir do DS.
 *
 * Mudou: neutros, accent (roxo 295), ok/warn/danger, fontes (IBM Plex).
 * Não mudou: brand (logo CMYK), action (verde), info, origin, radius, rowHeight, shadows.
 */

export type OiThemeName = "light" | "dark";
export type OiDensity = "compact" | "normal" | "comfy";

export type OiOriginKey = "OS" | "CRM" | "FIN" | "PNT" | "MFG" | "OFI";

export type OiBrand = {
  magenta: string;
  purple: string;
  deep: string;
  cyan: string;
  yellow: string;
};

export type OiPalette = {
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  border: string;
  border2: string;
  text: string;
  textDim: string;
  textMute: string;
  /** Ação primária (roxo). */
  accent: string;
  accent2: string;
  accentSoft: string;
  accentFg: string;
  /** Texto/realce em accent — escuro no claro, claro no escuro (contraste AA). */
  accentText: string;
  /** Ação/consulta = verde. */
  action: string;
  action2: string;
  actionSoft: string;
  actionFg: string;
  info: string;
  danger: string;
  warn: string;
  ok: string;
  brand: OiBrand;
  origin: Record<OiOriginKey, { bg: string; fg: string }>;
};

export const brand: OiBrand = {
  magenta: "#c12682",
  purple: "#5b2987",
  deep: "#391153",
  cyan: "#34dde5",
  yellow: "#fce765",
};

export const lightPalette: OiPalette = {
  bg: "#fbfaf8", // --bg
  bg2: "#f4f3f0", // --bg-2
  surface: "#ffffff", // --surface
  surface2: "#f7f7f4",
  border: "#dfdedb", // --border
  border2: "#e9e8e5", // --border-2
  text: "#1d1a15", // --text
  textDim: "#66635d", // --text-dim
  textMute: "#928f88", // --text-mute
  accent: "#795bbf", // --accent
  accent2: "#8e71d6", // --accent-2
  accentSoft: "#f0eaff", // --accent-soft
  accentFg: "#ffffff",
  accentText: "#795bbf",
  action: "#2c894e",
  action2: "#12773d",
  actionSoft: "#d3f5db",
  actionFg: "#ffffff",
  info: "#2ea7ff",
  danger: "#c53637", // --neg
  warn: "#a76c12", // --warn
  ok: "#21763c", // --pos
  brand,
  origin: {
    OS: { bg: "#fbe8ce", fg: "#754f27" },
    CRM: { bg: "#d6f0ff", fg: "#2c5e7a" },
    FIN: { bg: "#d9f3dd", fg: "#315e3c" },
    PNT: { bg: "#efe6ff", fg: "#5e4e7c" },
    MFG: { bg: "#fee5dc", fg: "#7c4937" },
    OFI: { bg: "#d5f0fe", fg: "#28577c" },
  },
};

export const darkPalette: OiPalette = {
  bg: "#212427",
  bg2: "#1a1d1f",
  surface: "#2a2e31",
  surface2: "#323639",
  border: "#34393c",
  border2: "#2d3134",
  text: "#ecebe7",
  textDim: "#a6a4a1",
  textMute: "#7b7a77",
  accent: "#795bbf",
  accent2: "#8e71d6",
  accentSoft: "#3a2a5e",
  accentFg: "#ffffff",
  accentText: "#8e71d6",
  action: "#22c55e",
  action2: "#34d36a",
  actionSoft: "#143324",
  actionFg: "#08110b",
  info: "#2ea7ff",
  danger: "#ff716b",
  warn: "#ffb330",
  ok: "#44d070",
  brand: {
    magenta: "#c85bff",
    purple: "#9a2bcb",
    deep: "#7a0b7e",
    cyan: "#34dde5",
    yellow: "#f5e05d",
  },
  origin: {
    OS: { bg: "#4b341d", fg: "#e4c4a1" },
    CRM: { bg: "#1e3d4f", fg: "#a9d1ea" },
    FIN: { bg: "#26402c", fg: "#b0d6b6" },
    PNT: { bg: "#3d334f", fg: "#d0c2ed" },
    MFG: { bg: "#4c3229", fg: "#eebeae" },
    OFI: { bg: "#203d50", fg: "#a1d1f4" },
  },
};

export const radius = { sm: 7, md: 10, lg: 14, pill: 999 } as const;

export const rowHeight: Record<OiDensity, number> = {
  compact: 46,
  normal: 56,
  comfy: 62,
};

/** Alvos de toque (DS mobile): nunca abaixo de 44. sm = 36 visível + hitSlop 4. */
export const touch = { lg: 48, default: 44, sm: 36, hitSlop: 4 } as const;

export const shadows = {
  pop: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;

/** Avatar gradient pairs (`oi-av-1` … `oi-av-6`). */
export const avatarGradients: readonly [string, string][] = [
  ["#c4685a", "#a6344f"],
  ["#0096b8", "#2a5fb7"],
  ["#549957", "#007d5e"],
  ["#ac7d1b", "#a34100"],
  ["#9274c3", "#435ab8"],
  ["#009d89", "#007a85"],
];

/**
 * Fontes — IBM Plex Sans + IBM Plex Mono (DS). Carregadas em app/_layout.tsx.
 * sansExtrabold mantido como alias de Bold (Plex não tem 800 no DS).
 */
export const fonts = {
  sans: "IBMPlexSans_400Regular",
  sansMedium: "IBMPlexSans_500Medium",
  sansSemibold: "IBMPlexSans_600SemiBold",
  sansBold: "IBMPlexSans_700Bold",
  sansExtrabold: "IBMPlexSans_700Bold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
  monoSemibold: "IBMPlexMono_600SemiBold",
} as const;

export function getPalette(theme: OiThemeName): OiPalette {
  return theme === "dark" ? darkPalette : lightPalette;
}

export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
