import { useEffect, useState } from 'react'

import {
  Alert,
  Button,
  Card,
  Flex,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Switch,
  Tag,
} from 'antd'

import { useMutation, useQuery } from '@cedarjs/web'

import KnowledgePublisher from 'src/components/KnowledgePublisher/KnowledgePublisher'

const RAG_SOURCE_QUERY = gql`
  query RagKnowledgeSource {
    ragKnowledgeSource {
      enabled
      baseUrl
      hasToken
      tokenHint
      provider
      notebooks
      mode
      timeoutMs
      agentSlugs
      pathPrefixes
      configSource
      lastTest {
        at
        ok
        latencyMs
      }
      availableAgents {
        slug
        name
      }
    }
  }
`

const SIYUAN_NOTEBOOKS_QUERY = gql`
  query SiYuanNotebooks {
    siyuanNotebooks {
      ok
      error
      notebooks {
        id
        name
        closed
      }
    }
  }
`

const SAVE_RAG_SOURCE = gql`
  mutation SaveRagKnowledgeSource($input: RagKnowledgeSourceInput!) {
    saveRagKnowledgeSource(input: $input) {
      enabled
      baseUrl
      hasToken
      tokenHint
      provider
      notebooks
      mode
      timeoutMs
      agentSlugs
      pathPrefixes
      configSource
    }
  }
`

const TEST_RAG_SOURCE = gql`
  mutation TestRagKnowledgeSource($token: String) {
    testRagKnowledgeSource(token: $token) {
      ok
      latencyMs
      at
      checks {
        name
        ok
        latencyMs
        detail
      }
    }
  }
`

const CLEAR_RAG_SOURCE = gql`
  mutation ClearRagKnowledgeSource {
    clearRagKnowledgeSource {
      enabled
      hasToken
      tokenHint
      configSource
      baseUrl
    }
  }
`

const CHECK_LABELS = {
  url: '地址合法性',
  auth: '思源鉴权',
  healthz: '服务存活检查',
  search: '检索接口与鉴权',
}

const PROVIDERS = [
  { value: 'siyuan', label: '思源直连（API Token）' },
  { value: 'bridge', label: '自建检索桥（Bearer）' },
]

const SOURCE_LABELS = {
  database: '数据库配置',
  env: '环境变量',
  none: '未配置',
}

