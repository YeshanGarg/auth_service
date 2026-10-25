import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["node_modules/**", "dist/**", "coverage/**", "src/generated/**"] },
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
    { files: ["src/types/**/*.d.ts"], rules: { "@typescript-eslint/no-namespace": "off" } },
);