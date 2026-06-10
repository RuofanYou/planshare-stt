/**
 * PlanShare 数据模型（API 响应契约，所有页面与组件必须一致）。
 * 这些类型描述后端 /api/* 端点返回的 JSON 形状，与 server 严格对齐。
 */

/** 团本（如某个团队副本） */
export interface Raid {
  id: string
  name: string
  /** 版本号，如 "12.0.5" */
  patch: string
  /** 该团本未隐藏的板数（后端统计） */
  boardCount: number
}

/** 团本下的 BOSS */
export interface Boss {
  id: string
  raidId: string
  name: string
  /** 进度顺序，升序排列 */
  order: number
}

/** 战术板作者；公会字段可选，填了才在作者主页渲染引流卡 */
export interface Author {
  id: string
  name: string
  /** 头像地址；无图时用首字母占位 */
  avatarUrl?: string
  bio?: string
  /** 公会名（填了才渲染公会引流卡） */
  guildName?: string
  /** 招募说明 */
  guildRecruit?: string
  /** 联系方式（仅展示 / 可复制） */
  guildContact?: string
  creatorAccountId?: string
  visibility?: 'draft' | 'semi_public' | 'approved' | 'hidden'
  moderationStatus?: string
}

/** 难度：英雄 / 史诗（标签靠文字区分，不靠颜色） */
export type Difficulty = 'heroic' | 'mythic'

/** 一块战术板 = 一段可读的战术方案文本（隐藏板后端一律不返回，故无 isHidden 字段） */
export interface Board {
  id: string
  title: string
  raidId: string
  /** 所属 BOSS；历史数据可能为 null，新投稿 / 新上稿要求必须选择 BOSS */
  bossId: string | null
  difficulty: Difficulty
  /** 赛季 / 版本，如 "S3" */
  seasonVersion: string
  /** 战术正文（MRT/STN 风格，逐字呈现，保留换行） */
  contentText: string
  /** 可选导入码块 */
  importCode?: string
  /** 一行描述 */
  description: string
  authorId: string
  isFeatured: boolean
  /** 浏览量 */
  viewCount: number
  /** 点赞数 */
  likeCount: number
  /** ISO 日期字符串 */
  createdAt: string
  /** ISO 日期字符串 */
  updatedAt: string
}

/* ============================ API 响应封装类型 ============================ */

/** GET /api/raids/:id 响应 */
export interface RaidDetail {
  raid: Raid
  /** 该团本 BOSS 列表，按 order 升序 */
  bosses: Boss[]
}

/** GET /api/boards/:id 响应（含挂载的团本 / BOSS / 作者） */
export interface BoardDetail {
  board: Board
  raid: Raid
  /** 历史数据可能无 BOSS */
  boss: Boss | null
  author: Author
}

/** GET /api/authors/:id 响应 */
export interface AuthorDetail {
  author: Author
  /** 该作者未隐藏的板（已按默认规则排序） */
  boards: Board[]
}

/** POST /api/boards/:id/like 响应 */
export interface LikeResult {
  id: string
  likeCount: number
}

/** POST /api/boards 请求体（新建板，后端生成 id / 时间戳 / 计数） */
export interface CreateBoardInput {
  title: string
  raidId: string
  bossId: string | null
  difficulty: Difficulty
  seasonVersion: string
  contentText: string
  description: string
  authorId: string
  isFeatured: boolean
}

/** 游客投稿状态：pending 进入审核；approved/rejected/spam 为管理员处理结果。 */
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'spam'

/** POST /api/submissions 请求体：游客投稿，不会直接公开。 */
export interface CreateSubmissionInput {
  title: string
  raidId: string
  bossId: string | null
  difficulty: Difficulty
  seasonVersion: string
  description: string
  contentText: string
  submitterName: string
  contact?: string
  wantsCreatorProfile: boolean
  creatorUsername?: string
  creatorPassword?: string
  creatorAvatarUrl?: string
  creatorBio?: string
  creatorGuildName?: string
  creatorGuildRecruit?: string
  creatorGuildContact?: string
  website?: string
}

/** 管理员视角投稿：含联系方式与审核结果；公开站不读取此类型。 */
export interface AdminSubmission extends CreateSubmissionInput {
  id: string
  status: SubmissionStatus
  sourceKey?: string
  spamReason?: string
  reviewNote?: string
  boardId?: string
  authorId?: string
  creatorAuth?: CreatorAuthResult
  createdAt: string
  reviewedAt?: string
}