const KnowledgeSettings = () => {
  const { data, error, refetch, loading } = useQuery(RAG_SOURCE_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const [saveSource, { loading: saving }] = useMutation(SAVE_RAG_SOURCE)
  const [testSource, { loading: testing }] = useMutation(TEST_RAG_SOURCE)
  const [clearSource, { loading: clearing }] = useMutation(CLEAR_RAG_SOURCE)

  const source = data?.ragKnowledgeSource
  const provider = source?.provider || 'bridge'
  const wantsNotebooks = provider === 'siyuan'
  const notebooksQuery = useQuery(SIYUAN_NOTEBOOKS_QUERY, {
    skip: !wantsNotebooks || !source?.hasToken,
    fetchPolicy: 'cache-first',
  })
  const [form, setForm] = useState({
    enabled: false,
    baseUrl: '',
    token: '',
    provider: 'bridge',
    mode: 'optional',
    timeoutMs: 4000,
    agentSlugs: [],
    notebooks: [],
    pathPrefixes: '',
  })
  const [notice, setNotice] = useState(null)
  const [testResult, setTestResult] = useState(null)

  // 依赖用字符串快照，避免上游返回新数组引用时反复重置表单
  const sourceKey = [
    source?.enabled,
    source?.baseUrl,
    source?.provider,
    source?.mode,
    source?.timeoutMs,
    (source?.agentSlugs || []).join(','),
    (source?.notebooks || []).join(','),
    (source?.pathPrefixes || []).join('\n'),
  ].join('|')

  useEffect(() => {
    const current = data?.ragKnowledgeSource
    if (!current) return
    setForm((state) => ({
      ...state,
      enabled: current.enabled,
      baseUrl: current.baseUrl,
      provider: current.provider || 'bridge',
      mode: current.mode,
      timeoutMs: current.timeoutMs,
      agentSlugs: current.agentSlugs,
      notebooks: current.notebooks || [],
      pathPrefixes: (current.pathPrefixes || []).join('\n'),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  const patch = (next) => setForm((state) => ({ ...state, ...next }))

  const save = async () => {
    setNotice(null)
    try {
      await saveSource({
        variables: {
          input: {
            enabled: form.enabled,
            baseUrl: form.baseUrl,
            provider: form.provider,
            mode: form.mode,
            timeoutMs: Number(form.timeoutMs) || 4000,
            agentSlugs: form.agentSlugs,
            notebooks: form.notebooks,
            pathPrefixes: form.pathPrefixes
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            ...(form.token ? { token: form.token } : {}),
          },
        },
      })
      patch({ token: '' })
      setNotice({ tone: 'success', text: '已保存知识库配置' })
      await refetch()
    } catch (saveError) {
      setNotice({ tone: 'error', text: saveError.message })
    }
  }

  const test = async () => {
    setNotice(null)
    setTestResult(null)
    try {
      const { data: result } = await testSource({
        variables: { token: form.token || null },
      })
      const payload = result?.testRagKnowledgeSource
      setTestResult(payload)
      setNotice(
        payload?.ok
          ? { tone: 'success', text: `连接正常（${payload.latencyMs} ms）` }
          : { tone: 'error', text: '测试未通过，请查看下方检查项' }
      )
      await refetch()
    } catch (testError) {
      setNotice({ tone: 'error', text: testError.message })
    }
  }

  const clear = async () => {
    setNotice(null)
    try {
      await clearSource()
      patch({ enabled: false, token: '' })
      setNotice({ tone: 'success', text: '已清除数据库配置，回落到环境变量' })
      await refetch()
    } catch (clearError) {
      setNotice({ tone: 'error', text: clearError.message })
    }
  }

  return (
    <Card
      className="knowledge-settings"
      title={
        <Flex align="center" gap={10} wrap>
          <span>外部知识库（RAG）</span>
          <Tag color={source?.enabled ? 'success' : 'default'}>
            {source?.enabled ? '已启用' : '未启用'}
          </Tag>
          <Tag>生效来源：{SOURCE_LABELS[source?.configSource] || '未配置'}</Tag>
        </Flex>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message="读取知识库配置失败"
          description={error.message}
        />
      )}

      <KnowledgePublisher />

      <div className="knowledge-settings-grid">
        <label
          htmlFor="knowledge-baseUrl"
          className="knowledge-settings-span-2"
        >
          <span>服务地址</span>
          <Input
            id="knowledge-baseUrl"
            placeholder="http://nas.local:8787"
            value={form.baseUrl}
            onChange={(event) => patch({ baseUrl: event.target.value })}
          />
        </label>

        <label htmlFor="knowledge-token">
          <span>访问令牌</span>
          <Input.Password
            id="knowledge-token"
            placeholder={
              source?.hasToken
                ? `已配置（${source.tokenHint || '••••'}），留空不修改`
                : form.provider === 'siyuan'
                  ? '思源 → 设置 → 关于 → API token'
                  : '检索桥的 RAG_BRIDGE_TOKEN'
            }
            value={form.token}
            onChange={(event) => patch({ token: event.target.value })}
          />
        </label>

        <label htmlFor="knowledge-provider">
          <span>连接方式</span>
          <Select
            id="knowledge-provider"
            value={form.provider}
            onChange={(value) => patch({ provider: value })}
            options={PROVIDERS}
          />
        </label>

        <label htmlFor="knowledge-mode">
          <span>检索模式</span>
          <Select
            id="knowledge-mode"
            value={form.mode}
            onChange={(value) => patch({ mode: value })}
            options={[
              { value: 'optional', label: '可选：无命中继续执行' },
              { value: 'required', label: '必需：无证据阻止派发' },
            ]}
          />
        </label>

        <label htmlFor="knowledge-agents">
          <span>试点岗位</span>
          <Select
            id="knowledge-agents"
            mode="multiple"
            allowClear
            placeholder="留空表示所有岗位"
            value={form.agentSlugs}
            onChange={(value) => patch({ agentSlugs: value })}
            options={(source?.availableAgents || []).map((agent) => ({
              value: agent.slug,
              label: `${agent.name}（${agent.slug}）`,
            }))}
          />
        </label>

        <div className="knowledge-settings-pair">
          <div className="knowledge-settings-pair-row">
            <span>启用</span>
            <Switch
              checked={form.enabled}
              onChange={(value) => patch({ enabled: value })}
            />
          </div>
          <div className="knowledge-settings-pair-row">
            <span>超时</span>
            <InputNumber
              id="knowledge-timeout"
              min={1}
              max={4000}
              step={500}
              value={form.timeoutMs}
              onChange={(value) => patch({ timeoutMs: value ?? 4000 })}
            />
            <span className="knowledge-settings-unit">ms</span>
          </div>
        </div>

        {wantsNotebooks && (
          <label
            htmlFor="knowledge-notebooks"
            className="knowledge-settings-span-2"
          >
            <span>允许的笔记本（留空表示不限制）</span>
            <Select
              id="knowledge-notebooks"
              mode="multiple"
              allowClear
              loading={notebooksQuery.loading}
              placeholder={
                notebooksQuery.data?.siyuanNotebooks?.ok
                  ? '选择一个或多个笔记本'
                  : notebooksQuery.data?.siyuanNotebooks?.error ||
                    '先保存地址与令牌'
              }
              value={form.notebooks}
              onChange={(value) => patch({ notebooks: value })}
              options={(
                notebooksQuery.data?.siyuanNotebooks?.notebooks || []
              ).map((notebook) => ({
                value: notebook.id,
                label: `${notebook.name}${notebook.closed ? '（已关闭）' : ''}`,
              }))}
            />
          </label>
        )}

        <label htmlFor="knowledge-prefixes" className="knowledge-settings-wide">
          <span>允许的目录（每行一条）</span>
          <Input.TextArea
            id="knowledge-prefixes"
            rows={3}
            placeholder="团队/研发"
            value={form.pathPrefixes}
            onChange={(event) => patch({ pathPrefixes: event.target.value })}
          />
        </label>
      </div>

      <p className="knowledge-settings-hint">
        检索服务只接受查询与条数，笔记本白名单在 NAS
        侧维护；这里的目录用于团队侧结果过滤。
        测试连接只针对已保存的地址，改完地址请先保存再测试。
      </p>

      <Flex gap={8} wrap>
        <Button type="primary" loading={saving} onClick={save}>
          保存
        </Button>
        <Button loading={testing} onClick={test}>
          测试连接
        </Button>
        <Popconfirm
          title="清除数据库配置？"
          description="清除后会回落到环境变量配置。"
          okText="清除"
          cancelText="取消"
          onConfirm={clear}
        >
          <Button
            danger
            loading={clearing}
            disabled={!source?.configSource?.startsWith('database')}
          >
            清除配置
          </Button>
        </Popconfirm>
      </Flex>

      {notice && (
        <p
          className={`knowledge-settings-notice ${notice.tone === 'error' ? 'error' : ''}`}
        >
          {notice.text}
        </p>
      )}

      {testResult && (
        <ul className="knowledge-settings-checks">
          {testResult.checks.map((check) => (
            <li key={check.name} className={check.ok ? 'ok' : 'failed'}>
              <span>{check.ok ? '✓' : '✗'}</span>
              <strong>{CHECK_LABELS[check.name] || check.name}</strong>
              {typeof check.latencyMs === 'number' && (
                <em>{check.latencyMs} ms</em>
              )}
              {check.detail && <span className="detail">{check.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {!loading && source?.lastTest && (
        <p className="knowledge-settings-hint">
          上次测试：{source.lastTest.ok ? '通过' : '未通过'}
          {source.lastTest.latencyMs
            ? ` · ${source.lastTest.latencyMs} ms`
            : ''}
          {source.lastTest.at
            ? ` · ${new Date(source.lastTest.at).toLocaleString('zh-CN')}`
            : ''}
        </p>
      )}
    </Card>
  )
}

export default KnowledgeSettings
