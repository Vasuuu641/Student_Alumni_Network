import { createRoot } from 'react-dom/client'
import App from './App'

declare const __BUILD__: string
;(window as any).__BUILD__ = __BUILD__

createRoot(document.getElementById('root')!).render(<App />)