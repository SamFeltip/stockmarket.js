import js from "@eslint/js";
import css from "@eslint/css";

import stylistic from "@stylistic/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";
import globals from "globals";

const jsFiles = ["**/*.{js,mjs,cjs}"];
const tsFiles = ["**/*.{ts,tsx,mts,cts}"];
const scriptFiles = ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"];

const scopeConfigs = (configs, files) =>
    (Array.isArray(configs) ? configs : [configs]).map((config) => ({
        ...config,
        files,
    }));

const typeChecked = tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsFiles,
}));

const stylisticTypeScript = tseslint.configs.stylistic.map((config) => ({
    ...config,
    files: tsFiles,
}));

// Blank lines around statement groups. Later rules win for overlapping pairs,
// so the "any" relaxations come after the "always" requirements.
const statementPadding = [
    { blankLine: "always", prev: "*", next: ["return", "throw"] },

    // Variables
    { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
    { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },

    // Blank line before block-like statements
    { blankLine: "always", prev: "*", next: "block-like" },

    // Blank line after block-like statements
    { blankLine: "always", prev: "block-like", next: "*" },

    // No required blank line between a variable and if/for/function
    { blankLine: "never", prev: ["const", "let", "var"], next: ["if", "for"] },
    { blankLine: "always", prev: ["const", "let", "var"], next: ["function"] },

    // Imports / exports
    { blankLine: "always", prev: ["import", "export"], next: "*" },
    { blankLine: "any", prev: ["import", "export"], next: ["import", "export"] },

    { blankLine: "always", prev: ["function", "export"], next: ["function", "export"] },

    { blankLine: "any", prev: ["case", "default"], next: "*" },
];

export default [
    {
        ignores: [
            "node_modules/",
            "dist/",
            "dist-large/",
            ".astro/",
            ".generated/",
            ".wrangler/",
            "worker-configuration.d.ts",
            "convex/_generated/**",
            "convex/catalog.ts",
            "public/static/**",
            ".opencode-tmp/",
        ],
        name: "global/ignores",
    },

    /*
    ---------------- CSS ----------------
    */
    {
        files: ["**/*.css"],
        plugins: {
            css,
        },
        language: "css/css",
        rules: {
            ...css.configs.recommended.rules,
            "css/use-baseline": "off",
            "css/no-important": "off",
        },
    },

    /*
    ---------------- JavaScript ----------------
    */
    ...scopeConfigs(js.configs.recommended, jsFiles),

    {
        files: jsFiles,
        name: "js/node-scripts",
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-undef": "error",
            curly: ["error", "all"],
        },
    },

    /*
    ---------------- Unicorn ----------------
    */
    ...scopeConfigs(unicorn.configs["flat/recommended"], scriptFiles),

    {
        files: scriptFiles,
        name: "unicorn/overrides",
        rules: {
            "unicorn/consistent-boolean-name": "off",
            "unicorn/consistent-function-scoping": "off",
            "unicorn/max-nested-calls": "off",
            "unicorn/no-await-expression-member": "off",
            "unicorn/no-null": "off",
            "unicorn/no-top-level-assignment-in-function": "off",
            "unicorn/no-useless-undefined": "off",
            "unicorn/prefer-array-index-of": "off",
            "unicorn/prefer-await": "off",
            "unicorn/prefer-includes-over-repeated-comparisons": "off",
            "unicorn/prefer-observer-apis": "off",
            "unicorn/prefer-simple-condition-first": "off",
            "unicorn/prefer-spread": "off",
        },
    },

    {
        files: ["**/*.test.mjs"],
        name: "tests/overrides",
        rules: {
            "unicorn/no-global-object-property-assignment": "off",
            "unicorn/no-this-outside-of-class": "off",
        },
    },

    /*
    ---------------- TypeScript ----------------
    */
    ...scopeConfigs(tseslint.configs.recommended, tsFiles),
    ...typeChecked,
    ...stylisticTypeScript,

    {
        files: tsFiles,
        name: "ts/overrides",
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            curly: ["error", "all"],
            "@typescript-eslint/array-type": [
                "error",
                {
                    default: "array",
                },
            ],
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                {
                    assertionStyle: "as",
                    objectLiteralTypeAssertions: "never",
                },
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },

    {
        files: ["**/*.d.ts"],
        name: "ts/declaration-overrides",
        rules: {
            curly: ["error", "all"],

            // `env.d.ts` is the Astro-recommended convention.
            "unicorn/filename-case": "off",
            "unicorn/name-replacements": "off",
            "unicorn/no-for-each": "off",
        },
    },

    /*
    ---------------- @stylistic (formatting) ----------------
    */
    ...scopeConfigs(stylistic.configs.recommended, scriptFiles),

    {
        files: scriptFiles,
        name: "stylistic/overrides",
        rules: {
            "@stylistic/max-statements-per-line": ["error", { max: 1 }],
            "@stylistic/indent": ["error", 4],
            "@stylistic/jsx-indent-props": ["error", 4],
            "@stylistic/quotes": ["error", "double"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/arrow-parens": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/brace-style": [
                "error",
                "allman",
                {
                    allowSingleLine: false,
                },
            ],
            "@stylistic/quote-props": ["error", "as-needed"],
            "@stylistic/max-len": [
                "error",
                {
                    code: 120,
                    tabWidth: 4,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreComments: true,
                    ignoreTrailingComments: true,
                    ignoreRegExpLiterals: true,
                },
            ],
            "@stylistic/multiline-ternary": "off",
            "@stylistic/space-before-function-paren": [
                "error",
                {
                    anonymous: "never",
                    named: "never",
                    asyncArrow: "always",
                },
            ],

            // Prevents conflicting reports with
            // @typescript-eslint/member-delimiter-style.
            "@stylistic/member-delimiter-style": "off",
        },
    },

    /*
    ---------------- Padding (statements) ----------------
    */
    {
        files: scriptFiles,
        name: "layout/padding",
        rules: {
            "@stylistic/padding-line-between-statements": [
                "error",
                ...statementPadding,
            ],
        },
    },

    {
        files: ["src/**/*.tsx"],
        plugins: { "react-hooks": hooks, "jsx-a11y": a11y },
        rules: {
            ...a11y.configs.recommended.rules,
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "error",
            // React component filenames use PascalCase, as Astro components did in the original config.
            "unicorn/filename-case": "off",
        },
    },
    {
        files: ["convex/**/*.ts"],
        rules: {
            // Convex module names are part of its public function API.
            "unicorn/filename-case": "off",
        },
    },
    /*
    ---------------- Final overrides ----------------
    */
    {
        files: scriptFiles,
        ignores: ["*config*"],

        name: "final/overrides",
        rules: {
            curly: ["error", "all"],
            "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
            "no-restricted-syntax": [
                "error",
                {
                    selector: "CallExpression > ConditionalExpression.callee",
                    message: "Don't call the result of a conditional expression.",
                },
                {
                    selector: "CallExpression > CallExpression.callee",
                    message: "Don't call the result of a function call.",
                },
            ],
        },
    },
];
