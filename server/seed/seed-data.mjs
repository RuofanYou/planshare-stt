/**
 * PlanShare 种子数据（单一权威 · 全部真实，无任何编造）。
 *
 * 团本 / BOSS / journalOrder / 难度 ID 取自 STT 内置数据库
 *   （ShengTangTools/data/semantic_builtin_plans_s14.lua、boss_spells.lua、core/auto_logging.lua）。
 *   难度：普通=14 / 英雄(H)=15 / 史诗(M)=16。
 * 对应 12.0 三团本：虚影尖塔(1307) / 进军奎尔丹纳斯(1308) / 梦境裂隙(1314)。
 *
 * 9 块战术板全部为「圣糖刺客」实战出品的真实方案原文（作者 = STT/圣糖刺客）：
 *   M1 元首 / M2 弗拉 / M3 萨哈达尔 / M4 双龙 / M5 光盲 / M6 奥蕾莉亚(H) / M7 奇美鲁斯 / M8 贝洛朗 / M9 至暗之夜降临。
 * 不含任何编造内容；H 难度只有作者真实提供的一份（宇宙之冕/奥蕾莉亚），不臆造。
 *
 * 后端在 DB 为空时从本文件 seed。
 */

export const raids = [
  { id: 'r-voidspire', name: '虚影尖塔', patch: '12.0.0' },
  { id: 'r-queldanas', name: '进军奎尔丹纳斯', patch: '12.0.5' },
  { id: 'r-dreamrift', name: '梦境裂隙', patch: '12.0.7' },
]

export const bosses = [
  { id: 'b-averzian', raidId: 'r-voidspire', name: '元首阿福扎恩', order: 1 },
  { id: 'b-vorasius', raidId: 'r-voidspire', name: '弗拉希乌斯', order: 2 },
  { id: 'b-salhadaar', raidId: 'r-voidspire', name: '陨落之王萨哈达尔', order: 3 },
  { id: 'b-vaelgor', raidId: 'r-voidspire', name: '威厄高尔和艾佐拉克', order: 4 },
  { id: 'b-lightblind', raidId: 'r-voidspire', name: '光盲先锋军', order: 5 },
  { id: 'b-cosmos', raidId: 'r-voidspire', name: '宇宙之冕', order: 6 },
  { id: 'b-beloren', raidId: 'r-queldanas', name: '贝洛朗，奥的子嗣', order: 1 },
  { id: 'b-midnight', raidId: 'r-queldanas', name: '至暗之夜降临', order: 2 },
  { id: 'b-chimaerus', raidId: 'r-dreamrift', name: '奇美鲁斯，未梦之神', order: 1 },
]

export const authors = [
  {
    id: 'a-stt',
    name: '圣糖刺客',
    // 圣糖不挂招募/联系方式 → 作者主页不渲染公会引流卡（与妮可一致）。
  },
  {
    // 仅署名作者（无公会信息 → 作者主页不渲染公会引流卡）。
    id: 'a-nike',
    name: '妮可',
  },
]

// ============================ 真实战术板正文 ============================

const M1_AVERZIAN = `[方案]
名称=元首阿福扎恩 · M
作者=圣糖刺客
日期=2026年3月29日

[人员]
DKT=挨打的豆豆
WST=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=吉田步美
小德2=馬頭琴獸希恩
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=格羅姆地獄吼
DH1=曼舞者丶
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
湮灭1=孟加拉巨蜥丶
DZ1=大脾气小心眼

[时间轴]
{time:00:06} {BOSS}:{JLM1}福音
{time:00:29} {BOSS}:{奶萨1}{spell:114052}
{time:00:36} {BOSS}:{神牧1}神圣化身{JLM1}终极苦修
{time:00:42} {BOSS}:{奶德1}{spell:740}
{time:00:45} {BOSS}{spell:1249266}:{小德1}{spell:77764}
{time:00:52} {BOSS}胖子激活:{ZS1}{spell:97462}
{time:00:55} {BOSS}{spell:1249251}:{神牧1}神圣赞美诗
{time:01:39} {BOSS}:{JLM1}福音
{time:02:07} {BOSS}{spell:1249266}:{小德1}{spell:77764}
{time:02:40} {BOSS}:{奶萨1}{spell:114052}
{time:02:43} {BOSS}:{神牧1}神圣化身
{time:03:31} {BOSS}:{JLM1}福音
{time:03:51} {BOSS}{spell:1249266}:{奶德1}{spell:740}{小德1}{spell:77764}
{time:04:01} {BOSS}{spell:1249251}:{ZS1}{spell:97462} {神牧1}神圣赞美诗
{time:04:22} {BOSS}:{AM1}{spell:15290}的拥抱
{time:04:40} {BOSS}:{奶萨1}{spell:114052}
{time:04:55} {BOSS}:{神牧1}神圣化身
{time:05:02} {BOSS}:{JLM1}福音
{time:05:11} {BOSS}{spell:1249266}:{小德1}{spell:77764}
{time:06:06} {BOSS}:{JLM1}终极苦修
{time:06:22} {BOSS}:{AM1}{spell:15290}的拥抱
{time:06:42} {BOSS}点名{spell:1249266}:{奶萨1}{spell:114052}`

const M2_VORASIUS = `[方案]
名称=弗拉希乌斯 · M（含转火分配）
作者=圣糖刺客
日期=2026年3月30日

[人员]
DKT=挨打的豆豆
WST=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=吉田步美
小德2=馬頭琴獸希恩
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=格羅姆地獄吼
DH1=曼舞者丶
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
湮灭1=孟加拉巨蜥丶
DZ1=大脾气小心眼

[时间轴]
{time:00:06} {BOSS}:{JLM1}福音
{time:00:08} {BOSS}:{AM1}{spell:15290}的拥抱
{time:01:00} {BOSS}{spell:1254199}:{奶萨1}{spell:114052}灵魂链接{JLM1}终极苦修{神牧1}神圣化身{所有人}个减{小德1}{spell:77764}
{time:01:15} {BOSS}:{所有人}转火组转火小怪
{time:01:28} {BOSS}一起A掉:{ZS1}{spell:97462} {湮灭1}微风{奶德1}{spell:740}{神牧1}神圣赞美诗
{time:01:36} {BOSS}:{JLM1}福音
{time:01:37} {BOSS}准备{spell:1257629}:{小德2}{spell:77764}
{time:01:42} {BOSS}{spell:1257629}:{DKT}反魔法领域{DH1}{spell:196718}
{time:02:12} {BOSS}{spell:1260052}:{AM1}{spell:15290}的拥抱
{time:03:02} {BOSS}{spell:1254199}:{所有人}个减{奶萨1}{spell:114052}{小德1}{spell:77764}
{time:03:17} {BOSS}:{所有人}转火组转火小怪
{time:03:22} {BOSS}:{JLM1}福音
{time:03:32} {BOSS}一起A掉:{神牧1}神圣化身{湮灭1}微风{所有人}糖红
{time:03:37} {BOSS}准备{spell:1257629}:{小德2}{spell:77764}
{time:03:43} {BOSS}{spell:1257629}:{DK1}反魔法领域{DH2}{spell:196718}
{time:04:25} {BOSS}:{AM1}{spell:15290}的拥抱
{time:05:05} {BOSS}{spell:1254199}:{所有人}个减{奶萨1}{spell:114052}灵魂链接{小德1}{spell:77764}
{time:05:20} {BOSS}:{所有人}转火组转火小怪
{time:05:21} {BOSS}:{JLM1}福音
{time:05:30} {BOSS}一起A掉:{ZS1}{spell:97462} {湮灭1}微风{奶德1}{spell:740}{神牧1}神圣赞美诗
{time:05:34} {BOSS}:{JLM1}终极苦修{神牧1}神圣化身
{time:05:38} {BOSS}准备{spell:1257629}:{小德2}{spell:77764}
{time:05:42} {BOSS}{spell:1257629}:{DKT}反魔法领域{DH1}{spell:196718}`

