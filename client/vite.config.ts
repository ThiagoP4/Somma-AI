import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const BUILD_ID = new Date().toISOString();

const emitVersionJson = () => ({
  name: 'emit-version-json',
  writeBundle(options: { dir?: string }) {
    const outDir = options.dir || path.resolve(__dirname, 'dist');
    const versionPayload = {
      version: pkg.version || '2.0.0',
      buildId: BUILD_ID
    };
    fs.writeFileSync(
      path.join(outDir, 'version.json'),
      JSON.stringify(versionPayload, null, 2),
      'utf-8'
    );
  }
});

export default defineConfig({
  plugins: [vue(), emitVersionJson()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '2.0.0'),
    __BUILD_ID__: JSON.stringify(BUILD_ID)
  }
});
