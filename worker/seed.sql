PRAGMA defer_foreign_keys = TRUE;
INSERT OR REPLACE INTO raids (id, name, patch) VALUES ('r-voidspire', '虚影尖塔', '12.0.0');
INSERT OR REPLACE INTO raids (id, name, patch) VALUES ('r-queldanas', '进军奎尔丹纳斯', '12.0.5');
INSERT OR REPLACE INTO raids (id, name, patch) VALUES ('r-dreamrift', '梦境裂隙', '12.0.7');
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-averzian', 'r-voidspire', '元首阿福扎恩', 1);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-vorasius', 'r-voidspire', '弗拉希乌斯', 2);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-salhadaar', 'r-voidspire', '陨落之王萨哈达尔', 3);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-vaelgor', 'r-voidspire', '威厄高尔和艾佐拉克', 4);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-lightblind', 'r-voidspire', '光盲先锋军', 5);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-cosmos', 'r-voidspire', '宇宙之冕', 6);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-beloren', 'r-queldanas', '贝洛朗，奥的子嗣', 1);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-midnight', 'r-queldanas', '至暗之夜降临', 2);
INSERT OR REPLACE INTO bosses (id, raid_id, name, "order") VALUES ('b-chimaerus', 'r-dreamrift', '奇美鲁斯，未梦之神', 1);
INSERT OR REPLACE INTO authors (id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact, creator_account_id, visibility, moderation_status, updated_at) VALUES ('a-stt', '圣糖刺客', NULL, NULL, NULL, NULL, NULL, NULL, 'approved', 'clean', NULL);
INSERT OR REPLACE INTO authors (id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact, creator_account_id, visibility, moderation_status, updated_at) VALUES ('a-nike', '妮可', NULL, NULL, NULL, NULL, NULL, NULL, 'approved', 'clean', NULL);
INSERT OR REPLACE INTO authors (id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact, creator_account_id, visibility, moderation_status, updated_at) VALUES ('a-d9448e91f091', '《星辰大海》工会STT格式战术板', NULL, '星辰大海 412 8:30-11:00 M8//9', '星辰大海', '招指挥 DPS', 'vx 15101013778', NULL, 'approved', 'clean', NULL);
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-mpwsi0t7-580z6c', '奎岛M凤凰', 'r-queldanas', 'b-beloren', 'mythic', '12.0.5', '{time:00:00} {BOSS}换色 {JLM1}福音 {奶僧1}青龙 {奶德1}万灵
{time:00:06} {BOSS}光球 {坦克}吃球 {奶僧1}天神
{time:00:18} {BOSS}虚空俯冲 {奶僧2}还魂 {增辉1}微风
{time:00:18} {BOSS}圣光俯冲
{time:00:19} {BOSS}单色震慑波
{time:00:20} {BOSS}射线 {LR2}龟壳吃球 {奶僧2}天神
{time:00:30} {BOSS}射线
{time:00:39} {BOSS}单色震慑波
{time:00:40} {BOSS}射线 {所有人}分散吃球
{time:00:51} {BOSS}换色 {奶僧2}青龙 {ZS1}集结
{time:00:56} {BOSS}光球 {坦克}吃球
{time:01:08} {BOSS}虚空俯冲 {奶德1}万灵 {增辉2}微风
{time:01:08} {BOSS}圣光俯冲
{time:01:10} {BOSS}射线 {LR1}龟壳吃球
{time:01:20} {BOSS}射线
{time:01:29} {BOSS}单色震慑波 {所有人}分散吃球
{time:01:30} {BOSS}射线
{time:01:40} {BOSS}换色 {奶僧1}还魂
{time:01:50} {BOSS}转阶段开始 点门 {JLM1}福音 {奶僧1}天神 {增辉1}螺旋
{time:02:07} {BOSS}光球 {坦克}吃球 {奶僧2}天神 {增辉2}螺旋 {奶德1}群奔 {奶德1}万灵
{time:02:30} {BOSS}转阶段结束 {DZ1}免疫吃球 {CJQ1}免疫吃球
{time:02:40} {BOSS}换色 {奶僧1}青龙 {奶德1}宁静 {咕咕1}群奔 {ZST1}集结 {DH1}黑暗 {DH2}黑暗
{time:02:46} {BOSS}光球 {坦克}吃球
{time:02:56} {BOSS}收缩光球
{time:02:58} {BOSS}虚空俯冲 {增辉1}微风
{time:02:58} {BOSS}圣光俯冲
{time:02:59} {BOSS}单色震慑波
{time:03:01} {BOSS}射线 {LR2}龟壳吃球
{time:03:03} {BOSS}双色震荡波
{time:03:10} {BOSS}射线
{time:03:20} {BOSS}单色震慑波 {所有人}分散吃球 {奶德1}万灵
{time:03:21} {BOSS}双射线
{time:03:22} {BOSS}单色震慑波
{time:03:30} {BOSS}换色 {奶僧2}还魂 {JLM1}福音 {奶僧1}天神
{time:03:36} {BOSS}光球 {坦克}吃球
{time:03:46} {BOSS}收缩光球
{time:03:50} {BOSS}虚空俯冲 {ZS1}集结 {增辉2}微风
{time:03:50} {BOSS}圣光俯冲
{time:03:51} {BOSS}射线 {LR1}龟壳吃球
{time:03:50} {BOSS}单色震慑波
{time:03:53} {BOSS}双色震荡波
{time:04:01} {BOSS}射线 {奶僧2}天神
{time:04:10} {BOSS}单色震慑波 {所有人}分散吃球
{time:04:11} {BOSS}射线
{time:04:13} {BOSS}双色震荡波
{time:04:19} {BOSS}换色 {奶僧2}青龙 {奶德1}万灵', NULL, 'M凤凰STT', 'a-d9448e91f091', 0, 0, 6, 0, '2026-06-02', '2026-06-02');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-mpwsv9zc-3shy0o', '尖塔M6宇宙之冕', 'r-voidspire', 'b-cosmos', 'mythic', '12.0.0', '小分队=SS1 SS2 咕咕1 FS1 元素1

