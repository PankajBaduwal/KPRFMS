import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed port so the FMS never shares an address with other local projects (e.g. one on 5173)
    port: 5180,
    strictPort: true,
    // Uploaded files are stored as relative "/uploads/..." URLs; forward them to the API server
    proxy: {
      '/uploads': 'http://localhost:5055',
    },
  },
})
