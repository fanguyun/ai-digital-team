export const RAFIKI_CREDIT = {
  label: 'Designed by Freepik',
  href: 'https://www.freepik.com',
}

export const RAFIKI_SCENES = {
  'team-work': {
    title: '团队协作',
    src: '/illustrations/rafiki/team-work.svg',
  },
  'time-management': {
    title: '时间安排',
    src: '/illustrations/rafiki/time-management.svg',
  },
  'career-progress': {
    title: '职业发展',
    src: '/illustrations/rafiki/career-progress.svg',
  },
  data: {
    title: '数据分析',
    src: '/illustrations/rafiki/data.svg',
  },
  'prototyping-process': {
    title: '产品设计',
    src: '/illustrations/rafiki/prototyping-process.svg',
  },
  'pair-programming': {
    title: '工程协作',
    src: '/illustrations/rafiki/pair-programming.svg',
  },
  'security-on': {
    title: '安全防护',
    src: '/illustrations/rafiki/security-on.svg',
  },
  'marketing-consulting': {
    title: '内容增长',
    src: '/illustrations/rafiki/marketing-consulting.svg',
  },
  investing: {
    title: '投资理财',
    src: '/illustrations/rafiki/investing.svg',
  },
  'online-learning': {
    title: '在线学习',
    src: '/illustrations/rafiki/online-learning.svg',
  },
  'training-at-home': {
    title: '居家训练',
    src: '/illustrations/rafiki/training-at-home.svg',
  },
  family: {
    title: '家庭陪伴',
    src: '/illustrations/rafiki/family.svg',
  },
}

export const AGENT_SCENE_IDS = {
  'main-agent': 'team-work',
  'personal-executive-assistant-agent': 'time-management',
  'project-manager-agent': 'time-management',
  'role-development-agent': 'career-progress',
  'career-talent-agent': 'career-progress',
  'business-strategy-agent': 'data',
  'user-research-agent': 'data',
  'research-knowledge-agent': 'data',
  'data-analyst-agent': 'data',
  'product-solution-agent': 'prototyping-process',
  'interaction-ui-designer-agent': 'prototyping-process',
  'design-engineer-agent': 'prototyping-process',
  'software-engineer-agent': 'pair-programming',
  'platform-operations-agent': 'pair-programming',
  'automation-tools-agent': 'pair-programming',
  'ai-application-engineer-agent': 'pair-programming',
  'qa-security-engineer-agent': 'security-on',
  'privacy-data-governance-agent': 'security-on',
  'legal-compliance-agent': 'security-on',
  'content-brand-agent': 'marketing-consulting',
  'growth-sales-agent': 'marketing-consulting',
  'customer-success-agent': 'marketing-consulting',
  'finance-operations-agent': 'investing',
  'investment-advisor-agent': 'investing',
  'learning-thinking-agent': 'online-learning',
  'health-longevity-agent': 'training-at-home',
  'family-parenting-agent': 'family',
}

const SCENE_BACKGROUND_IDS = [
  'background-complete',
  'background-simple',
  'simple-background',
  'detailed-background',
  'Shadow',
  'Shadows',
  'shadows',
]

export const stripSceneBackground = (svgText) => {
  if (typeof DOMParser === 'undefined') return svgText
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return svgText
  for (const id of SCENE_BACKGROUND_IDS) {
    doc.getElementById(id)?.remove()
  }
  return new XMLSerializer().serializeToString(doc)
}

export const sceneForAgent = (slug) => {
  const sceneId = AGENT_SCENE_IDS[slug] || 'team-work'
  return { id: sceneId, ...RAFIKI_SCENES[sceneId] }
}
