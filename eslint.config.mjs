import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node  // add Node.js globals like process, __dirname
      }
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
      "quotes": ["error", "single"],
      "semi": ["error", "always"],
      "no-unused-vars": ["warn"], // change to warn if you want less strict
      "no-undef": "error"
    }
  }
]);
