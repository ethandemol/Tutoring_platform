import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: parseInt(process.env.PORT || '8080'),
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
      },
    } : undefined,
  },
  preview: {
    host: "::",
    port: parseInt(process.env.PORT || '8080'),
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'sparqit-new-production.up.railway.app',
      'ample-rejoicing-production-d879.up.railway.app',
      '.railway.app'
    ],
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