const M3_SALHADAAR = `[方案]
名称=陨落之王萨哈达尔 · M
作者=圣糖刺客
日期=2026年3月29日

[人员]
DKT=挨打的豆豆
WST=冰豆丶
奶龙1=大龙秋秋
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=吉田步美
小德2=馬頭琴獸希恩
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=格羅姆地獄吼
DH1=曼舞者丶
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
湮灭1=孟加拉巨蜥丶
DZ1=大脾气小心眼

[时间轴]
{time:00:16} {BOSS}{spell:1250686}:{JLM1}福音
{time:00:26} {BOSS}{spell:1254081}:{所有人}打断组开始打断
{time:00:29} {BOSS}球1被击杀{spell:1285211}:{奶萨1}{spell:114052}奶龙2{spell:359816}
{time:00:45} {BOSS}球2被击杀{spell:1285211}:{奶龙1}{spell:359816}
{time:01:13} {BOSS}{spell:1254081}:{所有人}打断组开始打断
{time:01:14} {BOSS}:终极苦修
{time:01:21} {BOSS}球1被击杀{spell:1285211}:{奶龙1}{spell:363534}{所有人}击杀2球准备转阶段
{time:01:30} {BOSS}球2被击杀{spell:1285211}:{奶德1}{spell:740}
{time:01:36} {BOSS}{spell:1253032}:{ZS1}{spell:97462} {小德1}{spell:77764}
{time:01:42} {BOSS}{spell:1246175}:{DKT}反魔法领域{奶萨1}灵魂链接{DH1}{spell:196718}
{time:01:50} {BOSS}:{JLM1}福音
{time:02:02} {BOSS}动荡:{小德2}{spell:77764}
{time:02:28} {BOSS}{spell:1254081}:{AM1}{spell:15290}的拥抱{所有人}打断组开始打断
{time:02:33} {BOSS}球1被击杀{spell:1285211}:{奶萨1}{spell:114052}{湮灭1}微风
{time:02:51} {BOSS}{spell:1253032}:{奶龙1}{spell:359816}
{time:03:15} {BOSS}{spell:1254081}:{所有人}打断组开始打断
{time:03:30} {BOSS}球1被击杀{spell:1285211}:{所有人}个减奶龙2{spell:359816}{所有人}击杀2球准备转阶段
{time:03:39} {BOSS}{spell:1251213}:{小德1}{spell:77764}
{time:03:44} {BOSS}{spell:1246175}:{DK1}反魔法领域{DH2}{spell:196718}{所有人}糖红
{time:03:47} {BOSS}:{JLM1}福音
{time:04:04} {BOSS}动荡:{小德2}{spell:77764}
{time:04:31} {BOSS}{spell:1254081}:{所有人}打断组开始打断
{time:04:38} {BOSS}球1被击杀{spell:1285211}:{奶萨1}{spell:114052}{湮灭1}微风
{time:04:54} {BOSS}球2被击杀{spell:1285211}:{奶龙1}{spell:359816}
{time:05:16} {BOSS}{spell:1254081}:{所有人}打断组开始打断
{time:05:20} {BOSS}球1被击杀{spell:1285211}:{奶龙1}{spell:363534}{所有人}击杀2球准备转阶段
{time:05:33} {BOSS}球2被击杀{spell:1285211}:{奶德1}{spell:740}
{time:05:38} {BOSS}{spell:1253032}:{ZS1}{spell:97462} {小德1}{spell:77764}奶龙2{spell:359816}
{time:05:46} {BOSS}{spell:1246175}:ZDKT反魔法领域{奶萨1}灵魂链接{DH1}{spell:196718}
{time:05:50} {BOSS}:{JLM1}福音
{time:05:56} {BOSS}:{JLM1}终极苦修
{time:06:06} {BOSS}动荡:{小德2}{spell:77764}`

const M4_VAELGOR = `[方案]
名称=威厄高尔和艾佐拉克（双龙）· M
作者=圣糖刺客
日期=2026年4月6日

[人员]
DKT1=挨打的豆豆
DKT2=魅之狂暴
WST=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=馬頭琴獸希恩
咕咕1=馬頭琴獸希恩
小德2=吉田步美
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=格羅姆地獄吼
DH1=曼舞者丶
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
增辉1=南京小车神
增辉2=大龙秋秋
DZ1=大脾气小心眼
奶龙1=瑟维莱

[时间轴]
{time:00:11} {BOSS}{spell:1244221}1:{所有人}恐惧点门去骷髅{增辉1}{spell:374968}
{time:00:14} {BOSS}{spell:1245391}1:{DKT1}阴霾结束嘲黑龙{WST}阴霾结束嘲白龙{所有人}一组分担叉叉阴霾
{time:00:34} {BOSS}{spell:1262623}1:{小德2}{spell:77764}
{time:00:38} {BOSS}{spell:1244917}1:{奶萨1}{spell:114052}{奶龙1}{spell:359816}{DKT2}群拉{咕咕1}日光术
{time:00:42} {JLM1}福音
{time:00:48} {BOSS}虚界内爆:{DKT2}虚界拉断
{time:00:50} {奶龙1}{spell:363534}
{time:01:04} {BOSS}{spell:1245391}2:{DKT1}阴霾结束嘲白龙{WST}阴霾结束嘲黑龙{所有人}二组分担三角阴霾
{time:01:16} {BOSS}{spell:1244221}2:{所有人}恐惧点门去骷髅
{time:01:18} {BOSS}{spell:1244917}2:{DKT1}群拉{DH1}控制{奶萨1}灵魂链接{DKT1}反魔法 领域
{time:01:24} {BOSS}{spell:1262623}2:{小德1}{spell:77764}{增辉1}抱戒律牧拉断{增辉2}{spell:374968}
{time:01:34} {奶德1}{spell:740}
{time:01:37} {BOSS}虚界内爆:{DKT2}虚界拉断{JLM1}终极苦修
{time:01:54} {BOSS}{spell:1245391}3:{DKT1}阴霾结束嘲黑龙{WST}阴霾结束嘲白龙{所有人}一组分担方块阴霾
{time:02:20} {BOSS}{spell:1244221}1:{所有人}恐惧点门个减去骷髅
{time:02:24} {BOSS}{spell:1262623}1:{奶萨1}{spell:192077}
{time:02:32} {BOSS}{spell:1244221}2:{所有人}恐惧点门个减去大饼
{time:02:33} {JLM1}福音{增辉1}抱戒律牧拉断
{time:02:37} {BOSS}进入P2:{DKT1}进入P2嘲讽白龙{WST}进入P2嘲讽黑龙{增辉1}微风{增辉2}微风{奶龙1}微风
{time:02:40} {BOSS}虚界内爆:{DKT2}虚界拉断{奶龙1}{spell:359816}{小德2}{spell:77764}
{time:02:43} {AM1}{spell:15290}的拥抱{所有人}优先击杀大怪
{time:02:45} {奶萨1}{spell:114052}
{time:02:51} {BOSS}{spell:1244917}1:{DKT2}群拉{DH1}控制{spell:196718}
{time:03:02} {BOSS}{spell:1262623}1:{小德1}{spell:77764}
{time:03:17} {BOSS}虚界内爆:{DKT2}虚界拉断
{time:03:17} {BOSS}{spell:1244221}1:{所有人}恐惧点门去骷髅
{time:03:26} {BOSS}{spell:1244917}2:{DKT1}群拉{咕咕1}日光术{ZS1}{spell:97462} {所有人}吃糖{DKT2}反魔法领域
{time:03:33} {BOSS}{spell:1245391}1:{DKT1}阴霾结束嘲黑龙{WST}阴霾结束嘲白龙{所有人}一组分担叉叉阴霾{增辉1}{spell:374968}
{time:03:52} {BOSS}{spell:1262623}2:{小德2}{spell:77764}{增辉2}{spell:374968}
{time:03:59} {BOSS}{spell:1265131}:{增辉1}抱戒律牧拉断
{time:04:03} {BOSS}虚界内爆:{DKT2}虚界拉断{JLM1}福音{所有人}个减
{time:04:06} {BOSS}{spell:1244917}3:{奶龙1}{spell:363534}{DH1}控制
{time:04:14} {BOSS}{spell:1244221}2:{所有人}恐惧点门去骷髅
{time:04:22} {BOSS}{spell:1245391}2:{DKT1}阴霾结束嘲白龙{WST}阴霾结束嘲黑龙{所有人}二组分担三角阴霾
{time:04:42} {BOSS}{spell:1262623}3:{小德1}{spell:77764}
{time:04:46} {BOSS}{spell:1244917}4:{奶萨1}{spell:114052}{奶德1}{spell:740}{DKT2}群拉{咕咕1}日光术
{time:04:48} {奶龙1}{spell:359816}
{time:04:58} {BOSS}虚界内爆:{DKT2}虚界拉断
{time:05:07} {BOSS}{spell:1244917}1:{所有人}个减糖红印记出人群{DKT1}群拉{DH1}控制{增辉1}微风{增辉2}微风{奶龙1}微风{奶萨1}灵魂链接{DKT1}反魔法领域
{time:05:15} {BOSS}{spell:1245391}1:{所有人}一组分担方块阴霾{奶萨1}{spell:192077}
{time:05:23} {BOSS}{spell:1244221}1:{所有人}恐惧点门去骷髅
{time:05:30} {BOSS}进入P3:{DKT1}进入P3嘲讽黑龙{WST}进入P3嘲讽白龙{所有人}先击杀大怪
{time:05:42} {AM1}{spell:15290}的拥抱
{time:06:00} {BOSS}{spell:1245391}1:{DKT1}阴霾结束嘲白龙{WST}阴霾结束嘲黑龙{所有人}二组分担大饼阴霾
{time:06:02} {JLM1}福音
{time:06:07} {BOSS}{spell:1244221}1:{所有人}恐惧点门去骷髅
{time:06:18} {DKT2}群拉{咕咕1}日光术
{time:06:20} {BOSS}{spell:1262623}1:{小德2}{spell:77764}
{time:06:33} {BOSS}虚界内爆:{JLM1}终极苦修{DKT2}反魔法领域
{time:06:43} {BOSS}{spell:1265131}:{增辉1}{spell:374968}
{time:06:50} {BOSS}{spell:1245391}2:{DKT1}阴霾结束嘲黑龙{WST}阴霾结束嘲白龙{所有人}一组分担叉叉阴霾
{time:06:52} {奶萨1}{spell:114052}
{time:06:58} {BOSS}{spell:1244917}2:{ZS1}{spell:97462} {DKT1}群拉{DH1}控制{spell:196718}`

