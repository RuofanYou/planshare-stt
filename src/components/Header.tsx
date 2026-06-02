import { NavLink, Link, useLocation } from 'react-router-dom'
import { useRaids } from '../api/hooks'
import './Header.css'

/**
 * 顶部站点导航。
 * 左 wordmark（点击回首页），右侧导航链接。底部一条 line 分隔。
 * 当前页链接 accent 下划线常驻。
 */
export default function Header() {
  // 「按团本浏览」动态指向第一个真实团本（来自后端），不再硬编码 id，
  // 杜绝团本 id 变化后留下死链；数据未就绪时退回首页，绝不指向不存在的团本。
  const { data: raids } = useRaids()
  const { pathname } = useLocation()
  const browseTo =
    raids && raids.length > 0 ? `/raid/${raids[0].id}` : '/'
  const browseActive = pathname.startsWith('/raid/')

  return (
    <header className="ps-header">
      <div className="container ps-header__inner">
        {/* wordmark：金色渐变，回首页 */}
        <Link to="/" className="ps-header__brand" aria-label="找板子首页">
          <span className="text-gold-grad">找板子</span>
        </Link>

        {/* 主导航 */}
        <nav className="ps-header__nav" aria-label="主导航">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'ps-header__link is-active' : 'ps-header__link'
            }
          >
            首页
          </NavLink>
          {/* 用普通 Link + 手动判活：任意 /raid/* 路径下都高亮 */}
          <Link
            to={browseTo}
            className={browseActive ? 'ps-header__link is-active' : 'ps-header__link'}
          >
            按团本浏览
          </Link>
        </nav>
      </div>
    </header>
  )
}
