import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resolveSupabaseConfigFromEnv } from './projectShare/supabaseConfig'
import { createSupabaseShareStore } from './projectShare/supabaseShareStore'

// Resolve Supabase config once at the boundary; build the real share store only
// when configured. App stays env-free (config injected here).
const supabaseConfig = resolveSupabaseConfigFromEnv()
const shareStore = supabaseConfig ? createSupabaseShareStore(supabaseConfig) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App shareStore={shareStore} />
  </StrictMode>,
)
