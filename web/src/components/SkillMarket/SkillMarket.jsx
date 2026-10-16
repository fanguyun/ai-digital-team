import { useMemo, useState } from 'react'

import { Alert, Button, Card, Drawer, Flex, Input, Select, Tag, Typography } from 'antd'
import { Menu, RefreshCw } from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

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
      }
    }
  }
`

const sourceColor = {
  用户: 'green',
  插件: 'blue',
  系统: 'default',
}

const SkillMarket = ({ onOpenSidebar }) => {
  const { data, loading, error, refetch } = useQuery(SKILLS_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const [updateSkill] = useMutation(UPDATE_SKILL)
  const [source, setSource] = useState('全部')
  const [tag, setTag] = useState('全部')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const skills = data?.installedSkills || []
  const sources = ['全部', ...new Set(skills.map((skill) => skill.source))]
  const tags = [
    '全部',
    ...new Set(skills.flatMap((skill) => skill.tags)),
  ]
  const visibleSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return skills.filter((skill) => {
      const searchable = [skill.name, skill.description, skill.source, ...skill.tags]
        .join(' ')
        .toLowerCase()
      return (
        (source === '全部' || skill.source === source) &&
        (tag === '全部' || skill.tags.includes(tag)) &&
        (!keyword || searchable.includes(keyword))
      )
    })
  }, [query, skills, source, tag])
  const selected =
    skills.find((skill) => skill.id === selectedId) || null

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
          <p>查看当前已安装的 Skill，可搜索名称、简介和标签。</p>
        </div>
      </div>

      <Flex gap={8} wrap style={{ margin: '18px 0' }}>
        <Input.Search
          aria-label="搜索技能"
          allowClear
          placeholder="搜索名称、简介或标签"
          value={query}
          style={{ width: 280 }}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="来源"
          value={source}
          style={{ minWidth: 140 }}
          options={sources.map((item) => ({ value: item, label: item === '全部' ? '全部来源' : item }))}
          onChange={(value) => setSource(value)}
        />
        <Select
          aria-label="标签"
          value={tag}
          style={{ minWidth: 160 }}
          options={tags.map((item) => ({ value: item, label: item === '全部' ? '全部标签' : item }))}
          onChange={(value) => setTag(value)}
        />
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
        {visibleSkills.map((skill) => (
          <Card
            key={skill.id}
            hoverable
            title={skill.name}
            extra={
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
            }
            onClick={() => setSelectedId(skill.id)}
          >
            <Flex gap={6} wrap style={{ marginBottom: 10 }}>
              <Tag color={sourceColor[skill.source] || 'default'}>{skill.source}</Tag>
              {skill.tags.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Flex>
            <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
              {skill.description}
            </Typography.Paragraph>
          </Card>
        ))}
      </div>
      {!loading && !visibleSkills.length && (
        <Typography.Text type="secondary">没有符合筛选条件的技能。</Typography.Text>
      )}

      <Drawer
        title={selected?.name || '技能详情'}
        open={Boolean(selected)}
        width={520}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <>
            <Flex gap={6} wrap style={{ marginBottom: 16 }}>
              <Tag color={sourceColor[selected.source] || 'default'}>
                {selected.source}
              </Tag>
              {selected.tags.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Flex>
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
