// Banco de pruebas de Inicio (la app entera) con la API simulada por la prueba (`page.route`). Solo lo usa
// `e2e/home-touch.mjs`.
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { App } from '../src/App';

createRoot(document.getElementById('root')!).render(<App />);
