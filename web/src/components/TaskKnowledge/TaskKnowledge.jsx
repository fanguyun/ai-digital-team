import { useId, useState } from 'react'

import { useQuery } from '@cedarjs/web'

const QUERY = gql`
  query TaskRunKnowledge($taskId: ID!, $runId: ID!) {
    taskRunKnowledge(taskId: $taskId, runId: $runId) {
      status
      mode
      elapsedMs
      filteredOut
      answerAvailable
      unknownCitations
      sources {
        citation
        blockId
        documentId
        title
        documentPath
        content
        contentHash
        retrievedAt
        sourceUri
        citationStatus
      }
    }
  }
`
const STATUS = {
  hit: '已检索到参考资料',
  empty: '没有找到相关资料',
  disabled: '本轮未启用检索',
  config_error: '知识库配置不可用',
  auth_failed: '知识库鉴权失败',
  source_unavailable: '知识库连接失败',
  timeout: '知识库检索超时',
  invalid_response: '知识库响应无法解析',
  not_recorded: '本轮未记录检索证据',
}
const CITATION = {
  marker_and_link: '回答已标注引用及来源链接',
  marker_only: '回答标注了引用，但缺少对应链接',
  not_marked: '已提供给模型，回答未标注引用',
  unavailable: '尚无可核对的最终回答',
}

export default function TaskKnowledge({ taskId, runId }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const { data, loading, error, refetch } = useQuery(QUERY, {
    variables: { taskId, runId },
    skip: !open,
    fetchPolicy: 'network-only',
  })
  const result = data?.taskRunKnowledge
  return (
    <section aria-label="本轮知识库引用" className="task-plan-box">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {open ? '收起知识库引用' : '查看知识库引用'}
      </button>
      {open && (
        <div id={panelId}>
          {loading && <p role="status">正在读取本轮检索与引用记录…</p>}
          {error && (
            <p role="alert">
              引用记录读取失败。
              <button type="button" onClick={() => refetch()}>
                重试读取引用
              </button>
            </p>
          )}
          {!loading && !error && result && (
            <>
              <p>
                <strong>{STATUS[result.status] || '未知检索状态'}</strong>
                {result.elapsedMs != null && ` · ${result.elapsedMs} ms`}
                {result.mode === 'required'
                  ? ' · 必须有证据'
                  : result.mode === 'optional'
                    ? ' · 无证据时允许继续'
                    : ''}
              </p>
              {result.status !== 'hit' && (
                <p>本轮没有可用的知识库来源，不应据此声称已查证。</p>
              )}
              {result.filteredOut > 0 && (
                <p>有 {result.filteredOut} 个片段因超出目录范围被排除。</p>
              )}
              {result.unknownCitations.length > 0 && (
                <p role="alert">
                  回答存在无法对应本轮来源的引用：
                  {result.unknownCitations.join('、')}
                </p>
              )}
              {result.sources.length > 0 && (
                <>
                  <p>
                    下方为当轮提供给模型的资料快照；文档之后可能被移动、改名或修改。引用标记与链接仅做格式核对，事实是否得到片段支持仍需验收。
                  </p>
                  <ul>
                    {result.sources.map((source) => (
                      <li
                        key={source.citation}
                        style={{ overflowWrap: 'anywhere', marginBottom: 12 }}
                      >
                        <strong>
                          {source.citation} {source.title || source.documentId}
                        </strong>
                        <p>
                          {CITATION[source.citationStatus] || '引用状态未知'}
                        </p>
                        {source.documentPath && (
                          <p>当轮路径：{source.documentPath}</p>
                        )}
                        {source.retrievedAt && (
                          <p>读取时间：{source.retrievedAt}</p>
                        )}
                        <p>
                          {source.content ||
                            '原始片段快照不可用；仅展示当轮来源摘要。'}
                        </p>
                        <a href={source.sourceUri}>
                          在思源中打开来源 {source.citation}
                        </a>
                        <details>
                          <summary>查看来源校验信息</summary>
                          <p>文档：{source.documentId}</p>
                          <p>块：{source.blockId}</p>
                          <p>SHA-256：{source.contentHash}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
