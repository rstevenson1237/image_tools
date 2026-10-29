import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { BUNDLED } from './core/bundle';
import { project } from './core/project/store.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app mount point');

if (BUNDLED) void project.openServer();

export default mount(App, { target });