const M5_LIGHTBLIND = `[方案]
名称=光盲先锋军 · M
作者=圣糖刺客
日期=2026年4月14日

[人员]
ZST1=淘气的井豆豆
ZST2=格羅姆地獄吼
奶僧1=瑟维娜
奶僧2=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=吉田步美
小德2=Animagus
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=冠东
DH1=纳闷住
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
增辉1=南京小车神
增辉2=孟加拉巨蜥丶
DZ1=大脾气小心眼
奶龙1=大龙秋秋

[时间轴]
{time:00:06} {奶龙1}{spell:359816}
{time:00:10} {BOSS}强化{spell:1255739}:{奶德1}{spell:740}
{time:00:12} {奶僧1}天神御身
{time:00:13} {DK1}反魔法领域
{time:00:14} {JLM1}福音{ZST2}{spell:97462}
{time:00:15} {BOSS}{spell:1246765}:{奶僧1}青龙下凡
{time:00:17} {BOSS}{spell:1246497}1:{治疗}注意驱散
{time:00:20} {BOSS}{spell:1255739}10w:{ZST1}带走防骑
{time:00:23} {奶龙1}{spell:363534}
{time:00:25} {BOSS}{spell:1255739}结束:{所有人}冲锋组到叉叉引冲锋
{time:00:34} {BOSS}{spell:1248710}:{所有人}躲到吸盾组后面{奶僧1}作茧缚命自己{神牧1}神圣化身
{time:00:57} {BOSS}狂热之魂:{所有人}转火防骑
{time:00:58} {BOSS}{spell:1246749}2:{所有人}吸收盾被奶爆
{time:01:04} {奶德1}{spell:33891}
{time:01:08} {奶萨1}{spell:114052}
{time:01:11} {BOSS}强化{spell:1246497}:{ZST2}带惩戒骑出{奶僧1}还魂
{time:01:13} {JLM1}终极苦修
{time:01:19} {BOSS}{spell:1258659}:{ZST2}嘲讽奶骑到方块{所有人}天锤方形站位躲好飞盘就能活
{time:01:27} {BOSS}处决宣判:{ZST1}{spell:97462} {奶僧1}壮胆酒
{time:01:32} {BOSS}{spell:1249130}:{所有人}靠近1组刷血{奶龙1}{spell:374968}
{time:01:35} {BOSS}{spell:1246497}1:{治疗}注意驱散
{time:01:47} {BOSS}{spell:1246497}2:{治疗}注意驱散
{time:01:52} {BOSS}{spell:1246749}1:{奶僧1}天神御身
{time:01:55} {BOSS}{spell:1255739}:{JLM1}福音
{time:02:03} {BOSS}强化{spell:1246765}:{奶龙1}螺旋{小德1}{spell:77764}{奶龙1}{spell:359816}{ZST2}嘲讽防骑
{time:02:05} {BOSS}{spell:1246497}3:{治疗}注意驱散
{time:02:07} {ZST1}带位奶骑到边场{增辉1}{spell:374968}
{time:02:10} {BOSS}{spell:1255739}结束:{ZST1}回来后嘲讽防骑
{time:02:14} {所有人}天锤方形站位个减应对吸收盾
{time:02:19} {BOSS}{spell:1246497}4:{治疗}注意驱散
{time:02:21} {BOSS}{spell:1246765}:{增辉1}微风{奶龙1}微风
{time:02:23} {BOSS}处决宣判:{所有人}个减
{time:02:25} {BOSS}{spell:1246497}1:{治疗}注意驱散{奶僧1}青龙作茧缚命自己
{time:02:28} {奶萨1}灵魂链接
{time:02:31} {BOSS}{spell:1251857}:{所有人}靠近躲到吸盾组后面
{time:02:35} {BOSS}{spell:1251857}:{神牧1}神圣化身
{time:02:41} {BOSS}{spell:1246497}2:{治疗}注意驱散
{time:02:45} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:02:50} {BOSS}{spell:1258514}:{所有人}吸收盾被奶爆
{time:02:56} {奶德1}{spell:33891}
{time:02:59} {BOSS}{spell:1246497}3:{ZST1}带位防骑到边场{治疗}注意驱散
{time:03:08} {BOSS}{spell:1246162}:{所有人}脚下集合2组吃一次吸收盾{DH1}{spell:196718}
{time:03:13} {BOSS}{spell:1248644}:{DK1}反魔法领域{ZST2}惩戒骑往右拉8码{奶僧1}壮胆酒
{time:03:14} {奶龙1}{spell:363534}
{time:03:17} {BOSS}强化{spell:1255739}结束:{所有人}坦克带位两个BOSS到边场
{time:03:21} {奶德1}{spell:740}
{time:03:22} {BOSS}{spell:1246749}1:{奶僧1}天神御身
{time:03:29} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:03:40} {BOSS}{spell:1246749}2:{所有人}吸收盾被奶爆
{time:03:43} {BOSS}{spell:1251857}:{ZST2}读审判嘲讽防骑{奶僧1}作茧缚命战士T2
{time:03:53} {BOSS}强化{spell:1246497}:{奶僧1}还魂{ZST2}带惩戒骑到边场
{time:03:54} {BOSS}{spell:1255739}:{JLM1}福音
{time:03:58} {BOSS}神圣{spell:1246158}:{所有人}天锤方形站位躲好飞盘就能活{ZST2}{spell:97462}
{time:04:13} {奶龙1}{spell:359816}
{time:04:14} {BOSS}{spell:1246497}1:{治疗}注意驱散
{time:04:21} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:04:28} {奶德1}{spell:33891}
{time:04:29} {BOSS}{spell:1246497}2:{治疗}注意驱散
{time:04:45} {BOSS}强化{spell:1246765}:{ZST2}嘲讽防骑
{time:04:47} {BOSS}{spell:1246497}3:{ZST1}带位奶骑到边场{治疗}注意驱散{增辉1}{spell:374968}
{time:04:54} {所有人}天锤方形站位个减应对吸收盾
{time:04:55} {奶僧1}青龙下凡
{time:04:57} {BOSS}{spell:1248451}:{ZST1}回来后嘲讽防骑
{time:04:58} {BOSS}{spell:1246497}4:{治疗}注意驱散
{time:05:02} {BOSS}{spell:1248710}:{增辉1}微风{奶龙1}微风
{time:05:02} {BOSS}处决宣判:{ZST1}{spell:97462} {所有人}个减{神牧1}神圣赞美诗
{time:05:03} {BOSS}{spell:1246765}:{所有人}2组吃一次吸收盾
{time:05:05} {BOSS}{spell:1246497}1:{神牧1}神圣化身{治疗}注意驱散{奶僧1}作茧缚命自己
{time:05:12} {奶僧1}天神御身
{time:05:24} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:05:25} {BOSS}{spell:1246497}2:{JLM1}终极苦修{治疗}注意驱散
{time:05:28} {BOSS}{spell:1246749}2:{所有人}吸收盾被奶爆
{time:05:41} {BOSS}{spell:1246497}3:{ZST1}带位防骑到边场水里{治疗}注意驱散
{time:05:42} {BOSS}强化{spell:1255739}:{JLM1}福音
{time:05:49} {奶萨1}{spell:114052}
{time:05:52} {BOSS}{spell:1248710}:{所有人}脚下集合2组吃一次吸收盾{ZST2}惩戒骑往右拉8码
{time:05:52} {BOSS}{spell:1248644}:{奶僧1}壮胆酒
{time:05:55} {所有人}吃糖红{奶萨1}灵魂链接
{time:05:57} {BOSS}{spell:1246765}:{奶龙1}{spell:359816}
{time:06:09} {BOSS}{spell:1248674}:{奶龙1}{spell:374968}
{time:06:09} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:06:17} {所有人}吸收盾被奶爆
{time:06:22} {BOSS}{spell:1246749}2:{奶德1}{spell:740}
{time:06:26} {BOSS}{spell:1251859}:{ZST2}读审判嘲讽防骑
{time:06:27} {奶德1}{spell:33891}
{time:06:34} {BOSS}击杀{spell:1278108}骑:{所有人}6分40秒之前击杀惩戒骑
{time:06:35} {BOSS}强化{spell:1246497}:{奶僧1}还魂
{time:06:43} {奶僧1}天神御身
{time:06:53} {BOSS}{spell:1246497}1:{治疗}注意驱散
{time:07:01} {BOSS}{spell:1248674}:{奶僧1}青龙
{time:07:01} {BOSS}{spell:1249130}:{所有人}靠近脚下引冲锋
{time:07:09} {神牧1}神圣化身
{time:07:11} {BOSS}{spell:1246497}2:{治疗}注意驱散{增辉1}微风{奶龙1}微风
{time:07:19} {BOSS}{spell:1251857}:{JLM1}福音
{time:07:29} {BOSS}{spell:1246497}3:{DK1}反魔法领域{DH1}{spell:196718}{治疗}注意驱散{ZST2}{spell:97462}
{time:07:30} {奶僧1}作茧缚命战士T1{奶龙1}{spell:363534}
{time:07:33} {神牧1}神圣赞美诗
{time:07:37} {BOSS}{spell:1246497}4:{治疗}注意驱散
{time:07:39} {奶龙1}{spell:359816}
{time:07:42} {神牧1}给战士T1天使
{time:07:47} {BOSS}{spell:1246497}5:{治疗}注意驱散`

