import './Footer.css'

/**
 * 极简页脚：站点名 + 一行说明 + 免责声明。
 * 免责声明为硬性要求：平台仅展示，不参与招募/交易/收费。
 */
export default function Footer() {
  return (
    <footer className="ps-footer">
      <div className="container ps-footer__inner">
        <p className="ps-footer__brand">找板子 · STT 战术板分享</p>
        <p className="ps-footer__disclaimer">
          平台仅提供展示，不参与任何公会招募、交易或收费，相关纠纷由当事人自负。
        </p>
      </div>
    </footer>
  )
}
