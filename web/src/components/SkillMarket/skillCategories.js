import agentManifest from '../../../../agents/manifest.json'

/**
 * 插件市场的功能分类。
 *
 * 分类优先级（高 → 低）：
 *   1. 岗位技能：目录名命中 agents/manifest.json 的 slug → 该岗位所属分组
 *   2. 关键词规则：按 RULES 的书写顺序匹配 name + description
 *   3. 平台兜底：系统技能或 openai/codex 插件 → 平台与工具
 *   4. 其他
 *
 * 关键词表集中在这里，调参只需改 RULES。
 */

export const CATEGORY_ALL = '全部'
export const CATEGORY_PLATFORM = '平台与工具'
export const CATEGORY_OTHER = '其他'

export const GROUPS = Array.isArray(agentManifest.groups)
  ? agentManifest.groups
  : []

export const CATEGORY_ORDER = [
  CATEGORY_ALL,
  ...GROUPS,
  CATEGORY_PLATFORM,
  CATEGORY_OTHER,
]

/** 岗位技能：slug → 分组 */
const SLUG_TO_GROUP = new Map(
  (agentManifest.agents || []).map((agent) => [agent.slug, agent.group])
)

/** 顺序即优先级：越具体的分类越靠前 */
const RULES = [
  {
    category: '个人财富',
    keywords: [
      'invest',
      'portfolio',
      'dca',
      'stock',
      'wealth',
      'trading',
      'crypto',
      'asset allocation',
      '资产',
      '理财',
      '投资',
      '定投',
      '复利',
    ],
  },
  {
    category: '个人成长',
    keywords: [
      'learning',
      'book',
      'coach',
      'habit',
      'mindset',
      'reading',
      'journal',
      'reflection',
      '学习',
      '读书',
      '思维',
      '习惯',
      '复盘',
      '成长',
      'adhd',
      'life-reset',
      'life reset',
      'resilience',
      '宝典',
      '养育',
      '影响力',
      '通识',
      '如何工作',
      'cardio',
      'diet',
      'nutrition',
      'the-fool',
      '翻转人生',
      '周期',
    ],
  },
  {
    category: '增长经营',
    keywords: [
      'marketing',
      'growth',
      'sales',
      'seo',
      'copywriting',
      'copywrit',
      'campaign',
      'content',
      'social media',
      'brand',
      'lead generation',
      'crm',
      '营销',
      '增长',
      '销售',
      '文案',
      '投放',
      '获客',
      'humanizer',
      'copyedit',
      'persuasion',
      'cialdini',
      'influence',
    ],
  },
  {
    category: '设计体验',
    keywords: [
      'design system',
      'design',
      'figma',
      'css',
      'animation',
      'animate',
      'color',
      'canvas',
      'typography',
      'accessibility',
      'diagram',
      'illustration',
      'layout',
      'motion',
      'three.js',
      'visual',
      'ui',
      'ux',
      '3d',
      'gsap',
      'bolder',
      'delight',
      'distill',
      'polish',
      'colorize',
      'quieter',
      'baseline-ui',
      'adapt',
      'onboard',
      'clarify',
      'critique',
      'extract',
      'normalize',
      'optimize',
    ],
  },
  {
    category: '产品策略',
    keywords: [
      'product',
      'prd',
      'requirement',
      'roadmap',
      'user-research',
      'user research',
      'brainstorming',
      'domain-modeling',
      'strategy',
      '需求',
      '产品',
      '商业',
      '竞品',
    ],
  },
  {
    category: '后台支持',
    keywords: [
      'finance',
      'legal',
      'contract',
      'compliance',
      'invoice',
      'calendar',
      'meeting',
      'travel',
      'admin',
      '财务',
      '法务',
      '合同',
      '日程',
      '差旅',
    ],
  },
  {
    category: '工程交付',
    keywords: [
      'code',
      'refactor',
      'debugging',
      'debug',
      'database',
      'postgres',
      'graphql',
      'prisma',
      'react',
      'vue',
      'angular',
      'python',
      'rust',
      'golang',
      'typescript',
      'javascript',
      'docker',
      'kubernetes',
      'terraform',
      'devops',
      'security',
      'backend',
      'frontend',
      'fullstack',
      'microservice',
      'cli',
      'git',
      'testing',
      'test',
      'architecture',
      '工程',
      '代码',
      '测试',
      'openspec',
      'flutter',
      'laravel',
      'django',
      'rails',
      'swift',
      'kotlin',
      'legacy',
      'pipeline',
      'changelog',
      'handoff',
      'harden',
      'i18n',
      'websocket',
      'mlflow',
      'ml-pipeline',
      'ponytail',
    ],
  },
  {
    category: CATEGORY_PLATFORM,
    keywords: [
      'stripe',
      'twilio',
      'supabase',
      'vercel',
      'cloudflare',
      'notion',
      'slack',
      'github',
      'atlassian',
      'jira',
      'mcp',
      'playwright',
      'firecrawl',
      'pdf',
      'docx',
      'xlsx',
      'pptx',
      'summarize',
      'imagegen',
      'video',
      '12306',
      'gws',
      'job-hunt',
      'caveman',
      'find-skills',
      'academic-research',
      'hypit',
      'skill-creator',
      'skill-pake',
      'superpowers',
      'your-skill-name',
      'writing-for-agents',
      'scientific-writing',
      'yike-photo',
    ],
  },
]

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 拉丁字母关键词按词边界匹配，避免 "ui" 命中 "build"、"go" 命中 "google"；
 * 中文关键词按子串匹配。
 */
