// Stub for next/navigation outside a Next.js app — inert router facade.
const noop = (): void => undefined;

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    back: noop,
    forward: noop,
    refresh: noop,
    prefetch: noop,
  };
}

export function usePathname(): string {
  return "/";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}

export function redirect(url: string): never {
  throw new Error(`redirect(${url}) called outside Next.js`);
}

export function notFound(): never {
  throw new Error("notFound() called outside Next.js");
}
