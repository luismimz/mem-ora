// Banco de pruebas de «Tu base de datos» (sin servidor). Solo lo usa e2e/sql-console-touch.mjs.
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { SqlConsole } from '../src/SqlConsole';
createRoot(document.getElementById('root')!).render(<SqlConsole onExit={() => undefined} />);