const M6_AURELIA = `[方案]
名称=宇宙之冕 · 奥蕾莉亚 · H
作者=圣糖刺客
日期=2026年5月7日

[人员]
DKT1=挨打的豆豆
WST1=冰豆丶
ZST1=淘气的井豆豆
{奶僧1}=瑟维娜
奶僧2=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
咕咕1=馬頭琴獸希恩
咕咕2=Eirodynoir
小德1=吉田步美
小德2=Animagus
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=冠东
DH1=纳闷住
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=暮魚成舟
增辉1=南京小车神
增辉2=大龙秋秋
DZ1=大脾气小心眼
CJQ1=熙熙酱
奶龙1=大龙秋秋

[时间轴]
{time:00:03} {BOSS}{spell:1233865}1:{JLM1}福音{治疗}注意刷盾
{time:00:10} {BOSS}{spell:1243743}1:{所有人}打断施法{奶萨1}{spell:114052}{奶德1}AOE完毕{spell:740}
{time:00:13} {BOSS}{spell:1233819}1:{所有人}引水
{time:00:20} {BOSS}银锋箭点名1:{所有人}空射{AM1}{spell:15290}的拥抱
{time:00:26} {BOSS}银锋箭射出1:{奶僧1}天神御身{ZST1}{spell:97462}
{time:00:28} {BOSS}{spell:1232467}2:{ZST1}截胡3号机的两只小软
{time:00:30} {BOSS}{spell:1243743}2:{所有人}打断施法{奶僧1}还魂术
{time:00:37} {BOSS}银锋箭点名2:{所有人}单射1怪
{time:00:40} {BOSS}{spell:1233865}2:{奶僧1}青龙下凡{治疗}注意刷盾
{time:00:51} {BOSS}:{DKT1}凋零减速小软
{time:00:53} {BOSS}{spell:1233819}2:{所有人}引水
{time:00:55} {BOSS}{spell:1232467}3:{所有人}银锋箭点名后点门
{time:00:56} {BOSS}银锋箭点名3:{所有人}空射
{time:01:00} {BOSS}{spell:1233787}3:{JLM1}终极苦修{DKT1}死亡脚步
{time:01:01} {BOSS}:{奶萨1}灵魂链接{增辉1}微风{增辉2}微风
{time:01:10} {BOSS}:{ZST1}开始抗3号机
{time:01:15} {BOSS}银锋箭点名4:{所有人}空射
{time:01:16} {BOSS}:{ZST1}截胡1号机的两只小软
{time:01:20} {BOSS}{spell:1233865}3:{治疗}注意刷盾
{time:01:26} {BOSS}{spell:1233819}3:{所有人}引水
{time:01:27} {BOSS}{spell:1233787}4:{DKT1}死亡脚步
{time:01:30} {BOSS}:{所有人}2号机剩丝血转场
{time:01:33} {BOSS}银锋箭点名5:{所有人}单射2怪
{time:01:34} {BOSS}:{JLM1}福音
{time:01:43} {BOSS}{spell:1233865}4:{治疗}注意刷盾
{time:01:53} {BOSS}{spell:1233819}4:{所有人}引水
{time:01:57} {BOSS}:{奶僧1}天神御身
{time:01:59} {BOSS}银锋箭点名6:{所有人}单射3怪
{time:02:38} {BOSS}:{所有人}看情况开个减
{time:02:54} {BOSS}{spell:1246918}:{所有人}转火组点门转火小怪
{time:03:00} {BOSS}:{AM1}{spell:15290}的拥抱
{time:03:05} {BOSS}{spell:1237035}:{WST1}放魂体双分
{time:03:06} {BOSS}:{JLM1}福音
{time:03:14} {BOSS}{spell:1233819}1:{所有人}引水
{time:03:15} {BOSS}裂隙幻影击杀:{所有人}幻影18秒被击杀
{time:03:18} {BOSS}影子出现1:{所有人}箭头点名
{time:03:31} {BOSS}:{奶僧1}青龙下凡天神御身
{time:03:38} {BOSS}:{奶萨1}{spell:114052}
{time:03:39} {BOSS}{spell:1233819}2:{所有人}引水
{time:03:43} {BOSS}影子出现2:{所有人}箭头点名
{time:03:54} {BOSS}{spell:1237844}:{奶僧1}还魂
{time:04:06} {BOSS}{spell:1233819}3:{所有人}引水
{time:04:10} {BOSS}影子出现3:{所有人}箭头点名
{time:04:20} {BOSS}{spell:1237035}:{奶德1}{spell:740}
{time:04:22} {BOSS}{spell:1232467}4:{所有人}拉弓往右走
{time:04:31} {BOSS}{spell:1233819}4:{所有人}没有被点的点门走{增辉2}微风
{time:04:35} {BOSS}影子出现4:{所有人}箭头点名
{time:04:38} {BOSS}{spell:1237614}4:{JLM1}福音
{time:04:49} {BOSS}{spell:1232467}5:{所有人}拉弓往右走
{time:04:58} {BOSS}{spell:1233819}5:{所有人}引水
{time:05:02} {BOSS}影子出现5:{所有人}箭头点名
{time:05:04} {BOSS}:{奶僧1}天神御身
{time:05:14} {BOSS}{spell:1232467}6:{所有人}拉弓往右走不再射影子
{time:05:20} {BOSS}{spell:1233819}6:{所有人}注意站位马上转阶段
{time:05:49} {BOSS}:{增辉1}微风{DKT1}反魔法领域{奶僧1}青龙下凡
{time:05:51} {BOSS}{spell:1239080}1:{所有人}直接拉断{增辉1}{spell:374968}
{time:05:54} {BOSS}{spell:1246918}:{所有人}转场击杀小怪
{time:06:13} {BOSS}{spell:1233865}1:{治疗}注意刷盾
{time:06:20} {BOSS}大怪击杀:{所有人}大怪24秒被击杀
{time:06:21} {BOSS}{spell:1233819}1:{所有人}放水
{time:06:27} {BOSS}:{JLM1}福音
{time:06:32} {BOSS}{spell:1239080}2:{所有人}{近战}等黑球炸完一拉{远程}二拉
{time:06:51} {BOSS}{spell:1239080}3:{DK1}反魔法领域{奶萨1}灵魂链接
{time:06:53} {BOSS}最强一波:{所有人}点门直接三拉{ZST1}{spell:97462} {DH1}{spell:196718}
{time:06:54} {BOSS}{spell:1261165}:{奶僧1}天神御身{奶萨1}{spell:114052}{增辉2}微风{奶僧1}还魂
{time:07:11} {BOSS}{spell:1243743}:{所有人}打断施法
{time:07:13} {BOSS}{spell:1233865}1:{治疗}注意刷盾
{time:07:21} {BOSS}{spell:1233819}1:{所有人}放水
{time:07:23} {BOSS}大怪击杀:{所有人}大怪27秒被击杀
{time:07:30} {BOSS}:{JLM1}终极苦修
{time:07:32} {BOSS}{spell:1239080}4:{所有人}{近战}等黑球炸完一拉{远程}二拉
{time:07:35} {BOSS}:{奶德1}{spell:740}
{time:07:48} {BOSS}:{所有人}提前过去引拉弓{增辉2}{spell:374968}
{time:07:51} {BOSS}{spell:1239080}5:{增辉1}微风{spell:374968}{所有人}坦克秒拉{近战}二拉
{time:07:53} {BOSS}:{奶僧1}青龙下凡
{time:07:57} {BOSS}{spell:1237035}:{所有人}个减糖红
{time:07:58} {BOSS}:{JLM1}福音
{time:08:13} {BOSS}{spell:1233865}1:{治疗}注意刷盾
{time:08:19} {BOSS}:{AM1}{spell:15290}的拥抱
{time:08:21} {BOSS}{spell:1233819}1:{所有人}放水
{time:08:23} {BOSS}大怪击杀:{所有人}大怪27秒被击杀
{time:08:26} {BOSS}{spell:1237035}:{奶僧1}天神御身
{time:08:32} {BOSS}{spell:1239080}6:{所有人}{近战}等黑球炸完一拉{远程}二拉
{time:08:51} {BOSS}{spell:1239080}7:{所有人}不拉`

