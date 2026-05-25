import type { ComponentType, ReactNode } from "react";

type Provider = ComponentType<{ children: ReactNode }>;

/**
 * Compose multiple context providers into a flat composition.
 * Providers are applied left-to-right: composeProviders(A, B, C) => A(B(C(children)))
 */
export function composeProviders(...providers: Provider[]) {
  return function ComposedProviders({ children }: { children: ReactNode }) {
    return providers.reduceRight(
      (tree, Provider) => <Provider>{tree}</Provider>,
      children
    );
  };
}
