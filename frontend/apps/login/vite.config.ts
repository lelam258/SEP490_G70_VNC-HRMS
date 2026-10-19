import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'; import federation from '@originjs/vite-plugin-federation';
export default defineConfig({plugins:[react(),federation({name:'login',filename:'remoteEntry.js',exposes:{'./App':'./src/App.tsx'},shared:['react','react-dom']})],server:{port:5174,strictPort:true},build:{target:'esnext'}});
