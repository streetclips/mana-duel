import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { PROXY_PATH, openRouterProxyPlugin } from './scripts/openrouterProxy.ts';

export default defineConfig(({ mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), ['OPENROUTER_', 'LLM_']);
  const proxyKey = mode === 'development' && !isPreview ? env.OPENROUTER_API_KEY : undefined;
  return {
    base: './',
    oxc: {
      jsx: {
        runtime: 'automatic',
        importSource: 'preact',
      },
    },
    plugins: proxyKey ? [openRouterProxyPlugin(proxyKey)] : [],
    define: proxyKey ? { 'import.meta.env.VITE_OPENROUTER_PROXY': JSON.stringify(PROXY_PATH) } : {},
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      port: 4173,
    },
    test: {
      include: ['tests/**/*.test.{ts,tsx}'],
      environment: 'node',
      env,
    },
  };
});
