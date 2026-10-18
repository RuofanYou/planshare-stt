import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/tokens.css'
import './styles/tailwind.css'
import './styles/global.css'

// 数据多为相对静态的战术内容：staleTime 给 5 分钟，减少无谓重拉；
// 失效仍由 hooks 的 mutation onSuccess 主动触发（点赞 / 新建）。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
