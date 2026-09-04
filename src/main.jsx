import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const agents = [
  {
    id: 'main',
    name: '数字总经理',
    en: 'Main Agent',
    group: '管理中枢',
    color: '#6857e8',
    icon: '✦',
    role: '默认入口、任务路由、跨岗位协作与结果整合。',
    skills: ['路由协调', '任务拆解', '结果整合'],
    status: '在线',
    trigger: '所有未指定岗位的复杂任务'
  },
  {
    id: 'product',
    name: '产品与解决方案负责人',
    en: 'Product & Solution Agent',
    group: '产品策略',
    color: '#df6a45',
    icon: '◈',
    role: '把业务想法整理成可直接交给大模型实现的 Markdown PRD。',
    skills: ['spec-miner', 'domain-modeling', 'PRD 设计'],
    status: '在线',
    trigger: '需求分析、产品方案、功能规划'
  },
  {
    id: 'ui',
    name: '交互 UI 设计师',
    en: 'Interaction UI Designer Agent',
    group: '设计体验',
    color: '#278f88',
    icon: '⌘',
    role: '从产品需求形成页面结构、交互和视觉方案。',
    skills: ['ui-ux-pro-max', 'frontend-design', 'web-design-guidelines'],
    status: '在线',
    trigger: '页面设计、交互优化、UI 审查'
  },
  {
    id: 'design',
    name: '设计实现工程师',
    en: 'Design Engineer Agent',
    group: '设计体验',
    color: '#1b73a5',
    icon: '▣',
    role: '将 Figma、设计源文件、截图或图片精准还原为前端页面。',
    skills: [
      'figma-implement-design',
      'image-to-code-skill',
      'frontend-design'
    ],
    status: '在线',
    trigger: 'Figma、截图还原、素材映射'
  },
  {
    id: 'software',
    name: '软件工程师',
    en: 'Software Engineer Agent',
    group: '工程交付',
    color: '#3c6edb',
    icon: '⌁',
    role: '负责架构选型、接口设计、代码实现、测试与工程排障。',
    skills: ['architecture-designer', 'api-designer', 'typescript-pro'],
    status: '在线',
    trigger: '架构、接口、代码实现、工程排障'
  },
  {
    id: 'qa',
    name: '质量与安全工程师',
    en: 'QA & Security Engineer Agent',
    group: '工程交付',
    color: '#c04e75',
    icon: '✓',
    role: '用可复现证据验证功能质量与安全风险，为发布提供独立判断。',
    skills: ['test-master', 'webapp-testing', 'project-security-scan'],
    status: '在线',
    trigger: '功能验收、安全审查、发布门禁'
  },
  {
    id: 'platform',
    name: '平台与运维工程师',
    en: 'Platform & Operations Engineer',
    group: '工程交付',
    color: '#267b68',
    icon: '⌂',
    role: '负责上线、基础设施、监控告警、备份恢复与长期运维。',
    skills: ['devops-engineer', 'sre-engineer', 'monitoring-expert'],
    status: '在线',
    trigger: '上线、监控、备份、容量和运维'
  },
  {
    id: 'research',
    name: '研究与知识管理',
    en: 'Research & Knowledge Agent',
    group: '增长经营',
    color: '#9a6b32',
    icon: '⌕',
    role: '用可靠来源和清晰结构，把外部信息整理成可复用资产。',
    skills: ['research', 'spec-miner', 'weread-skills'],
    status: '在线',
    trigger: '行业研究、竞品分析、知识库'
  },
  {
    id: 'content',
    name: '内容与品牌运营',
    en: 'Content & Brand Agent',
    group: '增长经营',
    color: '#c54e63',
    icon: '✎',
    role: '把研究和真实经验转化为一致、可信的品牌内容。',
    skills: ['copywriting', 'brandkit', 'seo-audit'],
    status: '在线',
    trigger: '公众号、小红书、官网与案例'
  },
  {
    id: 'growth',
    name: '增长与销售',
    en: 'Growth & Sales Agent',
    group: '增长经营',
    color: '#d27c2b',
    icon: '↗',
    role: '将目标客户、获客线索和沟通机会整理成可执行动作。',
    skills: ['research', 'copywriting', '线索优先级'],
    status: '在线',
    trigger: '获客、线索、报价、销售跟进'
  },
  {
    id: 'customer',
    name: '客户成功与交付',
    en: 'Customer Success Agent',
    group: '增长经营',
    color: '#397a9f',
    icon: '◌',
    role: '把客户承诺、交付过程和反馈风险整理成可追踪协作。',
    skills: ['to-questionnaire', 'handoff', 'writing-for-agents'],
    status: '在线',
    trigger: '需求澄清、交付计划、验收跟踪'
  },
  {
    id: 'finance',
    name: '财务与行政',
    en: 'Finance & Operations Agent',
    group: '后台支持',
    color: '#7b6b4b',
    icon: '¥',
    role: '用准确、可追溯的记录支持收支、合同和经营决策。',
    skills: ['xlsx', 'gws-docs', '经营分析'],
    status: '在线',
    trigger: '记账、报价、合同、回款、成本'
  },
  {
    id: 'automation',
    name: '自动化与工具工程师',
    en: 'Automation & Tools Agent',
    group: '后台支持',
    color: '#515d8c',
    icon: '⚙',
    role: '将重复工作转化为可控、可审计、可回退的自动化工具。',
    skills: ['mcp-developer', 'mcp-builder', 'cli-developer'],
    status: '在线',
    trigger: '工作流、MCP、脚本、CLI、内部工具'
  },
  {
    id: 'data',
    name: '数据分析师',
    en: 'Data Analyst Agent',
    group: '后台支持',
    color: '#3e8a83',
    icon: '▥',
    role: '用明确口径和可复核证据，把数据转化为经营判断。',
    skills: ['pandas-pro', 'xlsx', 'database-optimizer'],
    status: '在线',
    trigger: '指标、报表、转化率、经营洞察'
  },
  {
    id: 'project',
    name: '项目管理',
    en: 'Project Manager Agent',
    group: '后台支持',
    color: '#6a668f',
    icon: '◫',
    role: '让任务、依赖、里程碑和风险持续可见，推动交付闭环。',
    skills: ['writing-plans', 'handoff', 'to-questionnaire'],
    status: '在线',
    trigger: '任务、里程碑、进度、依赖、风险'
  }
];

