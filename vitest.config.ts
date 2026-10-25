import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["src/controllers/**/*.ts", "src/middlewares/**/*.ts", "src/services/**/*.ts", "src/utils/**/*.ts"],
            reporter: ["text", "json-summary", "lcov"],
            thresholds: { lines: 75, statements: 75, functions: 70, branches: 65 },
        },
    },
});