const M7_CHIMAERUS = `[方案]
名称=奇美鲁斯（梦境裂隙）· M 固定轴
作者=圣糖刺客
日期=2026年3月28日

[人员]
DKT=挨打的豆豆
WST=冰豆丶
奶龙1=瑟维莱
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
小德1=吉田步美
小德2=馬頭琴獸希恩
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=格羅姆地獄吼
DH1=曼舞者丶
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
FS1=恐怖小乌龟
湮灭1=孟加拉巨蜥丶
DZ1=大脾气小心眼

[时间轴]
{time:00:01} {BOSS}:{JLM1}给术士灌注
{time:00:03} {BOSS}:{AM1}给邪DK灌注
{time:00:08} {BOSS}:{JLM1}福音{奶萨1}{spell:114052}
{time:00:09} {BOSS}{spell:1258610}:{奶龙1}{spell:359816}
{time:00:16} {BOSS}:{AM1}{spell:15290}的拥抱
{time:00:31} {BOSS}内场小怪被打出:{LR1}焦油陷阱{奶德1}乌索尔飓风
{time:00:34} {BOSS}{spell:1245396}瘴气1:{所有人}离得近的去消离得远的直接驱散{奶龙1}驱散远的{奶德1}驱散近的
{time:00:39} {BOSS}裂隙疯狂1:{湮灭1}微风{所有人}被点救人治疗去三角远程去方块
{time:00:41} {BOSS}巨身憎恶被打出:{DZ1}减速药膏
{time:00:47} {BOSS}:{奶龙1}救三角{LR1}救方块
{time:01:08} {BOSS}{spell:1245396}1:{JLM1}终极苦修{奶萨1}灵魂链接{奶德1}{spell:740}{DKT}反魔法领域{DH1}{spell:196718}
{time:01:12} {BOSS}:{奶龙1}{spell:363534}
{time:01:25} {BOSS}{spell:1245396}瘴气2:{小德1}{spell:77764}{小德2}{spell:77764}{所有人}腿长的去消腿短的直接驱散{奶萨1}驱散远的{JLM1}驱散近的
{time:01:50} {BOSS}内场小怪被打出:{LR2}焦油陷阱{小德2}乌索尔旋风
{time:01:52} {BOSS}裂隙疯狂2:{奶龙1}内场微风{所有人}被点救人治疗去三角远程去方块
{time:01:58} {BOSS}:{JLM1}救三角{FS1}救方块
{time:02:02} {BOSS}{spell:1245396}瘴气3:{所有人}离得近的去消离得远的直接驱散{奶龙1}驱散远的{奶德1}驱散近的
{time:02:06} {BOSS}:{AM1}给邪DK灌注
{time:02:08} {BOSS}:{奶萨1}{spell:114052}
{time:02:14} {BOSS}:{JLM1}给术士灌注
{time:02:16} {BOSS}:{AM1}{spell:15290}的拥抱
{time:02:18} {BOSS}:{JLM1}福音
{time:02:20} {BOSS}{spell:1245396}2:{DK1}反魔法领域{DH2}{spell:196718}{ZS1}{spell:97462}
{time:02:23} {BOSS}:{奶龙1}{spell:359816}
{time:02:52} {BOSS}{spell:1245452}1:{小德1}{spell:77764}{小德2}{spell:77764}
{time:04:13} {BOSS}:{AM1}给邪DK灌注
{time:04:17} {BOSS}:{JLM1}给术士灌注
{time:04:22} {BOSS}:{JLM1}福音{奶萨1}{spell:114052}
{time:04:24} {BOSS}:{奶龙1}{spell:359816}
{time:04:47} {BOSS}{spell:1245396}瘴气1:{所有人}离得近的去消离得远的直接驱散{奶龙1}驱散远的{奶德1}驱散近的
{time:04:49} {BOSS}内场小怪被打出:{LR1}焦油陷阱{奶德1}乌索尔飓风
{time:04:53} {BOSS}裂隙疯狂1:{湮灭1}微风{所有人}被点救人治疗去三角远程去方块
{time:04:55} {BOSS}内场大怪被打出:{DZ1}减速药膏
{time:05:01} {BOSS}:{奶龙1}救三角{LR1}救方块
{time:05:13} {BOSS}:{AM1}{spell:15290}的拥抱
{time:05:22} {BOSS}{spell:1245396}1:{奶德1}{spell:740}{JLM1}终极苦修{奶萨1}灵魂链接{DKT}反魔法领域{DH1}{spell:196718}{ZS1}{spell:97462}
{time:05:25} {BOSS}:{奶龙1}{spell:363534}
{time:05:38} {BOSS}{spell:1245396}瘴气2:{所有人}直接驱散
{time:05:45} {BOSS}{spell:1262289}2:{WST}单吃进入后跳崖
{time:05:59} {BOSS}:{JLM1}福音
{time:06:15} {BOSS}{spell:1245396}瘴气3:{所有人}直接驱散
{time:06:18} {BOSS}{spell:1246621}:{AM1}给邪DK灌注
{time:06:22} {BOSS}:{奶萨1}{spell:114052}
{time:06:28} {BOSS}:{JLM1}给术士灌注{奶龙1}{spell:359816}
{time:06:33} {BOSS}{spell:1245396}2:{DK1}反魔法领域{DH2}{spell:196718}`

