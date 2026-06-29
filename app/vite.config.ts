import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project Pages are served from /<repo>/. Override with BASE_PATH if the
// repo is renamed or served from a custom domain (set BASE_PATH=/ for root).
const base = process.env.BASE_PATH ?? '/SEG-SCHEDULE/'

export default defineConfig({
  base,
  plugins: [react()],
})
