import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@lib/eslint-config/base";
import { createStrictSyntax } from "@lib/eslint-config/syntax";

export default defineConfig(
  baseConfig,
  strictConfig,
  createStrictSyntax({ ts: true }),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
      complexity: "off",
      "no-restricted-syntax": "off",
    },
  },
);
