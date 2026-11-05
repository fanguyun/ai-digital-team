import { useMemo, useState } from 'react'

import { Alert, Button, Card, Drawer, Flex, Input, Tabs, Tag, Typography } from 'antd'
import { Menu, RefreshCw } from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

import {
  CATEGORY_ALL,
  buildTabs,
  mapCategories,
} from 'src/components/SkillMarket/skillCategories'
import { mapSkillOwners } from 'src/components/SkillMarket/skillOwners'

const SKILLS_QUERY = gql`
  query InstalledSkills {
    installedSkills {
      id
      name
      description
      source
      tags
      path
      updatedAt
      updatable
      body
      codexEnabled
      dshEnabled
    }
  }
`

const UPDATE_SKILL = gql`
  mutation UpdateInstalledSkill($id: ID!) {
    updateInstalledSkill(id: $id) {
      message
      skill {
        id
        name
        description
        source
        tags
        path
        updatedAt
        updatable
        body
        codexEnabled
        dshEnabled
      }
    }
  }
`

const PLATFORM_BADGES = [
  { key: 'codex', label: 'Codex', field: 'codexEnabled' },
  { key: 'dsh', label: 'DSH', field: 'dshEnabled' },
]

const PlatformBadge = ({ label, enabled }) => (
  <Tag
    title={enabled ? `已启用 ${label}` : `未启用 ${label}`}
    aria-label={enabled ? `已启用 ${label}` : `未启用 ${label}`}
    style={{
      margin: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      borderStyle: enabled ? 'solid' : 'dashed',
      borderColor: enabled ? 'var(--accent)' : 'var(--border)',
      background: enabled ? 'var(--accent-soft)' : 'transparent',
      color: enabled ? 'var(--text)' : 'var(--muted-light)',
    }}
  >
    <span
      aria-hidden="true"
      style={{ color: enabled ? 'var(--accent)' : 'var(--muted-light)' }}
    >
      {enabled ? '●' : '○'}
    </span>
    {label}
  </Tag>
)

const PlatformStatus = ({ skill }) => (
  <Flex gap={6} wrap>
    {PLATFORM_BADGES.map((badge) => (
      <PlatformBadge
        key={badge.key}
        label={badge.label}
        enabled={Boolean(skill[badge.field])}
      />
    ))}
  </Flex>
)

const AgentTag = ({ agent }) => (
  <Tag
    title={`${agent.name}（${agent.group}）· ${agent.role}`}
    style={{
      margin: 0,
      color: agent.color,
      borderColor: agent.color,
      background: 'transparent',
    }}
  >
    {agent.name}
  </Tag>
)

