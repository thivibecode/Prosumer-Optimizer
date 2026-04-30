import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 'base' wichtig fuer GitHub Pages: muss '/REPO_NAME/' sein
// Wenn das Repo z.B. "pv-tool" heisst, dann base: '/pv-tool/'
// Bei einem User-Pages-Repo (USER.github.io) dagegen base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/Prosumer-Optimizer/'
})
