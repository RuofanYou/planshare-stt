import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import EmberBackground from './components/EmberBackground'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Category from './pages/Category'
import BoardDetail from './pages/BoardDetail'
import Author from './pages/Author'
import Admin from './pages/Admin'
import Submit from './pages/Submit'
import Creator from './pages/Creator'
import CreatorActivate from './pages/CreatorActivate'
import { pageTransition } from './lib/motion'

/**
 * 全局布局 + 路由。
 * 通用骨架：固定 three 余烬奥术背景 + 顶部 Header + 主内容区 + 极简 Footer。
 * 路由切换走 AnimatePresence 过场（initial/animate/exit，ease-epic）。
 * 路由：/ -> Home；/raid/:raidId -> Category；
 *       /board/:boardId -> BoardDetail；/author/:authorId -> Author；
 *       /submit -> Submit；/creator -> Creator；/admin -> Admin（后台人工上稿入口）。
 */
export default function App() {
  const location = useLocation()
  return (
    <>
      {/* 固定全屏余烬奥术暗场，纯氛围、不可交互、沉在内容之下 */}
      <EmberBackground />
      <Header />
      <main className="ps-main">
        {/* mode="wait" 让旧页面先淡出再淡入新页面；key 用 pathname 触发过场 */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/raid/:raidId" element={<Category />} />
              <Route path="/board/:boardId" element={<BoardDetail />} />
              <Route path="/author/:authorId" element={<Author />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/creator" element={<Creator />} />
              <Route path="/creator/activate" element={<CreatorActivate mode="activate" />} />
              <Route path="/creator/reset-password" element={<CreatorActivate mode="reset" />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  )
}
