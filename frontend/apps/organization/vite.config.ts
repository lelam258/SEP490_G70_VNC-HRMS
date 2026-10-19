import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'; import federation from '@originjs/vite-plugin-federation';
export default defineConfig({plugins:[react(),federation({name:'organization',filename:'remoteEntry.js',exposes:{'./App':'./src/App.tsx'},shared:['react','react-dom']})],server:{port:5176,strictPort:true},build:{target:'esnext'}});
