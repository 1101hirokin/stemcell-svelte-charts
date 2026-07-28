// 実物を触って確かめる場(WORKFLOW §2-6)。テストは vitest.config.ts が別に持つ。
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  root: 'playground',
  plugins: [svelte()],
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist' },
});
