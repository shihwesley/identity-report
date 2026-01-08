import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundled output (MCP server)
    "dist/**",
    // Test files (covered by Vitest, not production code)
    "tests/**",
    // Smart contracts (separate linting)
    "contracts/**",
  ]),
  // Rule overrides for common patterns
  {
    rules: {
      // Allow any in specific cases (use sparingly)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unescaped entities in JSX (common in text content)
      "react/no-unescaped-entities": "warn",
      // Prefer @ts-expect-error but don't fail on @ts-ignore
      "@typescript-eslint/ban-ts-comment": "warn",
      // React 19 compiler rules - downgrade to warnings for now
      "react-hooks/set-state-in-effect": "warn",
      // Allow require() for dynamic imports (e.g., optional config files)
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
]);

export default eslintConfig;
