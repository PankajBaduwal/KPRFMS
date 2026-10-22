import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Uploaded files are stored as relative "/uploads/..." URLs; forward them to the API server
    proxy: {
      '/uploads': 'http://localhost:5000',
    },
  },
})
