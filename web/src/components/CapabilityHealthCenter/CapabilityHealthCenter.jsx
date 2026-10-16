import { useMemo, useState } from 'react'

import { Alert, Button, Card, Flex, Segmented, Tag, Typography } from 'antd'
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Link2Off,
  Menu,
  PlugZap,
  RefreshCw,
  TerminalSquare,
  Wrench,
} from 'lucide-react'

import { useQuery } from '@cedarjs/web'

const CAPABILITY_HEALTH_QUERY = gql`
  query CapabilityHealthCenter {
    capabilityHealth {
      generatedAt
      cli {
        id
        name
        status
        path
        message
      }
      reports {
        platform
        generatedAt
        summary {
          total
          complete
          partial
          notInstalled
          unbound
        }
        agents {
          slug
          name
          status
          platformSupported
          agentInstalled
          missingRequiredSkills
          missingOptionalSkills
          missingRequiredTools
          unboundRequiredSkills
          suggestions
        }
      }
    }
    runtimeHealth {
      database {
        status
        message
      }
      realtime {
        status
        message
      }
      serverTime
    }
    installedSkills {
      id
      name
      updatable
    }
  }
`

const platformLabel = {
  codex: 'Codex',
  'deepseek-harness': 'DeepSeek Harness',
}
const SystemCheck = ({ icon: Icon, name, status, message, detail }) => (
  <Card className={`capability-system-card ${status === 'UP' ? 'healthy' : 'issue'}`}>
    <div className="capability-system-icon"><Icon size={18} /></div>
    <div>
      <Flex align="center" gap={8} wrap>
        <strong>{name}</strong>
        <Tag color={status === 'UP' ? 'success' : 'error'}>
          {status === 'UP' ? '正常' : '异常'}
        </Tag>
      </Flex>
      <p>{message}</p>
      {detail && <code>{detail}</code>}
    </div>
  </Card>
)

const CapabilityHealthCenter = ({ onOpenSidebar }) => {
  const { data, loading, error, refetch } = useQuery(CAPABILITY_HEALTH_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const [platform, setPlatform] = useState('codex')
  const [showAll, setShowAll] = useState(false)
  const reports = data?.capabilityHealth?.reports || []
  const report = reports.find((item) => item.platform === platform)
  const agents = useMemo(() => {
    const items = report?.agents || []
    return showAll
      ? items
      : items.filter(
          (agent) =>
            agent.status !== 'complete' ||
            agent.unboundRequiredSkills.length > 0 ||
            agent.missingOptionalSkills.length > 0
        )
  }, [report, showAll])
  const updateCount = (data?.installedSkills || []).filter(
    (skill) => skill.updatable
  ).length
  const runtime = data?.runtimeHealth
  const databaseStatus = runtime?.database.status || 'DOWN'
  const realtimeStatus = runtime?.realtime.status || 'DOWN'

  return (
    <section className="workspace-view capability-health">
      <div className="page-intro">
        <button type="button" className="mobile-menu" onClick={onOpenSidebar} aria-label="打开导航"><Menu size={20} /></button>
        <div>
          <div className="section-kicker">CAPABILITY HEALTH</div>
          <h1>能力健康中心</h1>
          <p>集中检查岗位 Skill、软链接、CLI、运行时连接与插件更新。</p>
        </div>
        <Button icon={<RefreshCw size={15} />} loading={loading} onClick={() => refetch()}>重新检查</Button>
      </div>

      {error && <Alert type="error" showIcon message="能力检查暂时不可用" description={error.message} />}

      <div className="capability-system-grid">
        <SystemCheck icon={Database} name="任务数据库" status={databaseStatus} message={runtime?.database.message || (loading ? '检查中…' : databaseStatus === 'UP' ? '数据库连接正常' : '未连接')} />
        <SystemCheck icon={PlugZap} name="实时连接" status={realtimeStatus} message={runtime?.realtime.message || (loading ? '检查中…' : realtimeStatus === 'UP' ? '实时订阅服务正常' : '未连接')} />
        {(data?.capabilityHealth?.cli || []).map((item) => <SystemCheck key={item.id} icon={TerminalSquare} name={item.name} status={item.status} message={item.message} detail={item.path} />)}
        <SystemCheck icon={Wrench} name="Skill 更新" status={updateCount > 0 ? 'DOWN' : 'UP'} message={updateCount > 0 ? `${updateCount} 个 Skill 可更新` : '当前没有待更新 Skill'} detail={updateCount > 0 ? '可前往插件市场逐项确认更新' : ''} />
      </div>

      <div className="capability-toolbar">
        <Segmented
          value={platform}
          options={reports.map((item) => ({ label: platformLabel[item.platform] || item.platform, value: item.platform }))}
          onChange={setPlatform}
        />
        <Button type="text" onClick={() => setShowAll((value) => !value)}>{showAll ? '只看需处理' : '查看全部岗位'}</Button>
      </div>

      {report && (
        <div className="capability-summary" aria-label={`${platformLabel[platform]} 能力统计`}>
          <div><span>岗位总数</span><strong>{report.summary.total}</strong></div>
          <div><span>完整可用</span><strong>{report.summary.complete}</strong></div>
          <div><span>部分可用</span><strong>{report.summary.partial}</strong></div>
          <div><span>未安装</span><strong>{report.summary.notInstalled}</strong></div>
          <div><span>未绑定 Skill</span><strong>{report.summary.unbound}</strong></div>
        </div>
      )}

      <div className="capability-agent-list">
        {agents.map((agent) => {
          const hasIssue = agent.status !== 'complete' || agent.unboundRequiredSkills.length > 0
          return (
            <Card key={agent.slug} className={`capability-agent-card ${hasIssue ? 'issue' : 'healthy'}`}>
              <div className="capability-agent-head">
                <span className="capability-agent-state">{hasIssue ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}</span>
                <div><strong>{agent.name}</strong><code>{agent.slug}</code></div>
                <Tag color={hasIssue ? 'warning' : 'success'}>{hasIssue ? '需要处理' : '完整可用'}</Tag>
              </div>
              <div className="capability-issues">
                {agent.missingRequiredSkills.length > 0 && <p><Wrench size={14} /> 缺少必需 Skill：{agent.missingRequiredSkills.join('、')}</p>}
                {agent.unboundRequiredSkills.length > 0 && <p><Link2Off size={14} /> 已安装但岗位软链接未绑定：{agent.unboundRequiredSkills.join('、')}</p>}
                {agent.missingRequiredTools.length > 0 && <p><TerminalSquare size={14} /> 缺少 CLI：{agent.missingRequiredTools.join('、')}</p>}
                {agent.missingOptionalSkills.length > 0 && <p className="optional"><Wrench size={14} /> 可选 Skill 未安装：{agent.missingOptionalSkills.join('、')}</p>}
                {!hasIssue && agent.missingOptionalSkills.length === 0 && <p className="healthy-copy">岗位所需能力与绑定均正常。</p>}
              </div>
              {agent.suggestions.length > 0 && <Typography.Paragraph type="secondary" className="capability-suggestion">建议：{agent.suggestions.join(' ')}</Typography.Paragraph>}
            </Card>
          )
        })}
      </div>

      {!loading && report && agents.length === 0 && (
        <div className="capability-empty"><CheckCircle2 size={24} /><strong>当前没有必须处理的岗位能力问题</strong><span>可切换“查看全部岗位”查看完整状态。</span></div>
      )}
    </section>
  )
}

export default CapabilityHealthCenter