{time:00:04} {BOSS}拉弓1 {所有人}远程往右 {JLM1}福音 {奶德1}万灵
{time:00:04} {BOSS}吸奶盾1 {奶龙1}飞行
{time:00:09} {BOSS}干扰震荡
{time:00:13} {BOSS}引水 {所有人}回大饼光柱
{time:00:20} {BOSS}银锋箭1 {所有人}空射 {奶僧1}天神 {DKT1}魔法罩
{time:00:21} {BOSS}1球爆炸 {治疗}驱散
{time:00:27} {BOSS}4球爆炸 {奶僧1}还魂 {增辉1}微风
{time:00:28} {BOSS}拉弓2 {所有人}远程去紫菱
{time:00:37} {BOSS}银锋箭2 {所有人}射阿尔 {奶德1}宁静
{time:00:41} {BOSS}吸奶盾2
{time:00:43} {BOSS}标准一号大怪死亡时间
{time:00:53} {BOSS}引水
{time:00:54} {BOSS}拉弓3 {所有人}没点名的点门
{time:00:56} {BOSS}银锋箭3 {所有人}空射 {奶僧1}青龙
{time:01:01} {BOSS}1球爆炸 {治疗}驱散 {JLM1}终极苦修 {奶德1}万灵
{time:01:07} {BOSS}4球爆炸 {奶龙1}微风 {ZST1}集结
{time:01:15} {BOSS}银锋箭4 {所有人}射乌姆
{time:01:21} {BOSS}吸奶盾3
{time:01:22} {BOSS}拉弓4 {所有人}远程贴内圈
{time:01:25} {BOSS}引水
{time:01:33} {BOSS}银锋箭5 {所有人}空射
{time:01:33} {BOSS}1球爆炸 {治疗}驱散
{time:01:39} {BOSS}4球爆炸 {奶龙1}回溯 {JLM1}福音 {增辉2}微风
{time:01:43} {BOSS}吸奶盾4
{time:01:43} {BOSS}拉弓5
{time:01:52} {BOSS}引水 {奶僧1}天神
{time:01:59} {BOSS}银锋箭6 {所有人}射卢思
{time:02:00} {BOSS}1球爆炸 {治疗}驱散 {奶德1}万灵 {DK1}魔法罩
{time:02:06} {BOSS}4球爆炸 {奶龙1}飞行 {ZS1}集结
{time:02:18} {BOSS}P1.5 {所有人}星星集合 {增辉1}螺旋
{time:02:24} {BOSS}1箭 {奶德1}群奔
{time:02:30} {BOSS}2箭 {增辉2}螺旋
{time:02:36} {BOSS}3箭 {元素1}狂风
{time:02:42} {BOSS}4箭
{time:02:43} {BOSS}P2
{time:02:55} {BOSS}虚空分身 {小分队}小分队打幻影
{time:02:59} {BOSS}虚空召唤
{time:03:04} {BOSS}拉弓1 {奶德1}万灵 {所有人}远程引水
{time:03:14} {BOSS}引水1 {JLM1}福音 {JLM1}拉卢克 {MS1}拉清补凉
{time:03:19} {BOSS}银锋箭1-26 {所有人}引拉弓
{time:03:22} {BOSS}1球爆炸 {奶僧1}青龙 {DKT1}魔法罩
{time:03:28} {BOSS}4球爆炸 {增辉1}微风
{time:03:29} {BOSS}拉弓2 {所有人}射影子，引水 {奶僧1}天神
{time:03:39} {BOSS}引水2
{time:03:43} {BOSS}银锋箭2-41 {所有人}引拉弓
{time:03:47} {BOSS}1球爆炸
{time:03:51} {BOSS}虚空召唤2
{time:03:53} {BOSS}4球爆炸 {奶龙1}微风 {奶僧1}还魂
{time:03:56} {BOSS}拉弓3 {所有人}射影子，引水
{time:04:06} {BOSS}引水3 远程大走引拉弓 {奶龙1}飞行 {奶德1}万灵
{time:04:10} {BOSS}银锋箭3-58 {所有人}引拉弓
{time:04:14} {BOSS}1球爆炸
{time:04:20} {BOSS}4球爆炸 {奶龙1}螺旋 {奶德1}宁静
{time:04:21} {BOSS}拉弓4 {所有人}射影子，点门 {JLM1}拉卢克 {MS1}拉清补凉
{time:04:31} {BOSS}引水4
{time:04:35} {BOSS}银锋箭4-73 {所有人}引拉弓
{time:04:39} {BOSS}1球爆炸 {奶龙1}回溯
{time:04:43} {BOSS}虚空召唤3 {ZST1}集结
{time:04:45} {BOSS}4球爆炸 {JLM1}福音 {增辉2}微风
{time:04:48} {BOSS}拉弓5 {所有人}射影子，引水
{time:04:58} {BOSS}引水
{time:05:02} {BOSS}银锋箭5-90 {所有人}引拉弓
{time:05:06} {BOSS}1球爆炸 {奶德1}万灵
{time:05:12} {BOSS}4球爆炸 {奶僧1}天神
{time:05:13} {BOSS}拉弓6 {所有人}射影子，引水
{time:05:23} {BOSS}引水 贴中圈转阶段
{time:05:32} {BOSS}P2.5
{time:05:39} {BOSS}内圈次元斩 {奶德1}群奔
{time:05:44} {BOSS}外圈次元斩
{time:05:45} {BOSS}P3 {所有人}骷髅集合 {增辉1}微风 {增辉2}去右台子
{time:05:55} {BOSS}终末守护 {所有人}DPS拉断 {ZS1}集结 {增辉1}螺旋
{time:05:57} {BOSS}拉弓1 {所有人}换场地 {奶龙1}抱水牛 {JLM1}落地拉卢克 {奶僧1}青龙 {MS1}落地拉清补凉 {增辉1}抱桃桃冰 {增辉2}抱小公主 {DK1}魔法罩
{time:06:05} {BOSS}拉弓2
{time:06:17} {BOSS}吸奶盾 {奶德1}万灵
{time:06:27} {BOSS}引水
{time:06:34} {BOSS}1球爆炸 {奶龙1}飞行
{time:06:37} {BOSS}终末守护2 {治疗}驱散
{time:06:40} {BOSS}4球爆炸 {JLM1}福音
{time:06:41} {BOSS}拉弓3 {增辉2}去右台子
{time:06:50} {BOSS}噬灭宇宙 {所有人}红叉集合
{time:06:55} {BOSS}终末守护3 {所有人}个减糖红 {增辉2}微风
{time:06:56} {BOSS}拉弓4 {所有人}拉弓判定点门 {增辉2}去骷髅 {JLM1}终极苦修 {奶僧1}天神 {DH1}黑暗 {DKT1}魔法罩
{time:07:05} {BOSS}拉弓5
{time:07:17} {BOSS}吸奶盾 {奶德1}万灵
{time:07:26} {BOSS}引水
{time:07:34} {BOSS}1球爆炸
{time:07:36} {BOSS}终末守护4 {治疗}驱散
{time:07:40} {BOSS}4球爆炸 {奶僧1}还魂 {增辉2}螺旋
{time:07:42} {BOSS}拉弓6 {所有人}找羽毛
{time:07:51} {BOSS}噬灭宇宙
{time:07:57} {BOSS}终末守护5 {ZST1}集结 {增辉1}微风
{time:07:58} {BOSS}拉弓7 {奶僧1}青龙 {奶德1}宁静 {DK1}魔法罩
{time:08:07} {BOSS}拉弓8 {奶龙1}回溯
{time:08:19} {BOSS}吸奶盾
{time:08:27} {BOSS}引水
{time:08:34} {BOSS}1球爆炸 {奶德1}万灵
{time:08:37} {BOSS}终末守护6 {治疗}驱散 {JLM1}福音
{time:08:40} {BOSS}4球爆炸 {奶龙1}飞行 {奶僧1}天神
{time:08:41} {BOSS}拉弓9 Rush', NULL, '尖塔M6宇宙之冕', 'a-d9448e91f091', 0, 0, 1, 0, '2026-06-02', '2026-06-02');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-midnight-m9', '至暗之夜降临 · M', 'r-queldanas', 'b-midnight', 'mythic', 'S1', '[方案]
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
{time:09:31.0} {BOSS}六芒星:{所有人}点名出人群', NULL, '', 'a-stt', 0, 1, 32142, 2186, '2026-05-29', '2026-05-29');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-beloren-nike', '贝洛朗，奥的子嗣 · M', 'r-queldanas', 'b-beloren', 'mythic', 'S1', '[方案]
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
{time:00:24,p1r2} {奶德}{spell:391528}', NULL, '', 'a-nike', 0, 0, 8232, 486, '2026-05-12', '2026-05-12');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-beloren-m8', '贝洛朗，奥的子嗣 · M', 'r-queldanas', 'b-beloren', 'mythic', 'S1', '[方案]
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
{time:05:10} {增辉2}{spell:374968}', NULL, '', 'a-stt', 0, 1, 17430, 1064, '2026-05-08', '2026-05-08');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-cosmos-h', '宇宙之冕 · H', 'r-voidspire', 'b-cosmos', 'heroic', 'S1', '[方案]
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
{time:08:51} {BOSS}{spell:1239080}7:{所有人}不拉', NULL, '', 'a-stt', 0, 1, 11920, 688, '2026-05-07', '2026-05-07');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-lightblind-m5', '光盲先锋军 · M', 'r-voidspire', 'b-lightblind', 'mythic', 'S1', '[方案]
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
{time:07:47} {BOSS}{spell:1246497}5:{治疗}注意驱散', NULL, '', 'a-stt', 0, 1, 15261, 902, '2026-04-14', '2026-04-14');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-vaelgor-m4', '威厄高尔和艾佐拉克（双龙）· M', 'r-voidspire', 'b-vaelgor', 'mythic', 'S1', '[方案]
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
{time:06:58} {BOSS}{spell:1244917}2:{ZS1}{spell:97462} {DKT1}群拉{DH1}控制{spell:196718}', NULL, '', 'a-stt', 0, 1, 19880, 1233, '2026-04-06', '2026-04-06');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-vorasius-m2', '弗拉希乌斯 · M', 'r-voidspire', 'b-vorasius', 'mythic', 'S1', '[方案]
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
{time:05:42} {BOSS}{spell:1257629}:{DKT}反魔法领域{DH1}{spell:196718}', NULL, '', 'a-stt', 0, 0, 8640, 503, '2026-03-30', '2026-03-30');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-averzian-m1', '元首阿福扎恩 · M', 'r-voidspire', 'b-averzian', 'mythic', 'S1', '[方案]
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
{time:06:42} {BOSS}点名{spell:1249266}:{奶萨1}{spell:114052}', NULL, '', 'a-stt', 0, 0, 9871, 561, '2026-03-29', '2026-03-29');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-salhadaar-m3', '陨落之王萨哈达尔 · M', 'r-voidspire', 'b-salhadaar', 'mythic', 'S1', '[方案]
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
{time:06:06} {BOSS}动荡:{小德2}{spell:77764}', NULL, '', 'a-stt', 0, 0, 7990, 472, '2026-03-29', '2026-03-29');
INSERT OR REPLACE INTO boards (id, title, raid_id, boss_id, difficulty, season_version, content_text, import_code, description, author_id, is_hidden, is_featured, view_count, like_count, created_at, updated_at) VALUES ('p-chimaerus-m7', '奇美鲁斯，未梦之神 · M', 'r-dreamrift', 'b-chimaerus', 'mythic', 'S1', '[方案]
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
{time:06:33} {BOSS}{spell:1245396}2:{DK1}反魔法领域{DH2}{spell:196718}', NULL, '', 'a-stt', 0, 0, 10240, 638, '2026-03-28', '2026-03-28');
INSERT OR REPLACE INTO submissions (id, title, raid_id, boss_id, difficulty, season_version, description, content_text, submitter_name, contact, wants_creator_profile, creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit, creator_guild_contact, status, source_key, review_note, board_id, author_id, created_at, reviewed_at) VALUES ('s-mpwt462m-43cc653a', '奎岛M至暗之夜', 'r-queldanas', 'b-midnight', 'mythic', '12.0.5', '奎岛M至暗之夜', '左边=ZST1 JLM1 奶僧2 增辉2 DK1 SS1 LR1 元素1 ZS1 DH2
右边=DKT1 奶德1 奶僧1 增辉1 FS1 SS2 CJQ1 DZ1 咕咕1 MS1
种子=DH1 DH2 SS1 SS2 增辉1 增辉2 MS1
[打断]
1:DZ1 MS1 增辉2 元素1
2:ZS1 CJQ1 DH2 LR1
3:DKT1 DK1 增辉1 FS1 SS1 SS2 DKT2 咕咕1
[时间轴]
{time:00:00} {BOSS}破碎天空 {DKT2}接boss
{time:00:06} {BOSS}终结棱柱 {JLM1}福音 {奶德1}万灵 {DKT1}魔法罩
{time:00:10} {BOSS}3黄6红 {JLM1}双拉水晶 {增辉1}抱水晶 {增辉2}抱水晶 {奶僧2}青龙 {奶僧1}天神 {奶德1}宁静 {DKT1}群拉 {DK1}单拉
{time:00:22} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:00:33} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:00:33,-0} {坦克}外1
{time:00:34,-0} {治疗}红2
{time:00:35,-0} {治疗}蓝3
{time:00:36,-0} {坦克}外4
{time:00:37,-0} {治疗}红5
{time:00:42} {BOSS}天穹之枪-DKT {DKT1}开减伤 {DKT2}准备嘲讽
{time:00:43} {种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:00:50} {BOSS}黯灭协奏 {奶僧1}还魂
{time:00:56} {BOSS}旋转射线 {奶德1}群奔
{time:01:02} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:01:08} {BOSS}终结棱柱 {JLM1}终极苦修 {奶德1}万灵 {DK1}魔法罩 {增辉2}螺旋 {ZS1}集结
{time:01:12} {BOSS}3黄6红 {JLM1}拉水晶 {MS1}拉水晶 {增辉1}抱水晶 {增辉2}抱水晶 {奶僧2}天神 {奶僧1}青龙 {DKT1}单拉 {DK1}单拉 {DKT2}群拉
{time:01:22} {BOSS}天穹之枪-DKT {DKT1}开减伤 {DKT2}准备嘲讽
{time:01:35} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:01:35,-0} {坦克}外1
{time:01:36,-0} {治疗}红2
{time:01:37,-0} {治疗}蓝3
{time:01:38,-0} {坦克}外4
{time:01:39,-0} {治疗}红5
{time:01:42} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:01:45} {种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:01:52} {BOSS}黯灭协奏 {奶僧1}天神
{time:01:58} {BOSS}旋转射线 {奶德1}群奔
{time:02:01} {BOSS}天穹之枪-DKT {DKT1}开减伤 {DKT2}准备嘲讽
{time:02:10} {BOSS}终结棱柱 {JLM1}福音 {奶德1}万灵 {DKT2}魔法罩
{time:02:14} {BOSS}9红 {奶僧2}青龙 {DKT1}群拉
{time:02:22} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:02:37} {所有人}{bar:5,tick:1,label:<鲁拉符文>}
{time:02:37,-0} {坦克}外1
{time:02:38,-0} {治疗}红2
{time:02:39,-0} {治疗}蓝3
{time:02:40,-0} {坦克}外4
{time:02:41,-0} {治疗}红5
{time:02:42} {BOSS}天穹之枪-DKT {DKT1}开减伤 {DKT2}准备嘲讽
{time:02:47} {种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:02:54} {BOSS}黯灭协奏 {奶僧2}天神  {元素1}狂风
{time:03:10} {BOSS}P1:{增辉2}抱ZST丢种子 {增辉1}抱DKT丢种子
{time:03:10} {BOSS}全蚀 {奶德1}万灵 {奶僧1}青龙
{time:03:20} {BOSS}全蚀 {增辉1}给空雅悖论
{time:03:22} {BOSS}全蚀 {奶德1}宁静
{time:03:36} {BOSS}群体射线 {所有人}个减糖红 {奶僧2}还魂
{time:03:45} {BOSS}P2 {坦克}把水晶给增辉
{time:03:49} {BOSS}深入黑暗之井
{time:03:58} {BOSS}充电读条 {所有人}光柱左侧分担 {JLM1}福音
{time:03:57} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:04} {BOSS}充电射线 {奶僧1}天神 {DKT1}魔法罩
{time:04:05} {BOSS}捡水晶 {种子}捡水晶 {所有人}提前分散 {咕咕1}群奔
{time:04:05} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:07} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:04:09} {BOSS}分散圈出现
{time:04:12} {BOSS}分散圈爆炸 {奶德1}万灵
{time:04:21} {所有人}{ct:3}核心收割 {奶僧2}青龙
{time:04:27} {BOSS}天穹之枪-DKT {DKT1}开减伤 {DKT2}准备嘲讽
{time:04:27} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:28} {BOSS}充电读条 {所有人}正光柱分担 {增辉2}螺旋
{time:04:33} {BOSS}扔水晶 {DK1}魔法罩
{time:04:34} {BOSS}充电射线 {奶僧2}天神 {奶德1}群奔
{time:04:35} {BOSS}捡水晶 {种子}捡水晶 {所有人}提前分散
{time:04:35} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:39} {BOSS}分散圈出现
{time:04:42} {BOSS}分散圈爆炸 {奶僧1}还魂
{time:04:47} {BOSS}天穹之枪-DKT2 {DKT2}开减伤 {DKT1}准备嘲讽
{time:04:51} {所有人}{ct:3}核心收割
{time:04:57} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:04:58} {BOSS}充电读条 {所有人}光柱右侧分担 {DH1}黑暗 {DH2}黑暗
{time:05:04} {BOSS}充电射线 {奶僧1}青龙 {增辉1}微风 {增辉2}微风 {元素1}狂风
{time:05:05} {BOSS}捡水晶 {种子}捡水晶 {所有人}提前分散
{time:05:05} {ct:5}{种子}{bar:5,spell:1253031,label:<扔下种子>}
{time:05:09} {BOSS}分散圈出现
{time:05:11} {BOSS}分散圈爆炸 {JLM1}终极苦修 {奶德1}万灵
{time:05:21} {BOSS}核心收割 {所有人}进P3站位 {咕咕1}群奔
{time:05:26} {BOSS}分散圈击退 {所有人}个减糖红 {增辉1}给桃桃冰悖论 {ZS1}集结
{time:05:30} {BOSS}P3
{time:05:30} {BOSS}黑暗熔毁 {所有人}接圈捡水晶 {JLM1}福音
{time:05:42} {BOSS}断离
{time:05:48} {左边}吸球
{time:05:50} {右边}分散，准备符文 {奶僧1}天神
{time:06:04} {所有人}嗜血
{time:06:08} {右边}吸球
{time:06:10} {左边}分散，准备符文
{time:06:11} {BOSS}天穹之枪 {坦克}开减伤 {奶德1}万灵
{time:06:20} {所有人}准备集合 {奶僧2}青龙 {奶德1}宁静
{time:06:31} {BOSS}黎明光障 {SS1}开水晶 {SS2}开水晶
{time:06:33} {BOSS}黑暗天使长1 {奶德1}群奔 {元素1}狂风
{time:06:41} {BOSS}天穹之枪 {坦克}开减伤 {奶僧1}给T绿罩 {奶僧2}给T绿罩
{time:06:43} {右边}吸球
{time:06:45} {左边}分散，准备符文
{time:07:03} {左边}吸球 {奶僧1}青龙 {增辉2}微风
{time:07:05} {右边}分散，准备符文 {JLM1}福音 {增辉1}微风
{time:07:11} {BOSS}天穹之枪 {坦克}开减伤
{time:07:20} {所有人}准备集合
{time:07:26} {BOSS}黎明光障 {奶僧2}还魂 {奶德1}万灵 {DH1}开水晶 {DH1}开水晶 {SS1}放门 {SS2}放门
{time:07:30} {BOSS}黑暗天使长2 {所有人}点门
{time:07:38} {左边}吸球 {奶僧2}天神
{time:07:40} {右边}分散,不合符文 {奶僧1}天神
{time:07:41} {BOSS}天穹之枪 {坦克}开减伤 {奶僧1}给T绿罩 {奶僧2}给T绿罩
{time:08:10} {BOSS}打进P4 {所有人}月亮集合
{time:08:20} {BOSS}重组 {增辉2}螺旋
{time:08:30} {BOSS}裂片1 {所有人}1左 {奶德1}万灵
{time:08:31} {BOSS}坦克清场 {坦克}清场
{time:08:32} {BOSS}裂片2 {所有人}2右 {奶僧2}青龙
{time:08:34} {BOSS}裂片3 {所有人}3左
{time:08:38} {BOSS}向右移动 {DZ1}撞魂 {奶僧1}还魂 {元素1}狂风
{time:08:42} {BOSS}天堂与地狱开始 {ZS1}集结
{time:08:47} {BOSS}天堂与地狱结束 停止移动 {JLM1}福音
{time:08:52} {BOSS}裂片1 {所有人}1左
{time:08:53} {BOSS}坦克清场 {坦克}清场
{time:08:54} {BOSS}裂片2 {所有人}2右
{time:08:56} {BOSS}裂片3 {所有人}3左
{time:09:00} {BOSS}向右移动 {LR1}撞魂 {奶德1}群奔
{time:09:02} {BOSS}天堂与地狱开始 {DKT2}魔法罩
{time:09:07} {BOSS}天堂与地狱结束 停止移动 {JLM1}终极苦修
{time:09:12} {BOSS}裂片1 {所有人}1左 {所有人}个减糖红
{time:09:13} {BOSS}坦克清场 {坦克}清场
{time:09:14} {BOSS}裂片2 {所有人}2右
{time:09:16} {BOSS}裂片3 {所有人}3左
{time:09:20} {BOSS}向右移动 {CJQ1}撞魂 {奶僧2}天神 {元素1}狂风
{time:09:22} {BOSS}天堂与地狱开始 {奶僧1}天神
{time:09:27} {BOSS}天堂与地狱结束 停止移动 {增辉1}给空雅悖论
{time:09:30} {奶德1}宁静
{time:09:32} {BOSS}裂片1 {所有人}1左 {奶僧1}青龙
{time:09:33} {BOSS}坦克清场 {坦克}清场
{time:09:34} {BOSS}裂片2 {所有人}2右 {奶德1}万灵
{time:09:36} {BOSS}裂片3 {所有人}3左
{time:09:38} {BOSS}至暗之夜永恒', '《星辰大海》工会STT格式战术板', NULL, 0, NULL, NULL, NULL, NULL, NULL, 'pending', '114.249.55.72', NULL, NULL, NULL, '2026-06-02T15:43:09.502Z', NULL);
INSERT OR REPLACE INTO submissions (id, title, raid_id, boss_id, difficulty, season_version, description, content_text, submitter_name, contact, wants_creator_profile, creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit, creator_guild_contact, status, source_key, review_note, board_id, author_id, created_at, reviewed_at) VALUES ('s-mpwsrnol-965e5f4e', '尖塔M6宇宙之冕', 'r-voidspire', 'b-cosmos', 'mythic', '12.0.0', '尖塔M6宇宙之冕', '小分队=SS1 SS2 咕咕1 FS1 元素1

{time:00:04} {BOSS}拉弓1 {所有人}远程往右 {JLM1}福音 {奶德1}万灵
{time:00:04} {BOSS}吸奶盾1 {奶龙1}飞行
{time:00:09} {BOSS}干扰震荡
{time:00:13} {BOSS}引水 {所有人}回大饼光柱
{time:00:20} {BOSS}银锋箭1 {所有人}空射 {奶僧1}天神 {DKT1}魔法罩
{time:00:21} {BOSS}1球爆炸 {治疗}驱散
{time:00:27} {BOSS}4球爆炸 {奶僧1}还魂 {增辉1}微风
{time:00:28} {BOSS}拉弓2 {所有人}远程去紫菱
{time:00:37} {BOSS}银锋箭2 {所有人}射阿尔 {奶德1}宁静
{time:00:41} {BOSS}吸奶盾2
{time:00:43} {BOSS}标准一号大怪死亡时间
{time:00:53} {BOSS}引水
{time:00:54} {BOSS}拉弓3 {所有人}没点名的点门
{time:00:56} {BOSS}银锋箭3 {所有人}空射 {奶僧1}青龙
{time:01:01} {BOSS}1球爆炸 {治疗}驱散 {JLM1}终极苦修 {奶德1}万灵
{time:01:07} {BOSS}4球爆炸 {奶龙1}微风 {ZST1}集结
{time:01:15} {BOSS}银锋箭4 {所有人}射乌姆
{time:01:21} {BOSS}吸奶盾3
{time:01:22} {BOSS}拉弓4 {所有人}远程贴内圈
{time:01:25} {BOSS}引水
{time:01:33} {BOSS}银锋箭5 {所有人}空射
{time:01:33} {BOSS}1球爆炸 {治疗}驱散
{time:01:39} {BOSS}4球爆炸 {奶龙1}回溯 {JLM1}福音 {增辉2}微风
{time:01:43} {BOSS}吸奶盾4
{time:01:43} {BOSS}拉弓5
{time:01:52} {BOSS}引水 {奶僧1}天神
{time:01:59} {BOSS}银锋箭6 {所有人}射卢思
{time:02:00} {BOSS}1球爆炸 {治疗}驱散 {奶德1}万灵 {DK1}魔法罩
{time:02:06} {BOSS}4球爆炸 {奶龙1}飞行 {ZS1}集结
{time:02:18} {BOSS}P1.5 {所有人}星星集合 {增辉1}螺旋
{time:02:24} {BOSS}1箭 {奶德1}群奔
{time:02:30} {BOSS}2箭 {增辉2}螺旋
{time:02:36} {BOSS}3箭 {元素1}狂风
{time:02:42} {BOSS}4箭
{time:02:43} {BOSS}P2
{time:02:55} {BOSS}虚空分身 {小分队}小分队打幻影
{time:02:59} {BOSS}虚空召唤
{time:03:04} {BOSS}拉弓1 {奶德1}万灵 {所有人}远程引水
{time:03:14} {BOSS}引水1 {JLM1}福音 {JLM1}拉卢克 {MS1}拉清补凉
{time:03:19} {BOSS}银锋箭1-26 {所有人}引拉弓
{time:03:22} {BOSS}1球爆炸 {奶僧1}青龙 {DKT1}魔法罩
{time:03:28} {BOSS}4球爆炸 {增辉1}微风
{time:03:29} {BOSS}拉弓2 {所有人}射影子，引水 {奶僧1}天神
{time:03:39} {BOSS}引水2
{time:03:43} {BOSS}银锋箭2-41 {所有人}引拉弓
{time:03:47} {BOSS}1球爆炸
{time:03:51} {BOSS}虚空召唤2
{time:03:53} {BOSS}4球爆炸 {奶龙1}微风 {奶僧1}还魂
{time:03:56} {BOSS}拉弓3 {所有人}射影子，引水
{time:04:06} {BOSS}引水3 远程大走引拉弓 {奶龙1}飞行 {奶德1}万灵
{time:04:10} {BOSS}银锋箭3-58 {所有人}引拉弓
{time:04:14} {BOSS}1球爆炸
{time:04:20} {BOSS}4球爆炸 {奶龙1}螺旋 {奶德1}宁静
{time:04:21} {BOSS}拉弓4 {所有人}射影子，点门 {JLM1}拉卢克 {MS1}拉清补凉
{time:04:31} {BOSS}引水4
{time:04:35} {BOSS}银锋箭4-73 {所有人}引拉弓
{time:04:39} {BOSS}1球爆炸 {奶龙1}回溯
{time:04:43} {BOSS}虚空召唤3 {ZST1}集结
{time:04:45} {BOSS}4球爆炸 {JLM1}福音 {增辉2}微风
{time:04:48} {BOSS}拉弓5 {所有人}射影子，引水
{time:04:58} {BOSS}引水
{time:05:02} {BOSS}银锋箭5-90 {所有人}引拉弓
{time:05:06} {BOSS}1球爆炸 {奶德1}万灵
{time:05:12} {BOSS}4球爆炸 {奶僧1}天神
{time:05:13} {BOSS}拉弓6 {所有人}射影子，引水
{time:05:23} {BOSS}引水 贴中圈转阶段
{time:05:32} {BOSS}P2.5
{time:05:39} {BOSS}内圈次元斩 {奶德1}群奔
{time:05:44} {BOSS}外圈次元斩
{time:05:45} {BOSS}P3 {所有人}骷髅集合 {增辉1}微风 {增辉2}去右台子
{time:05:55} {BOSS}终末守护 {所有人}DPS拉断 {ZS1}集结 {增辉1}螺旋
{time:05:57} {BOSS}拉弓1 {所有人}换场地 {奶龙1}抱水牛 {JLM1}落地拉卢克 {奶僧1}青龙 {MS1}落地拉清补凉 {增辉1}抱桃桃冰 {增辉2}抱小公主 {DK1}魔法罩
{time:06:05} {BOSS}拉弓2
{time:06:17} {BOSS}吸奶盾 {奶德1}万灵
{time:06:27} {BOSS}引水
{time:06:34} {BOSS}1球爆炸 {奶龙1}飞行
{time:06:37} {BOSS}终末守护2 {治疗}驱散
{time:06:40} {BOSS}4球爆炸 {JLM1}福音
{time:06:41} {BOSS}拉弓3 {增辉2}去右台子
{time:06:50} {BOSS}噬灭宇宙 {所有人}红叉集合
{time:06:55} {BOSS}终末守护3 {所有人}个减糖红 {增辉2}微风
{time:06:56} {BOSS}拉弓4 {所有人}拉弓判定点门 {增辉2}去骷髅 {JLM1}终极苦修 {奶僧1}天神 {DH1}黑暗 {DKT1}魔法罩
{time:07:05} {BOSS}拉弓5
{time:07:17} {BOSS}吸奶盾 {奶德1}万灵
{time:07:26} {BOSS}引水
{time:07:34} {BOSS}1球爆炸
{time:07:36} {BOSS}终末守护4 {治疗}驱散
{time:07:40} {BOSS}4球爆炸 {奶僧1}还魂 {增辉2}螺旋
{time:07:42} {BOSS}拉弓6 {所有人}找羽毛
{time:07:51} {BOSS}噬灭宇宙
{time:07:57} {BOSS}终末守护5 {ZST1}集结 {增辉1}微风
{time:07:58} {BOSS}拉弓7 {奶僧1}青龙 {奶德1}宁静 {DK1}魔法罩
{time:08:07} {BOSS}拉弓8 {奶龙1}回溯
{time:08:19} {BOSS}吸奶盾
{time:08:27} {BOSS}引水
{time:08:34} {BOSS}1球爆炸 {奶德1}万灵
{time:08:37} {BOSS}终末守护6 {治疗}驱散 {JLM1}福音
{time:08:40} {BOSS}4球爆炸 {奶龙1}飞行 {奶僧1}天神
{time:08:41} {BOSS}拉弓9 Rush', '《星辰大海》工会STT格式战术板', NULL, 0, NULL, NULL, NULL, NULL, NULL, 'approved', '114.249.55.72', NULL, 'p-mpwsv9zc-3shy0o', 'a-d9448e91f091', '2026-06-02T15:33:25.797Z', '2026-06-02T15:36:14.664Z');
INSERT OR REPLACE INTO submissions (id, title, raid_id, boss_id, difficulty, season_version, description, content_text, submitter_name, contact, wants_creator_profile, creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit, creator_guild_contact, status, source_key, review_note, board_id, author_id, created_at, reviewed_at) VALUES ('s-mpwsfx4x-9c80832c', '奎岛M凤凰', 'r-queldanas', 'b-beloren', 'mythic', '12.0.5', 'M凤凰STT', '{time:00:00} {BOSS}换色 {JLM1}福音 {奶僧1}青龙 {奶德1}万灵
{time:00:06} {BOSS}光球 {坦克}吃球 {奶僧1}天神
{time:00:18} {BOSS}虚空俯冲 {奶僧2}还魂 {增辉1}微风
{time:00:18} {BOSS}圣光俯冲
{time:00:19} {BOSS}单色震慑波
{time:00:20} {BOSS}射线 {LR2}龟壳吃球 {奶僧2}天神
{time:00:30} {BOSS}射线
{time:00:39} {BOSS}单色震慑波
{time:00:40} {BOSS}射线 {所有人}分散吃球
{time:00:51} {BOSS}换色 {奶僧2}青龙 {ZS1}集结
{time:00:56} {BOSS}光球 {坦克}吃球
{time:01:08} {BOSS}虚空俯冲 {奶德1}万灵 {增辉2}微风
{time:01:08} {BOSS}圣光俯冲
{time:01:10} {BOSS}射线 {LR1}龟壳吃球
{time:01:20} {BOSS}射线
{time:01:29} {BOSS}单色震慑波 {所有人}分散吃球
{time:01:30} {BOSS}射线
{time:01:40} {BOSS}换色 {奶僧1}还魂
{time:01:50} {BOSS}转阶段开始 点门 {JLM1}福音 {奶僧1}天神 {增辉1}螺旋
{time:02:07} {BOSS}光球 {坦克}吃球 {奶僧2}天神 {增辉2}螺旋 {奶德1}群奔 {奶德1}万灵
{time:02:30} {BOSS}转阶段结束 {DZ1}免疫吃球 {CJQ1}免疫吃球
{time:02:40} {BOSS}换色 {奶僧1}青龙 {奶德1}宁静 {咕咕1}群奔 {ZST1}集结 {DH1}黑暗 {DH2}黑暗
{time:02:46} {BOSS}光球 {坦克}吃球
{time:02:56} {BOSS}收缩光球
{time:02:58} {BOSS}虚空俯冲 {增辉1}微风
{time:02:58} {BOSS}圣光俯冲
{time:02:59} {BOSS}单色震慑波
{time:03:01} {BOSS}射线 {LR2}龟壳吃球
{time:03:03} {BOSS}双色震荡波
{time:03:10} {BOSS}射线
{time:03:20} {BOSS}单色震慑波 {所有人}分散吃球 {奶德1}万灵
{time:03:21} {BOSS}双射线
{time:03:22} {BOSS}单色震慑波
{time:03:30} {BOSS}换色 {奶僧2}还魂 {JLM1}福音 {奶僧1}天神
{time:03:36} {BOSS}光球 {坦克}吃球
{time:03:46} {BOSS}收缩光球
{time:03:50} {BOSS}虚空俯冲 {ZS1}集结 {增辉2}微风
{time:03:50} {BOSS}圣光俯冲
{time:03:51} {BOSS}射线 {LR1}龟壳吃球
{time:03:50} {BOSS}单色震慑波
{time:03:53} {BOSS}双色震荡波
{time:04:01} {BOSS}射线 {奶僧2}天神
{time:04:10} {BOSS}单色震慑波 {所有人}分散吃球
{time:04:11} {BOSS}射线
{time:04:13} {BOSS}双色震荡波
{time:04:19} {BOSS}换色 {奶僧2}青龙 {奶德1}万灵', '《星辰大海》工会STT格式战术板', 'vx 15101013778', 1, NULL, '星辰大海 412 8:30-11:00 M8//9', '星辰大海', '招指挥 DPS', 'vx 15101013778', 'approved', '114.249.55.72', NULL, 'p-mpwsi0t7-580z6c', 'a-d9448e91f091', '2026-06-02T15:24:18.177Z', '2026-06-02T15:25:56.251Z');