const toPatternSource = (keyword) => {
  const escaped = escapeForRegExp(keyword.toLowerCase())
  const isLatin = /^[a-z0-9][a-z0-9 ._-]*$/.test(keyword.toLowerCase())
  if (!isLatin) return escaped
  return `(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`
}

const COMPILED_RULES = RULES.map((rule) => ({
  category: rule.category,
  pattern: new RegExp(rule.keywords.map(toPatternSource).join('|'), 'i'),
}))

const folderName = (skillPath) =>
  String(skillPath || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || ''

const groupOfTeamSkill = (skill) =>
  SLUG_TO_GROUP.get(folderName(skill.path)) || null

const isPlatformSkill = (skill) => {
  const normalized = String(skill.path || '').replaceAll('\\', '/')
  return /\/(openai-|codex-warp|openai-bundled)/.test(normalized)
}

export const categoryOf = (skill) => {
  if (!skill) return CATEGORY_OTHER

  const teamGroup = groupOfTeamSkill(skill)
  if (teamGroup) return teamGroup

  const haystack =
    `${skill.name || ''} ${skill.description || ''}`.toLowerCase()
  for (const rule of COMPILED_RULES) {
    if (rule.pattern.test(haystack)) return rule.category
  }

  return isPlatformSkill(skill) ? CATEGORY_PLATFORM : CATEGORY_OTHER
}

/** 一次性算出 skillId → 分类，供列表过滤复用 */
export const mapCategories = (skills = []) => {
  const result = new Map()
  for (const skill of skills) {
    result.set(skill.id, categoryOf(skill))
  }
  return result
}

/**
 * 生成 Tab 列表：以「全部」开头，按 CATEGORY_ORDER 排序，只保留有内容的分类。
 */
export const buildTabs = (skills = [], categoryMap = mapCategories(skills)) => {
  const counts = new Map()
  for (const skill of skills) {
    const category = categoryMap.get(skill.id) || CATEGORY_OTHER
    counts.set(category, (counts.get(category) || 0) + 1)
  }

  const tabs = [
    {
      key: CATEGORY_ALL,
      count: skills.length,
      label: `${CATEGORY_ALL} ${skills.length}`,
    },
  ]

  for (const category of [...GROUPS, CATEGORY_PLATFORM, CATEGORY_OTHER]) {
    const count = counts.get(category) || 0
    if (count > 0) {
      tabs.push({ key: category, count, label: `${category} ${count}` })
    }
  }

  return tabs
}