/** 创作者后台视角投稿进度：只展示自己的审核状态和处理结果。 */
export interface CreatorSubmission {
  id: string
  title: string
  raidId: string
  bossId: string | null
  difficulty: Difficulty
  status: SubmissionStatus
  reviewNote?: string
  spamReason?: string
  boardId?: string
  createdAt: string
  reviewedAt?: string
}

/** POST /api/admin/submissions/:id/approve 请求体。 */
export interface ApproveSubmissionInput {
  mode: 'existingAuthor' | 'createAuthor' | 'plainAuthor'
  authorId?: string
  authorName?: string
  avatarUrl?: string
  bio?: string
  guildName?: string
  guildRecruit?: string
  guildContact?: string
  isFeatured?: boolean
  note?: string
}

/** 投稿审核通过结果。 */
export interface ApproveSubmissionResult {
  submission: AdminSubmission
  board: Board
  author: Author
  creatorAccount: AdminCreatorAccount | null
}

export type ReportReason = 'spam' | 'abuse' | 'wrong-info' | 'copyright' | 'other'
export type ReportStatus = 'pending' | 'hidden' | 'dismissed'

export interface BoardReport {
  id: string
  boardId: string
  reason: ReportReason
  detail?: string
  status: ReportStatus
  resolutionNote?: string
  createdAt: string
  reviewedAt?: string
}

export interface AuditLog {
  id: string
  actorType: 'admin' | 'creator'
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  detail?: Record<string, unknown>
  createdAt: string
}

/* ============================ 管理员后台契约 ============================ */

/**
 * 管理员视角的板：在公开 Board 形状上多带 isHidden（隐藏板也会出现在后台列表）。
 * 公开列表永远不返回隐藏板，故公开 Board 无此字段；后台列表才需要。
 */
export interface AdminBoard extends Board {
  /** 是否对公开列表隐藏 */
  isHidden: boolean
}

/** 创作者后台视角的自己的板：与后台板一样需要看到下架状态。 */
export type CreatorBoard = AdminBoard

/** POST /api/creator/boards 请求体：authorId/isFeatured 由后端强制决定。 */
export type CreatorBoardInput = Omit<CreateBoardInput, 'authorId' | 'isFeatured'>

/** PUT /api/creator/boards/:id 请求体：创作者不能修改归属和精选。 */
export type UpdateCreatorBoardInput = Omit<UpdateBoardInput, 'authorId' | 'isFeatured'>

/**
 * 管理员视角的作者：在公开 Author 形状上多带 boardCount（含隐藏板的总数）。
 */
export interface AdminAuthor extends Author {
  /** 该作者名下板数 */
  boardCount: number
}

/** 管理员视角创作者账号：不包含密码哈希，只暴露运营所需信息。 */
export interface AdminCreatorAccount extends CreatorUser {
  author: AdminAuthor | null
}

/** POST /api/admin/creator-accounts/:id/reset-password 请求体。 */
export interface ResetCreatorPasswordInput {
  password: string
}

/** 管理员重置创作者密码响应。 */
export interface ResetCreatorPasswordResult {
  user: CreatorUser
  revokedSessions: boolean
}

/**
 * PUT /api/boards/:id 请求体：任意子集，后端按提供的字段增量更新并回最新 Board。
 * 全部可选，至少传一项；isHidden 仅后台可改。
 */
export interface UpdateBoardInput {
  title?: string
  raidId?: string
  bossId?: string | null
  difficulty?: Difficulty
  seasonVersion?: string
  contentText?: string
  description?: string
  authorId?: string
  isFeatured?: boolean
  isHidden?: boolean
}

/** POST /api/authors 请求体（新建作者，后端生成 id=a-xxx） */
export interface AuthorInput {
  name: string
  avatarUrl?: string
  bio?: string
  guildName?: string
  guildRecruit?: string
  guildContact?: string
}

/** PUT /api/authors/:id 请求体：AuthorInput 的任意子集 */
export type UpdateAuthorInput = Partial<AuthorInput>

/** POST /api/admin/login 响应 */
export interface AdminLoginResult {
  token: string
}

/** 用户名密码登录后的创作者账号。 */
export interface CreatorUser {
  id: string
  username: string
  status: 'active' | 'suspended'
  trustLevel?: 'review' | 'trusted'
  approvedSubmissionCount?: number
  authorId?: string
  contact?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

/** 创作者登录 / 注册响应。 */
export interface CreatorAuthResult {
  token: string
  user: CreatorUser
  author: Author | null
}

export interface CreatorProfileInput {
  name?: string
  avatarUrl?: string
  bio?: string
  guildName?: string
  guildRecruit?: string
  guildContact?: string
}

/** GET /api/creator/me 响应。 */
export interface CreatorMeResult {
  user: CreatorUser
  author: Author | null
}
