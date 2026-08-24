// Stub for next/link outside a Next.js app: renders a plain anchor.
// Claude Design has no Next router; a real <a> is the honest static equivalent.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string | { pathname?: string };
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch, replace, scroll, shallow, ...rest },
  ref,
) {
  const url = typeof href === "string" ? href : (href?.pathname ?? "#");
  return (
    <a ref={ref} href={url} {...rest}>
      {children}
    </a>
  );
});

export default Link;
