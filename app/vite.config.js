import { defineConfig } from 'vite';

// base './' -> relative asset paths, so the built app works when served
// from /app/ on calobit.vercel.app (next to the landing page at /).
export default defineConfig({
  base: './',
});
