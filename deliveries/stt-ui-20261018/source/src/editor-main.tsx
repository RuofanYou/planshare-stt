import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import Editor from './pages/Editor'
import './styles/tokens.css'
import './styles/stt-form-reset.css'
import './styles/global.css'

// This standalone entry keeps the actual Editor source and original CSS baselines.
// Routes, site chrome, query providers and decorative motion are outside this page.
createRoot(document.getElementById('root')!).render(
  <StrictMode><main className="stt-page-main"><Editor /></main></StrictMode>,
)
