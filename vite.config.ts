import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Plugin } from 'vite';

// Plugin to replace environment variables in HTML
function htmlEnvPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html.replace(
        /%VITE_FACEBOOK_APP_ID%/g,
        env.VITE_FACEBOOK_APP_ID || ''
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const manualChunkGroups: Array<{ name: string; packages: string[] }> = [
    { name: 'react-vendor', packages: ['react', 'react-dom', 'react-router-dom'] },
    {
      name: 'ui-vendor',
      packages: [
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-tabs',
        '@radix-ui/react-select',
      ],
    },
    { name: 'chart-vendor', packages: ['recharts'] },
  ];

  return {
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          for (const group of manualChunkGroups) {
            if (group.packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`))) {
              return group.name;
            }
          }

          return undefined;
        },
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    htmlEnvPlugin(env),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  };
});