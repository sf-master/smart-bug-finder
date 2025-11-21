import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        // Use VITE_PROXY_TARGET for dev proxy, fallback to default localhost
        target: process.env.VITE_PROXY_TARGET || process.env.VITE_API_BASE_URL || "http://localhost:5050",
        changeOrigin: true,
        secure: false
      }
    }
  }
});


