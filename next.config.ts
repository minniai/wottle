import type { NextConfig } from "next";

import { BOARD_SIZE } from "./lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "./lib/constants/game-config";

// Deny-by-default list of Permissions-Policy features we do not use. Browsers
// that ship newer feature names will ignore the unknown entries. Keeping them
// explicit rather than `*` makes future opt-ins visible in code review.
const DENIED_PERMISSIONS = [
  "accelerometer",
  "autoplay",
  "camera",
  "clipboard-read",
  "cross-origin-isolated",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "keyboard-map",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "sync-xhr",
  "usb",
  "xr-spatial-tracking",
];

const PERMISSIONS_POLICY = DENIED_PERMISSIONS.map((name) => `${name}=()`).join(", ");

const COMMON_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];

// HSTS is only emitted in production to avoid pinning HTTPS on localhost dev.
const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};

const nextConfig: NextConfig = {
  devIndicators: false,
  // The dictionary reads its files through an untraced path, so ship exactly
  // the board wordlists it loads and the exclusions, never the full source
  // lists they are built from (55MB for Icelandic).
  outputFileTracingIncludes: {
    "/**": [
      `data/wordlists/word_list_${DEFAULT_GAME_CONFIG.minimumWordLength}_${BOARD_SIZE}_*.txt`,
      "data/wordlists/word_list_*_exclusions.txt",
    ],
  },
  // Spec 070 FR-001: the door and the lobby are one URL per locale. The queue's
  // own page joins them once the search runs in the line slot (T092).
  async redirects() {
    return [
      { source: "/lobby", destination: "/", permanent: true },
      { source: "/en/lobby", destination: "/en", permanent: true },
    ];
  },
  async headers() {
    const headers = [...COMMON_SECURITY_HEADERS];
    if (process.env.NODE_ENV === "production") {
      headers.push(HSTS_HEADER);
    }
    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;