const SkillMarket = ({ onOpenSidebar }) => {
  const { data, loading, error, refetch } = useQuery(SKILLS_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const [updateSkill] = useMutation(UPDATE_SKILL)
  const [category, setCategory] = useState(CATEGORY_ALL)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState(null)
  const skills = data?.installedSkills || []
  const categoryMap = useMemo(() => mapCategories(skills), [skills])
  const ownerMap = useMemo(() => mapSkillOwners(skills), [skills])
  const categoryTabs = useMemo(
    () => buildTabs(skills, categoryMap),
    [skills, categoryMap]
  )
  const visibleSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return skills.filter((skill) => {
      const searchable = [skill.name, skill.description, skill.source, ...skill.tags]
        .join(' ')
        .toLowerCase()
      return (
        (category === CATEGORY_ALL || categoryMap.get(skill.id) === category) &&
        (!keyword || searchable.includes(keyword))
      )
    })
  }, [category, categoryMap, query, skills])
  const selected =
    skills.find((skill) => skill.id === selectedId) || null

  const runRefresh = async () => {
    setRefreshing(true)
    setNotice(null)
    try {
      await refetch()
    } catch (refreshError) {
      setNotice({ type: 'error', message: refreshError.message })
    } finally {
      setRefreshing(false)
    }
  }

  const runUpdate = async (id) => {
    setUpdatingId(id)
    setNotice(null)
    try {
      const result = await updateSkill({ variables: { id } })
      setNotice({
        type: 'success',
        message: result.data.updateInstalledSkill.message,
      })
      await refetch()
    } catch (updateError) {
      setNotice({ type: 'error', message: updateError.message })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="workspace-view skill-market">
      <div className="page-intro">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenSidebar}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="section-kicker">SKILL MARKET</div>
          <h1>插件市场</h1>
          <p>按功能分类筛选，也可搜索名称、简介和标签。</p>
        </div>
      </div>

      <Tabs
        className="skill-market-tabs"
        activeKey={category}
        items={categoryTabs.map((tab) => ({ key: tab.key, label: tab.label }))}
        onChange={setCategory}
      />

      <Flex gap={8} wrap style={{ margin: '18px 0' }}>
        <Input.Search
          aria-label="搜索技能"
          allowClear
          placeholder="搜索名称、简介或标签"
          value={query}
          style={{ width: 280 }}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          icon={<RefreshCw size={16} />}
          loading={refreshing}
          style={{ marginLeft: 'auto' }}
          onClick={() => void runRefresh()}
        >
          刷新
        </Button>
      </Flex>

      {notice && (
        <Alert
          style={{ marginBottom: 16 }}
          type={notice.type}
          message={notice.message}
          showIcon
          closable
          onClose={() => setNotice(null)}
        />
      )}
      {loading && !skills.length && <Typography.Text>正在读取已安装技能…</Typography.Text>}
      {error && !skills.length && (
        <Alert type="error" showIcon message="暂时无法读取已安装技能。" />
      )}

      <div className="skill-market-grid">
        {visibleSkills.map((skill) => {
          const owners = ownerMap.get(skill.id) || []
          return (
            <Card
              key={skill.id}
              hoverable
              title={skill.name}
              extra={
                skill.updatable ? (
                  <Button
                    type="text"
                    aria-label={`更新 ${skill.name}`}
                    icon={<RefreshCw size={16} />}
                    loading={updatingId === skill.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void runUpdate(skill.id)
                    }}
                  />
                ) : null
              }
              onClick={() => setSelectedId(skill.id)}
            >
              <Flex gap={6} wrap align="center" style={{ marginBottom: 10 }}>
                <PlatformStatus skill={skill} />
                {skill.tags.map((item) => (
                  <Tag key={item} style={{ margin: 0 }}>
                    {item}
                  </Tag>
                ))}
              </Flex>
              {owners.length > 0 && (
                <Flex gap={6} wrap align="center" style={{ marginBottom: 10 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    用于
                  </Typography.Text>
                  {owners.slice(0, 3).map((agent) => (
                    <AgentTag key={agent.slug} agent={agent} />
                  ))}
                  {owners.length > 3 && (
                    <Tag style={{ margin: 0 }}>+{owners.length - 3}</Tag>
                  )}
                </Flex>
              )}
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                {skill.description}
              </Typography.Paragraph>
            </Card>
          )
        })}
      </div>
      {!loading && !visibleSkills.length && (
        <Typography.Text type="secondary">当前分类下没有符合筛选条件的技能。</Typography.Text>
      )}

      <Drawer
        title={selected?.name || '技能详情'}
        open={Boolean(selected)}
        width={520}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <>
            <Flex gap={6} wrap align="center" style={{ marginBottom: 16 }}>
              <PlatformStatus skill={selected} />
              {selected.tags.map((item) => (
                <Tag key={item} style={{ margin: 0 }}>
                  {item}
                </Tag>
              ))}
            </Flex>
            {(ownerMap.get(selected.id) || []).length > 0 && (
              <Flex gap={6} wrap align="center" style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">用于</Typography.Text>
                {(ownerMap.get(selected.id) || []).map((agent) => (
                  <AgentTag key={agent.slug} agent={agent} />
                ))}
              </Flex>
            )}
            <Typography.Paragraph>{selected.description}</Typography.Paragraph>
            <Typography.Paragraph type="secondary" copyable>
              {selected.path}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {selected.body || '这个技能没有更多说明。'}
            </Typography.Paragraph>
          </>
        )}
      </Drawer>
    </section>
  )
}

export default SkillMarket
