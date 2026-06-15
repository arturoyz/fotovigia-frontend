import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js references `global` at runtime (not defined in the
  // browser under Vite) — alias it to globalThis so the login flow doesn't crash.
  define: {
    global: 'globalThis',
  },
})
