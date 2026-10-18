import type { Author } from '../data/types'
import { GlassCard, Tag } from './ui'
import CopyButton from './CopyButton'
import './GuildCard.css'

interface GuildCardProps {
  author: Author
}

/**
 * 公会引流卡：仅在作者主页出现（绝不在板子详情页）。
 * 外壳复用 GlassCard 的 glass-strong 玻璃 chrome；公会专有的左侧金竖条 / 暖金淡辉 / 古金边角由本组件 CSS 点缀。
 * 含 公会名 + 招募说明 + 联系方式（可复制）。
 * 作者未填公会信息（无 guildName）时整卡不渲染。
 */
export default function GuildCard({ author }: GuildCardProps) {
  if (!author.guildName) return null

  return (
    <GlassCard as="section" tone="glass-strong" className="ps-guild">
      {/* 公会专有装饰层：暖金淡辉 + 古金边角（aria-hidden，纯氛围，避免占用玻璃原语的 ::before 高光） */}
      <span className="ps-guild__deco" aria-hidden="true" />
      <Tag variant="gold" className="ps-guild__tag">
        用于公会招募
      </Tag>
      <h3 className="ps-guild__name">{author.guildName}</h3>

      {author.guildRecruit && (
        <p className="ps-guild__recruit">{author.guildRecruit}</p>
      )}

      {author.guildContact && (
        <div className="ps-guild__contact">
          <div className="ps-guild__contact-text">
            <span className="ps-guild__contact-label">联系方式</span>
            <span className="ps-guild__contact-value">{author.guildContact}</span>
          </div>
          <CopyButton
            text={author.guildContact}
            variant="primary"
            label="复制联系方式"
          />
        </div>
      )}
    </GlassCard>
  )
}
