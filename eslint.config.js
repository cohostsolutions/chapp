import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "supabase/functions", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off", // Too noisy - trust developers
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off", // Allow any types for flexibility
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-ignore/@ts-expect-error
      "prefer-const": "off", // Allow let for mutable variables
      "no-constant-condition": "off", // Allow while(true) patterns
      "no-case-declarations": "off", // Allow declarations in switch cases
    },
  },
);
