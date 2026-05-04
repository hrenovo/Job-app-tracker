import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'


export default defineConfig(async () => {
  return {
    plugins: [      tailwindcss(),
      TanStackRouterVite(),
      react(),
    ].filter(Boolean) as Plugin[],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'recharts',
        'react-is',
        '@radix-ui/react-dialog',
        '@radix-ui/react-select',
        '@radix-ui/react-tabs',
        '@radix-ui/react-popover',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-separator',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-switch',
      ],
    },
    server: {
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.DJANGO_PORT || '8000'}`,
          changeOrigin: true,
        },
        '/admin': {
          target: `http://localhost:${process.env.DJANGO_PORT || '8000'}`,
          changeOrigin: true,
        },
        '/accounts': {
          target: `http://localhost:${process.env.DJANGO_PORT || '8000'}`,
          changeOrigin: true,
        },
        '/static': {
          target: `http://localhost:${process.env.DJANGO_PORT || '8000'}`,
          changeOrigin: true,
        },
      },
      hmr: true,
    },
  }
})
