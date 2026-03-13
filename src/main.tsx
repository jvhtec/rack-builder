import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { HapticsProvider } from './lib/haptics.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HapticsProvider>
      <App />
    </HapticsProvider>
  </StrictMode>,
)