const M8_BELOREN = `[方案]
名称=贝洛朗，奥的子嗣 · M
作者=圣糖刺客
日期=2026年5月8日

[人员]
DKT1=挨打的豆豆
WST1=冰豆丶
ZST1=淘气的井豆豆
奶僧1=瑟维娜
奶僧2=冰豆丶
神牧1=纳兰猫猫
奶德1=Animagus
JLM1=星丨与海
奶萨1=黄瓜不强力
咕咕1=馬頭琴獸希恩
咕咕2=Eirodynoir
小德1=吉田步美
小德2=Animagus
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=冠东
DH1=纳闷住
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
冰法1=恐怖小乌龟
增辉1=南京小车神
增辉2=大龙秋秋
DZ1=大脾气小心眼
CJQ1=熙熙酱
奶龙1=大龙秋秋

[时间轴]
{time:00:01} {BOSS}虚光汇流1:{增辉1}{spell:374968}{JLM1}福音{奶龙1}{spell:370562}
{time:00:03} {JLM1}终极苦修
{time:00:06} {奶德1}{spell:77764}
{time:00:07} {BOSS}光耀回响:{SS1}重新放门{增辉2}{spell:374968}
{time:00:17} {BOSS}虚空敕令1:{所有人}准备分摊
{time:00:19} {BOSS}圣光俯冲1:{冰法1}分担{奶德1}给铁木树皮{JLM1}给压制{增辉1}微风
{time:00:21} {BOSS}飞羽1:{所有人}注意羽毛
{time:00:23} {奶德1}{spell:33891}
{time:00:31} {BOSS}灼烧1:{治疗}注意刷盾
{time:00:31} {BOSS}飞羽2:{所有人}注意羽毛
{time:00:41} {BOSS}飞羽3:{所有人}注意羽毛开始守门
{time:00:51} {BOSS}虚光汇流2:{奶德1}{spell:740}{所有人}注意换色
{time:00:57} {BOSS}光耀回响:{咕咕2}{spell:77764}
{time:01:07} {BOSS}虚空敕令3:{所有人}准备分摊
{time:01:08} {BOSS}虚空俯冲2:FS2分担{JLM1}给压制{增辉2}微风{所有人}两只咕咕分担
{time:01:11} {BOSS}飞羽1:{所有人}注意羽毛
{time:01:21} {BOSS}灼烧2:{治疗}注意刷盾
{time:01:21} {BOSS}飞羽2:{所有人}注意羽毛
{time:01:31} {BOSS}飞羽3:{所有人}注意羽毛开始守门
{time:01:41} {BOSS}虚光汇流3:{奶龙1}{spell:370562}
{time:01:49} {BOSS}死亡坠落:{萨满1}{spell:192077}
{time:01:55} {BOSS}死亡坠落:{所有人}奥落地点门{增辉1}{spell:374968}
{time:00:00,p2r1} {所有人}{bar:6.6,label:<准备点门>}
{time:00:6.6,p2r1}{ct:5} {所有人}点门
{time:00:08.2,p2r1} {所有人}{bar:38.5,tick:3.5,spell:1246709}
{time:01:57} {BOSS}复生:{奶德1}{spell:33891}{JLM1}福音
{time:02:10} {奶萨1}{spell:114052}
{time:02:36} {ZST1}{spell:97462}
{time:02:37} {BOSS}复生:{所有人}个减{DK1}反魔法领域{DH1}{spell:196718}
{time:02:38} {CJQ1}{spell:642}消球{所有人}守门
{time:02:42} {BOSS}虚光汇流1:{奶萨1}{spell:192077}{奶龙1}{spell:363534}
{time:02:48} {BOSS}光耀回响:{增辉2}{spell:374968}{咕咕1}{spell:77764}
{time:02:51} {增辉1}抱人{增辉2}抱人
{time:02:58} {BOSS}虚空敕令1:{所有人}准备分摊
{time:02:58} {BOSS}光耀回响:{所有人}坦克带位
{time:02:59} {BOSS}虚空俯冲1:{冰法1}分担{增辉1}微风分担{增辉2}分担{奶德1}给铁木树皮{JLM1}给压制
{time:03:01} {BOSS}飞羽1:{所有人}注意羽毛
{time:03:11} {BOSS}飞羽2:{所有人}注意羽毛
{time:03:12} {BOSS}灼烧1:{治疗}注意刷盾{所有人}吃大红顶盾
{time:03:14} {BOSS}复生:{所有人}坦克注意挡球
{time:03:21} {BOSS}飞羽3:{所有人}注意羽毛开始守门
{time:03:32} {BOSS}虚光汇流2:{咕咕2}{spell:77764}{所有人}注意换色{奶龙1}{spell:370562}
{time:03:41} {奶德1}{spell:33891}
{time:03:48} {BOSS}虚空敕令3:{所有人}准备分摊
{time:03:48} {BOSS}光耀回响:{所有人}坦克带位
{time:03:49} {BOSS}圣光俯冲2:FS2分担{JLM1}给压制{增辉2}微风{所有人}两只咕咕分担
{time:03:51} {BOSS}飞羽1:{所有人}注意羽毛
{time:04:01} {BOSS}飞羽2:{所有人}注意羽毛
{time:04:02} {BOSS}灼烧2:{治疗}注意刷盾{所有人}吃糖顶盾
{time:04:12} {BOSS}飞羽3:{所有人}注意羽毛开始守门
{time:04:22} {BOSS}虚光汇流3:{所有人}注意换色{咕咕1}{spell:77764}
{time:04:38} {BOSS}光耀回响:{所有人}坦克带位
{time:04:38} {BOSS}虚光敕令5:{所有人}准备分摊
{time:04:39} {BOSS}虚空俯冲3:{冰法1}分担FS2分担{增辉1}微风分担{增辉2}分担{奶德1}给铁木树皮{JLM1}给压制{增辉1}抱人{增辉2}抱人
{time:04:39} {BOSS}圣光俯冲3:{SS1}给语言诅咒{所有人}分担完击杀奥
{time:04:41} {BOSS}飞羽1:{所有人}注意羽毛
{time:04:53} {BOSS}死亡坠落:{CJQ1}给DK{spell:1022}{萨满1}{spell:192077}
{time:04:59} {BOSS}死亡坠落:{增辉1}{spell:374968}
{time:05:00} {BOSS}圣光喷发:{奶萨1}{spell:114052}{奶龙1}{spell:370562}
{time:05:01} {BOSS}复生:{奶德1}{spell:740}
{time:05:03} {BOSS}光耀回响:{JLM1}福音
{time:05:06} {BOSS}复生:{奶德1}{spell:33891}
{time:05:10} {增辉2}{spell:374968}`

