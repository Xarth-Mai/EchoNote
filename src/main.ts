import App from './App.svelte';
import './styles.css';

const target = document.getElementById('app');

if (!target) {
  throw new Error('无法找到应用挂载节点 #app');
}

const app = new App({
  target,
});

export default app;
