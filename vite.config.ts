import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'PAGES_');
  return {
    plugins: [react()],
    base: env.PAGES_BASE_PATH || '/',
  };
});