const M9_MIDNIGHT = `[方案]
名称=至暗之夜降临 · M 团速通轴
作者=圣糖刺客
日期=2026年5月29日

[人员]
DK2=若娜瓦
SS1=Whysoserious
FS1=恐怖小乌龟
SS2=成都顶流李团
增辉=南京小车神
DKT1=队长冰豆
WST1=冰豆丶
ZST1=淘气的井豆豆
奶僧1=瑟维娜
奶僧2=冰豆丶
神牧1=纳兰猫猫
奶德1=肆意灬晚风
奶德2=馬頭琴獸希恩
JLM1=星丨与海
奶萨1=黄瓜不强力
咕咕1=馬頭琴獸希恩
咕咕2=Eirodynoir
小德1=吉田步美
小德2=Animagus
萨满1=黄瓜不强力
DK1=魅之狂暴
ZS1=冠东
DH1=纳闷住
DH2=纳闷住
AM1=愛之義
LR1=带刀蝴蝶
LR2=凭本事装逼
冰法1=恐怖小乌龟
增辉1=南京小车神
增辉2=大龙秋秋
DZ1=大脾气小心眼
CJQ1=清蒸毛豆
元素1=Kiyan
奶龙1=大龙秋秋
左边=DH1 增辉1 DK1 奶德2 SS1 LR2 元素1 咕咕2 JLM1 ZST1
右边=SS2 LR1 冰法1 奶德1 AM1 DK2 增辉2 DKT1 CJQ1 奶萨1
种子=咕咕2 SS1 增辉1 LR1 AM1 增辉2 DKT1
[打断]
1: DK2 DK1 LR1 DKT1
2: 咕咕2 增辉1 FS1 SS2
3: DH1 AM1 LR2 元素1
[时间轴]
{time:00:06.0} {BOSS}{spell:1284934}棱柱1:{DKT1}反魔法领域{JLM1}福音
{time:00:09.0} {JLM1}双拉水晶到脚下{增辉2}营救水晶到JLM脚下
{time:00:11.0} {奶萨1}{spell:114052}
{time:00:12.0} {奶德1}{spell:740}
{time:00:22.5} {BOSS}{spell:1267049}:{DKT1}嘲讽
{time:00:33} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:00:33,-0} {所有人}外1
{time:00:34,-0} {所有人}红2
{time:00:35,-0} {所有人}蓝3
{time:00:36,-0} {所有人}外4
{time:00:37,-0} {所有人}红5
{time:00:42.5} {BOSS}{spell:1267049}:{ZST1}嘲讽{DKT1}开减伤
{time:00:43.5} {所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:00:50.0} {BOSS}{spell:1285708}1:{奶萨1}{spell:192077}
{time:00:56.0} {奶德1}{spell:77764}
{time:01:02.5} {BOSS}{spell:1267049}:{DKT1}嘲讽
{time:01:08.0} {BOSS}{spell:1284934}棱柱2:{DK1}反魔法领域{JLM1}终极苦修{增辉1}微风
{time:01:11.0} {增辉2}{spell:374968}{JLM1}三拉水晶到脚下
{time:01:18.0} {奶萨1}灵魂链接
{time:01:22.5} {BOSS}{spell:1267049}:{ZST1}嘲讽{DKT1}开减伤
{time:01:35} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:01:35,-0} {所有人}外1
{time:01:36,-0} {所有人}红2
{time:01:37,-0} {所有人}蓝3
{time:01:38,-0} {所有人}外4
{time:01:39,-0} {所有人}红5
{time:01:35}  {所有人}中符文个减
{time:01:42.5} {BOSS}{spell:1267049}:{DKT1}嘲讽
{time:01:45.5} {所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:01:58.0} {奶德1}{spell:77764}{元素1}{spell:192077}
{time:02:01.5} {BOSS}{spell:1267049}:{ZST1}嘲讽{DKT1}开减伤
{time:02:10.0} {BOSS}{spell:1284934}棱柱3:{ZST1}{spell:97462} {JLM1}福音{增辉2}微风
{time:02:22.5} {BOSS}{spell:1267049}:{DKT1}嘲讽
{time:02:37} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:02:37,-0} {所有人}外1
{time:02:38,-0} {所有人}红2
{time:02:39,-0} {所有人}蓝3
{time:02:40,-0} {所有人}外4
{time:02:41,-0} {所有人}红5
{time:02:42.5} {BOSS}{spell:1267049}:{ZST1}嘲讽{DKT1}开减伤
{time:02:43.0} {奶萨1}{spell:192077}
{time:02:47.5} {所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:03:11.5} {BOSS}{spell:1255743}:{增辉1}抱ZST丢种子{增辉2}抱DKT丢种子
{time:03:11.5} {BOSS}{spell:1255743}:{增辉1}给奶德空间悖论
{time:03:17.0} {奶德1}{spell:740}
{time:03:37.0} {BOSS}全团刀开始:{所有人}个减
{time:03:40.0} {BOSS}全团刀结束:{ZST1}找{冰法1}还种子{DKT1}找增辉还种子
{time:03:58} {所有人}充电1偏左5度
{time:03:59.0} {DKT1}反魔法领域
{time:04:00.0} {元素1}{spell:192077}
{time:04:03.0} {JLM1}福音{增辉2}{spell:374968}
{time:03:57.5}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:02.5}{种子}{to:种子环形提醒#1}丢下种子
{time:04:04.0} {BOSS}{spell:1284525}1:{咕咕2}{spell:77764}
{time:04:07.5} {BOSS}{spell:1267049}1:{DKT1}嘲讽
{time:04:09.0} {BOSS}分散圈1出现:{奶德1}{spell:77764}
{time:04:05.0}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:10}{种子}{to:种子环形提醒#1}丢下种子
{time:04:12} {所有人}分散圈1
{time:04:21} {所有人}{ct:3}收割1
{time:04:27.5} {BOSS}{spell:1267049}2:{DKT1}开减伤{ZST1}嘲讽
{time:04:28} {所有人}充电2正光柱
{time:04:29.0} {DK1}反魔法领域
{time:04:31.0} {奶萨1}{spell:192077}
{time:04:32.0} {奶萨1}{spell:114052}
{time:04:27.5}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:32.5}{种子}{to:种子环形提醒#1}丢下种子
{time:04:34.0} {BOSS}{spell:1284525}2:{增辉1}微风{增辉2}微风
{time:04:35.0}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:40}{种子}{to:种子环形提醒#1}丢下种子
{time:04:42} {所有人}分散圈2
{time:04:47.5} {BOSS}{spell:1267049}3:{DKT1}嘲讽
{time:04:51} {所有人}{ct:3}收割2
{time:04:58} {所有人}充电3偏右15度
{time:05:00.0} {DK2}反魔法领域
{time:05:03.0} {奶萨1}灵魂链接
{time:04:57.5}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:05:02.5}{咕咕2}{种子}{to:种子环形提醒#1}丢下种子
{time:05:04.0} {BOSS}{spell:1284525}3:{咕咕2}{spell:77764}
{time:05:07.5} {BOSS}{spell:1267049}4:{DKT1}开减伤{ZST1}嘲讽
{time:05:09.0} {BOSS}分散圈3出现:{奶德1}{spell:77764}
{time:05:05.0}{所有人}{bar:5,spell:1253031,label:<扔下种子>}
{time:05:10}{种子}{to:种子环形提醒#1}丢下种子
{time:05:12} {所有人}分散圈3
{time:05:11.7} {BOSS}分散圈3爆炸:{JLM1}终极苦修
{time:05:21} {所有人}{ct:3}收割3
{time:05:26.0} {增辉1}给戒律牧空间悖论
{time:05:27.0} {BOSS}击退分散圈出现:{ZST1}{spell:97462}
{time:05:30} {所有人}分散圈4击退站位
{time:05:30.0} {BOSS}{spell:1281123}:{所有人}个减
{time:05:35.0} {JLM1}福音
{time:05:48} {左边}吸球
{time:05:50} {右边}星座分散
{time:06:04.0} {所有人}开英勇
{time:06:08} {右边}吸球
{time:06:10} {左边}星座分散
{time:06:11.6} {BOSS}{spell:1267049}1:{DKT1}开减伤
{time:06:22.0} {奶德1}{spell:740}
{time:06:31.5} {BOSS}{spell:1253770}:{增辉1}开种子{LR1}开种子
{time:06:33.0} {奶德1}{spell:77764}{咕咕2}{spell:77764}
{time:06:41.6} {BOSS}{spell:1267049}2:{DKT1}开减伤
{time:06:43} {右边}吸球
{time:06:45} {左边}星座分散
{time:06:55.0} {奶萨1}{spell:192077}
{time:07:03} {左边}吸球
{time:07:00} {右边}星座分散
{time:07:05.0} {BOSS}右星座:{JLM1}福音
{time:07:07.0} {增辉1}微风{增辉2}微风
{time:07:11.6} {BOSS}{spell:1267049}3:{DKT1}开减伤
{time:07:26.4} {BOSS}{spell:1253770}:{咕咕2}开种子{增辉2}开种子
{time:07:30.1} {BOSS}{spell:1251331}2:{所有人}点门转场
{time:07:38} {左边}从外往内吸球
{time:07:40} {右边}时钟站位星座
{time:07:41.6} {BOSS}{spell:1267049}4:{DKT1}开减伤
{time:08:29.0} {奶萨1}{spell:114052}
{time:08:31.0} {BOSS}六芒星:{所有人}点名出人群
{time:08:38.0} {所有人}往右走
{time:08:38.0} {BOSS}{spell:1276525}1反向条:{增辉2}{spell:374968}{奶德1}{spell:77764}{LR1}龟壳挡鬼
{time:08:51.0} {BOSS}六芒星:{所有人}点名出人群
{time:08:57.0} {JLM1}福音
{time:08:58.0} {BOSS}{spell:1276525}2反向条:{所有人}往右走{LR2}龟壳挡鬼
{time:08:59.0} {咕咕2}{spell:77764}{元素1}{spell:192077}
{time:09:11.0} {BOSS}六芒星:{所有人}点名出人群
{time:09:16.0} {奶萨1}{spell:192077}
{time:09:18.0} {BOSS}{spell:1276525}3反向条:{所有人}往右走{CJQ1}{spell:642}挡鬼
{time:09:21.0} {增辉1}给奶德空间悖论
{time:09:24.0} {奶萨1}灵魂链接
{time:09:31.0} {BOSS}六芒星:{所有人}点名出人群`

