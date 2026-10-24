import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Production never imports a developer's frontend .env into public assets.
  envDir: mode === 'production' ? false : undefined,
}))
