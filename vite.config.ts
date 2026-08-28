import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Hosts this *development* server answers to, beyond localhost. Only for
      // reaching a local dev server through a proxy or tunnel; set DEV_ALLOWED_HOSTS
      // to the tunnel hostname, comma separated.
      //
      // The production domain does not belong here. Vite's host check is what
      // stops a dev server from serving raw sources and arbitrary files to the
      // internet, so allowlisting a public host would turn a deployment mistake
      // into a source-code disclosure. Production serves the built assets from
      // Express and never starts this server at all (see server.ts).
      allowedHosts: (process.env.DEV_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
    },
  };
});
