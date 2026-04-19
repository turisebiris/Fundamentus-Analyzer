import './ui/styles/main.css';
import { createApp } from './ui/app.js';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Elemento raiz #app não encontrado em index.html.');
}
createApp(root);