const groups = [
  '全部岗位',
  '管理中枢',
  '产品策略',
  '设计体验',
  '工程交付',
  '增长经营',
  '后台支持'
];

const agentPaths = {
  main: 'main-agent', product: 'product-solution-agent', ui: 'interaction-ui-designer-agent',
  design: 'design-engineer-agent', software: 'software-engineer-agent', qa: 'qa-security-engineer-agent',
  platform: 'platform-operations-agent', research: 'research-knowledge-agent', content: 'content-brand-agent',
  growth: 'growth-sales-agent', customer: 'customer-success-agent', finance: 'finance-operations-agent',
  automation: 'automation-tools-agent', data: 'data-analyst-agent', project: 'project-manager-agent'
};

const agentDocuments = import.meta.glob('../agents/*/AGENTS.md', {
  eager: true,
  import: 'default',
  query: '?raw'
});

const workflowStages = [
  { label: '需求进入', agent: '数字总经理', detail: '识别目标、边界与最合适的岗位', state: 'done' },
  { label: '方案拆解', agent: '产品与解决方案负责人', detail: '整理输入并形成可执行 PRD', state: 'done' },
  { label: '设计与实现', agent: '交互 UI / 软件工程', detail: '页面、架构与功能协同交付', state: 'active' },
  { label: '验收发布', agent: '质量与安全 / 平台与运维', detail: '验证质量、风险与上线状态', state: 'next' }
];

const activityRecords = [
  { time: '刚刚', title: '团队总览页面已打开', agent: '数字总经理', skill: '路由协调', status: '已完成', tone: 'success' },
  { time: '今天 16:42', title: '读取设计实现工程师规则', agent: '设计实现工程师', skill: 'figma-implement-design', status: '已完成', tone: 'success' },
  { time: '今天 16:18', title: '生成个人数字团队 PRD 草稿', agent: '产品与解决方案负责人', skill: 'spec-miner', status: '待确认', tone: 'warning' },
  { time: '昨天 20:05', title: '检查项目依赖与安全边界', agent: '质量与安全工程师', skill: 'project-security-scan', status: '已完成', tone: 'success' }
];

