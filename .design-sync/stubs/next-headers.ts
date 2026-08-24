// Stub for next/headers outside a Next.js app — throws at call time only.
export function cookies(): never {
  throw new Error("cookies() is server-only and unavailable in the design bundle");
}

export function headers(): never {
  throw new Error("headers() is server-only and unavailable in the design bundle");
}