// 妮可版贝洛朗 · M（偏治疗 CD 排表，与圣糖版同 BOSS 不同作者）。
const BELOREN_NIKE = `[方案]
名称 = 贝洛朗，奥的子嗣
作者 = 妮可

[人员]
奶僧=商务剋薙薇
奶龙=redhat
奶德=Marsell
dk1=緩慢而弱小
神牧=与甜
增辉1=无敌魔王龙
噬灭=Oldfish
dk2=给布瑞巫法可
增辉2=偷塑料贼
元素=莴师傅
zst=萨小战
lr1=森亚露露卡
lr2=宝山阿波
dz=游刃
cjq=嘉神川爱丽丝

[人员图标]
噬灭=1480
dk2=252
dk1=251
元素=262
lr1=255
lr2=253
dz=261

[时间轴]
{time:0:09} {宝山阿波}{spell:186257,dur:5}<猎豹守护>
{time:0:09} {宝山阿波}{spell:186265,dur:8}<灵龟守护>
{time:0:15} {宝山阿波}{spell:408233}<赋予军营之石>
{time:0:59} {森亚露露卡}{spell:186257,dur:5}<猎豹守护>
{time:0:59} {森亚露露卡}{spell:186265,dur:8}<灵龟守护>
{time:1:00,p2r1} {宝山阿波}{spell:186265}{dur:8} <灵龟守护>
{time:1:00,p2r1} {宝山阿波}{spell:186257}{dur:5} <猎豹守护>
{time:1:05} {森亚露露卡}{spell:408233}<赋予军营之石>
{time:1:06,p2r1} {宝山阿波}{spell:408233} <赋予军营之石>
{time:1:50,p2r1} {森亚露露卡}{spell:186265}{dur:8} <灵龟守护>
{time:1:56,p2r1} {森亚露露卡}{spell:408233} <赋予军营之石>
{time:1:50,p2r1} {森亚露露卡}{spell:186257}{dur:5} <猎豹守护>
{time:5:00} {萨小战}{spell:97462}{dur:10} <集结呐喊>

{time:00:01,p1r1} {奶僧}{spell:322118}
{time:00:01,p1r1} {奶僧}{spell:443028}
{time:00:01,p1r1} {奶龙}{spell:370553}
{time:00:01,p1r1} {奶龙}{spell:366155}
{time:00:01,p1r1} {奶龙}{spell:370537}
{time:00:01,p1r1} {奶德}{spell:391528}
{time:00:01,p1r1} {dk1}{spell:51052}
{time:00:02,p1r1} {神牧}{spell:200183}
{time:00:04,p1r1} {增辉1}{spell:374968}
{time:00:07,p1r1} {所有人}准备分摊，吃球准备
{time:00:12,p1r1} {奶德}{spell:106898}
{time:00:16,p1r1} {增辉1}{spell:374227}
{time:00:29,p1r1} {神牧}{spell:64843}
{time:00:50,p1r1} {噬灭}{spell:196718}
{time:00:51,p1r1} {dk2}{spell:51052}
{time:00:51,p1r1} {所有人}注意换色
{time:00:52,p1r1} {奶德}{spell:740}
{time:00:53,p1r1} {奶僧}{spell:115310}
{time:00:55,p1r1} {增辉2}{spell:374968}
{time:00:57,p1r1} {所有人}注意分摊，吃球准备
{time:00:59,p1r1} {元素}{spell:192077}
{time:01:02,p1r1} {奶德}{spell:391528}
{time:01:06,p1r1} {增辉2}{spell:374227}
{time:01:41,p1r1} {所有人}注意换色
{time:01:45,p1r1} {奶僧}{spell:443028}
{time:00:10,p2r1} {奶龙}{spell:370553}
{time:00:10,p2r1} {奶龙}{spell:366155}
{time:00:10,p2r1} {奶龙}{spell:370537}
{time:00:13,p2r1} {神牧}{spell:200183}
{time:00:15,p2r1} {奶僧}{spell:322118}
{time:00:15,p2r1} {奶龙}{spell:374968}
{time:00:15,p2r1} {奶德}{spell:391528}
{time:00:15,p2r1} {奶龙}{spell:374227}
{time:00:50,p2r1} {神牧}{spell:64843}
{time:00:50,p2r1} {所有人}免疫吃球 ，注意换色，全体守门
{time:00:55,p2r1} {增辉1}{spell:374968}
{time:00:58,p2r1} {所有人}注意分摊，吃球准备
{time:01:02,p2r1} {奶德}{spell:106898}
{time:01:08,p2r1} {增辉1}{spell:374227}
{time:01:16,p2r1} {奶德}{spell:391528}
{time:01:30,p2r1} {奶僧}{spell:443028}
{time:01:40,p2r1} {奶龙}{spell:370553}
{time:01:40,p2r1} {dk1}{spell:51052}
{time:01:40,p2r1} {奶龙}{spell:366155}
{time:01:40,p2r1} {奶龙}{spell:370537}
{time:01:42,p2r1} {所有人}注意换色
{time:01:45,p2r1} {增辉2}{spell:374968}
{time:01:48,p2r1} {所有人}注意分摊，吃球准备
{time:01:52,p2r1} {元素}{spell:192077}
{time:01:59,p2r1} {增辉2}{spell:374227}
{time:02:15,p2r1} {奶僧}{spell:115310}
{time:02:17,p2r1} {奶德}{spell:391528}
{time:02:32,p2r1} {奶德}{spell:740}
{time:02:32,p2r1} {所有人}注意换色
{time:02:50,p2r1} {奶僧}{spell:322118}
{time:00:02,p1r2} {奶龙}{spell:370553}
{time:00:02,p1r2} {奶龙}{spell:370537}
{time:00:03,p1r2} {奶龙}{spell:366155}
{time:00:04,p1r2} {dk2}{spell:51052}
{time:00:04,p1r2} {噬灭}{spell:196718}
{time:00:04,p1r2} {神牧}{spell:200183}
{time:00:10,p1r2} {奶龙}{spell:374968}
{time:00:10,p1r2} {奶龙}{spell:374227}
{time:00:14,p1r2} {神牧}{spell:64843}
{time:00:14,p1r2} {奶僧}{spell:443028}
{time:00:24,p1r2} {奶德}{spell:391528}`

// ============================ 板子（作者：圣糖刺客 + 妮可） ============================
export const boards = [
  {
    id: 'p-midnight-m9',
    title: '至暗之夜降临 · M',
    raidId: 'r-queldanas',
    bossId: 'b-midnight',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M9_MIDNIGHT,
    description: '',
    authorId: 'a-stt',
    isFeatured: true,
    viewCount: 32140,
    likeCount: 2186,
    isHidden: false,
    createdAt: '2026-05-29',
    updatedAt: '2026-05-29',
  },
  {
    id: 'p-beloren-m8',
    title: '贝洛朗，奥的子嗣 · M',
    raidId: 'r-queldanas',
    bossId: 'b-beloren',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M8_BELOREN,
    description: '',
    authorId: 'a-stt',
    isFeatured: true,
    viewCount: 17430,
    likeCount: 1064,
    isHidden: false,
    createdAt: '2026-05-08',
    updatedAt: '2026-05-08',
  },
  {
    // 同一 BOSS（贝洛朗）的另一作者版本 —— 演示「有得选」。
    id: 'p-beloren-nike',
    title: '贝洛朗，奥的子嗣 · M',
    raidId: 'r-queldanas',
    bossId: 'b-beloren',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: BELOREN_NIKE,
    description: '',
    authorId: 'a-nike',
    isFeatured: false,
    viewCount: 8230,
    likeCount: 486,
    isHidden: false,
    createdAt: '2026-05-12',
    updatedAt: '2026-05-12',
  },
  {
    id: 'p-vaelgor-m4',
    title: '威厄高尔和艾佐拉克（双龙）· M',
    raidId: 'r-voidspire',
    bossId: 'b-vaelgor',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M4_VAELGOR,
    description: '',
    authorId: 'a-stt',
    isFeatured: true,
    viewCount: 19880,
    likeCount: 1233,
    isHidden: false,
    createdAt: '2026-04-06',
    updatedAt: '2026-04-06',
  },
  {
    id: 'p-lightblind-m5',
    title: '光盲先锋军 · M',
    raidId: 'r-voidspire',
    bossId: 'b-lightblind',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M5_LIGHTBLIND,
    description: '',
    authorId: 'a-stt',
    isFeatured: true,
    viewCount: 15260,
    likeCount: 902,
    isHidden: false,
    createdAt: '2026-04-14',
    updatedAt: '2026-04-14',
  },
  {
    id: 'p-cosmos-h',
    title: '宇宙之冕 · H',
    raidId: 'r-voidspire',
    bossId: 'b-cosmos',
    difficulty: 'heroic',
    seasonVersion: 'S1',
    contentText: M6_AURELIA,
    description: '',
    authorId: 'a-stt',
    isFeatured: true,
    viewCount: 11920,
    likeCount: 688,
    isHidden: false,
    createdAt: '2026-05-07',
    updatedAt: '2026-05-07',
  },
  {
    id: 'p-averzian-m1',
    title: '元首阿福扎恩 · M',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M1_AVERZIAN,
    description: '',
    authorId: 'a-stt',
    isFeatured: false,
    viewCount: 9870,
    likeCount: 561,
    isHidden: false,
    createdAt: '2026-03-29',
    updatedAt: '2026-03-29',
  },
  {
    id: 'p-vorasius-m2',
    title: '弗拉希乌斯 · M',
    raidId: 'r-voidspire',
    bossId: 'b-vorasius',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M2_VORASIUS,
    description: '',
    authorId: 'a-stt',
    isFeatured: false,
    viewCount: 8640,
    likeCount: 503,
    isHidden: false,
    createdAt: '2026-03-30',
    updatedAt: '2026-03-30',
  },
  {
    id: 'p-salhadaar-m3',
    title: '陨落之王萨哈达尔 · M',
    raidId: 'r-voidspire',
    bossId: 'b-salhadaar',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M3_SALHADAAR,
    description: '',
    authorId: 'a-stt',
    isFeatured: false,
    viewCount: 7990,
    likeCount: 472,
    isHidden: false,
    createdAt: '2026-03-29',
    updatedAt: '2026-03-29',
  },
  {
    id: 'p-chimaerus-m7',
    title: '奇美鲁斯，未梦之神 · M',
    raidId: 'r-dreamrift',
    bossId: 'b-chimaerus',
    difficulty: 'mythic',
    seasonVersion: 'S1',
    contentText: M7_CHIMAERUS,
    description: '',
    authorId: 'a-stt',
    isFeatured: false,
    viewCount: 10240,
    likeCount: 638,
    isHidden: false,
    createdAt: '2026-03-28',
    updatedAt: '2026-03-28',
  },
]
