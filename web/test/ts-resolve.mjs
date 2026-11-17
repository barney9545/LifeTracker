/**
 * Lets `node --test` load the app's TypeScript directly (Node strips types
 * natively) by resolving extensionless relative imports like "./logic" to
 * "./logic.ts". Zero dependencies — test-only, never used by Next.
 * Also stubs `server-only` (Next provides it at build time; it's a no-op marker).
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
