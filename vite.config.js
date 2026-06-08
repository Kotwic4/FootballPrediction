import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Repo name is used as the base path on GitHub Pages
// (https://kotwic4.github.io/FootballPrediction/).
export default defineConfig({
  plugins: [react()],
  base: '/FootballPrediction/',
});