function WorkflowView() {
  return (
    <section className="workspace-view">
      <div className="page-intro">
        <div><div className="section-kicker">COLLABORATION FLOW</div><h1>协作流程</h1><p>把一个想法，从输入推进到可验证、可运营的交付结果。</p></div>
        <span className="live-badge"><i /> 本地演示流程</span>
      </div>
      <div className="flow-board">
        {workflowStages.map((stage, index) => <div className={`flow-stage ${stage.state}`} key={stage.label}>
          <div className="flow-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="flow-state">{stage.state === 'done' ? '已完成' : stage.state === 'active' ? '进行中' : '待开始'}</div>
          <h2>{stage.label}</h2><strong>{stage.agent}</strong><p>{stage.detail}</p>
          {index < workflowStages.length - 1 && <span className="flow-connector" aria-hidden="true">→</span>}
        </div>)}
      </div>
      <div className="collab-note"><span>i</span><p>真实任务接入后，这里会显示当前任务、输入输出、确认节点和交接记录；当前内容是静态演示数据。</p></div>
    </section>
  );
}

function ActivityView() {
  const [filter, setFilter] = useState('全部');
  const records = filter === '全部' ? activityRecords : activityRecords.filter((record) => record.status === filter);
  return (
    <section className="workspace-view">
      <div className="page-intro">
        <div><div className="section-kicker">ACTIVITY LOG</div><h1>运行记录</h1><p>查看 Agent 与 Skill 的调用轨迹、状态和待确认动作。</p></div>
        <button className="refresh-button" onClick={() => window.location.reload()}>↻ 刷新记录</button>
      </div>
      <div className="activity-toolbar"><span>最近活动</span><div>{['全部', '已完成', '待确认'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="activity-list">{records.map((record) => <article className="activity-row" key={`${record.time}-${record.title}`}><div className="activity-time">{record.time}</div><div className={`activity-marker ${record.tone}`} /><div className="activity-main"><h2>{record.title}</h2><p><strong>{record.agent}</strong><span>使用 {record.skill}</span></p></div><span className={`activity-status ${record.tone}`}>{record.status}</span></article>)}{records.length === 0 && <div className="activity-empty">暂无匹配的运行记录</div>}</div>
      <div className="collab-note"><span>i</span><p>运行记录暂使用本地模拟数据；接入真实执行引擎后，可补充耗时、输入摘要、输出链接与错误详情。</p></div>
    </section>
  );
}

function Icon({ children }) {
  return (
    <span className="icon-glyph" aria-hidden="true">
      {children}
    </span>
  );
}

function MarkdownDocument({ content }) {
  return (
    <div className="markdown-document">
      {content.split(/\r?\n/).map((line, index) => {
        if (!line.trim()) return <div className="md-spacer" key={index} />;
        if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>;
        if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
        if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>;
        if (/^\d+\. /.test(line)) return <li key={index}>{line.replace(/^\d+\. /, '')}</li>;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

function App() {
  const [workspaceView, setWorkspaceView] = useState('overview');
  const [activeGroup, setActiveGroup] = useState('全部岗位');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('main');
  const [showSkills, setShowSkills] = useState(false);
  const [documentState, setDocumentState] = useState({ open: false, loading: false, content: '', error: '' });

  const filtered = useMemo(
    () =>
      agents.filter((agent) => {
        const inGroup =
          activeGroup === '全部岗位' || agent.group === activeGroup;
        const text =
          `${agent.name} ${agent.en} ${agent.role} ${agent.skills.join(' ')}`.toLowerCase();
        return inGroup && text.includes(query.toLowerCase());
      }),
    [activeGroup, query]
  );

  const selected = agents.find((agent) => agent.id === selectedId) || agents[0];

  const openAgentDocument = async () => {
    setDocumentState({ open: true, loading: true, content: '', error: '' });
    try {
      const documentPath = `../agents/${agentPaths[selected.id]}/AGENTS.md`;
      let content = agentDocuments[documentPath];
      if (!content) {
        const response = await fetch(`/agents/${agentPaths[selected.id]}/AGENTS.md`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        content = new TextDecoder('utf-8').decode(buffer);
      }
      setDocumentState({ open: true, loading: false, content, error: '' });
    } catch (error) {
      setDocumentState({ open: true, loading: false, content: '', error: `暂时无法读取岗位规则（${error.message}）。请确认应用运行在项目根目录。` });
    }
  };

  return (
    <div className={`app-shell view-${workspaceView}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span>PD</span>
          </div>
          <div>
            <strong>PERSONAL</strong>
            <small>DIGITAL TEAM</small>
          </div>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-dot" /> <span>我的数字公司</span>
          <span className="chevron">⌄</span>
        </div>
        <nav className="side-nav" aria-label="团队导航">
          <div className="nav-caption">工作台</div>
          <button className={`nav-item ${workspaceView === 'overview' ? 'active' : ''}`} onClick={() => setWorkspaceView('overview')}>
            <Icon>▦</Icon> 团队总览 <span className="nav-count">15</span>
          </button>
          <button className={`nav-item ${workspaceView === 'workflow' ? 'active' : ''}`} onClick={() => setWorkspaceView('workflow')}>
            <Icon>↗</Icon> 协作流程
          </button>
          <button className={`nav-item ${workspaceView === 'runs' ? 'active' : ''}`} onClick={() => setWorkspaceView('runs')}>
            <Icon>⌁</Icon> 运行记录
          </button>
          <div className="nav-caption separated">管理</div>
          <button className="nav-item">
            <Icon>＋</Icon> 新增 Agent
          </button>
          <button className="nav-item">
            <Icon>⚙</Icon> 团队设置
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sync-status">
            <span className="pulse" /> 所有系统正常
          </div>
          <div className="profile">
            <div className="avatar">F</div>
            <div>
              <strong>Fan</strong>
              <small>团队所有者</small>
            </div>
            <span className="more">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {workspaceView === 'overview' ? <>
        <header className="topbar">
          <div className="breadcrumbs">
            <span>工作台</span>
            <b>/</b>
            <strong>团队总览</strong>
          </div>
          <div className="top-actions">
            <div className="status-chip">
              <span className="pulse" /> 系统在线
            </div>
            <button className="round-action" aria-label="通知">
              ♢<i />
            </button>
            <button className="round-action" aria-label="设置">
              ⚙
            </button>
          </div>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">
              OPERATING SYSTEM <span>·</span> 2026
            </div>
            <h1>
              一个人的公司，
              <br />
              <em>一支数字团队。</em>
            </h1>
            <p>
              把长期职责交给稳定的
              Agent，让每一次想法都能被研究、设计、实现并持续运营。
            </p>
            <div className="hero-meta">
              <span>
                <b>{agents.length}</b> 个数字岗位
              </span>
              <span className="meta-divider" />
              <span>
                <b>48</b> 个已连接 Skill
              </span>
              <span className="meta-divider" />
              <span>
                <b>100%</b> 可迭代
              </span>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-core">
              <span>PD</span>
              <small>
                COMMAND
                <br />
                CENTER
              </small>
            </div>
            <div className="orbit-node node-a">◈</div>
            <div className="orbit-node node-b">⌁</div>
            <div className="orbit-node node-c">✦</div>
            <div className="orbit-label label-a">研究 · 设计 · 交付</div>
            <div className="orbit-label label-b">持续运转</div>
          </div>
        </section>

        <section className="directory-section">
          <div className="section-heading">
            <div>
              <div className="section-kicker">TEAM DIRECTORY</div>
              <h2>
                角色成员 <span>({filtered.length})</span>
              </h2>
            </div>
            <div className="directory-tools">
              <label className="search-box">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索角色或 Skill"
                />
              </label>
              <button
                className={`view-toggle ${showSkills ? 'selected' : ''}`}
                onClick={() => setShowSkills(!showSkills)}
              >
                <span>☷</span> {showSkills ? '收起 Skill' : '显示 Skill'}
              </button>
            </div>
          </div>
          <div className="filter-row">
            {groups.map((group) => (
              <button
                key={group}
                className={activeGroup === group ? 'filter active' : 'filter'}
                onClick={() => setActiveGroup(group)}
              >
                {group}
                {group === '全部岗位' && <span>{agents.length}</span>}
              </button>
            ))}
          </div>
          <div className="agent-grid">
            {filtered.map((agent) => (
              <article
                className={`agent-card ${selectedId === agent.id ? 'selected' : ''}`}
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
                tabIndex="0"
                onKeyDown={(event) =>
                  event.key === 'Enter' && setSelectedId(agent.id)
                }
              >
                <div className="card-top">
                  <div
                    className="agent-icon"
                    style={{
                      background: `${agent.color}14`,
                      color: agent.color
                    }}
                  >
                    {agent.icon}
                  </div>
                  <span className="online-dot" />
                </div>
                <div className="agent-group">{agent.group}</div>
                <h3>{agent.name}</h3>
                <p className="agent-en">{agent.en}</p>
                <p className="agent-role">{agent.role}</p>
                {showSkills && (
                  <div className="skill-list">
                    {agent.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                )}
                <div className="card-footer">
                  <span>
                    <i className="mini-pulse" /> {agent.status}
                  </span>
                  <span className="arrow">↗</span>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <h3>没有匹配的角色</h3>
              <p>换个关键词，或清除当前筛选。</p>
              <button
                onClick={() => {
                  setQuery('');
                  setActiveGroup('全部岗位');
                }}
              >
                清除筛选
              </button>
            </div>
          )}
        </section>
        </> : workspaceView === 'workflow' ? <WorkflowView /> : <ActivityView />}
      </main>

      <aside className="detail-panel">
        <div className="detail-head">
          <span>ROLE PROFILE</span>
          <button aria-label="更多选项">···</button>
        </div>
        <div className="detail-hero">
          <div
            className="detail-icon"
            style={{ background: `${selected.color}14`, color: selected.color }}
          >
            {selected.icon}
          </div>
          <span className="detail-online">
            <i /> {selected.status}
          </span>
        </div>
        <h2>{selected.name}</h2>
        <p className="detail-en">{selected.en}</p>
        <div className="detail-rule" />
        <div className="detail-block">
          <span className="detail-label">岗位使命</span>
          <p>{selected.role}</p>
        </div>
        <div className="detail-block">
          <span className="detail-label">触发条件</span>
          <div className="trigger-box">{selected.trigger}</div>
        </div>
        <div className="detail-block">
          <div className="detail-label-row">
            <span className="detail-label">已连接 Skill</span>
            <span className="skill-total">{selected.skills.length} 项</span>
          </div>
          <div className="detail-skills">
            {selected.skills.map((skill) => (
              <span key={skill}>
                <b>✦</b>
                {skill}
              </span>
            ))}
          </div>
        </div>
        <button className="open-agent" onClick={openAgentDocument}>
          打开 Agent <span>↗</span>
        </button>
        <div className="detail-note">
          <span>i</span> 所有岗位遵循团队公共边界与确认机制。
        </div>
      </aside>
      {documentState.open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDocumentState((state) => ({ ...state, open: false }))}>
          <section className="agent-modal" role="dialog" aria-modal="true" aria-labelledby="agent-document-title">
            <header className="modal-header">
              <div><span className="modal-kicker">AGENT RULEBOOK</span><h2 id="agent-document-title">{selected.name}</h2><p>{selected.en}</p></div>
              <button className="modal-close" onClick={() => setDocumentState((state) => ({ ...state, open: false }))} aria-label="关闭">×</button>
            </header>
            <div className="modal-body">{documentState.loading ? <div className="modal-loading"><span className="pulse" /> 正在读取岗位规则…</div> : documentState.error ? <div className="modal-error">{documentState.error}</div> : <MarkdownDocument content={documentState.content} />}</div>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
