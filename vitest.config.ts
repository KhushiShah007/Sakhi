import { defineConfig } from 'vitest/config';
// Every test file boots its own embedded Postgres (WASM). Unbounded parallelism exhausts memory on small machines/CI runners.
export default defineConfig({ test: { include: ['server/test/**/*.test.ts'], environment: 'node', pool: 'forks', poolOptions: { forks: { maxForks: 3, minForks: 1 } }, testTimeout: 30_000 } });
