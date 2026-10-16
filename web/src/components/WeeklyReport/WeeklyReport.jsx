import { useMemo, useState } from 'react'

import { Alert, Button, Card, Segmented, Tag } from 'antd'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Menu,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react'

import { useQuery } from '@cedarjs/web'

import { TaskDetail } from 'src/components/TaskDetail/TaskDetail'
import { formatTokenValue } from 'src/components/TaskDetail/taskDetailData'

import agentManifest from '../../../../agents/manifest.json'

import { formatReportRange, reportRangeForOffset } from './weekRange'

const WEEKLY_REPORT_QUERY = gql`
  query TeamWeeklyReport($range: RuntimeTimeRange!) {
    teamWeeklyReport(range: $range) {
      from
      to
      generatedAt
      totalTasks
      completedTasks
      failedTasks
      cancelledTasks
      pendingTasks
      inputTokens
      outputTokens
      cachedTokens
      totalTokens
      totalTokenCoverage
      headline
      contributions {
        agent
        workCount
        trackedWorkCount
        totalTokens
        tokenCoverage
      }
      completed {
        id
        title
        primaryAgent
        status
        currentStage
        summary
        updatedAt
      }
      failures {
        id
        title
        primaryAgent
        status
        currentStage
        summary
        updatedAt
      }
      pending {
        id
        title
        primaryAgent
        status
        currentStage
        summary
        updatedAt
      }
    }
  }
`

const TASK_DETAIL_QUERY = gql`
  query SummaryTaskDetail($id: ID!) {
    taskRun(id: $id) {
      id
      title
      platform
      externalReference
      primaryAgent
      status
      currentStage
      summary
      version
      startedAt
      updatedAt
      completedAt
      events {
        id
        sequence
        eventType
        status
        stage
        agent
        skills
        summary
        evidence
        inputTokens
        outputTokens
        cachedTokens
        modelId
        createdAt
      }
    }
  }
`

const agentNames = Object.fromEntries(
  agentManifest.agents.map((agent) => [agent.slug, agent.name])
)

const statusLabel = {
  QUEUED: '排队中',
  RUNNING: '进行中',
  WAITING_CONFIRMATION: '待确认',
  FAILED: '失败',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}
const dimensionMeta = {
  day: {
    label: '按天',
    current: '今天',
    unit: '天',
    previous: '上一天',
    next: '下一天',
    scope: '当日',
    summary: '日度',
  },
  week: {
    label: '按周',
    current: '本周',
    unit: '周',
    previous: '上一周',
    next: '下一周',
    scope: '本周',
    summary: '周度',
  },
  month: {
    label: '按月',
    current: '本月',
    unit: '个月',
    previous: '上个月',
    next: '下个月',
    scope: '当月',
    summary: '月度',
  },
}

const ReportTaskList = ({
  items,
  empty,
  onSelectTask,
  tone = 'default',
}) =>
  items.length ? (
    <div className="weekly-task-list">
      {items.map((task) => (
        <article key={task.id}>
          <button
            type="button"
            className="weekly-task-button"
            onClick={() => onSelectTask(task.id)}
            aria-label={`查看任务详情：${task.title}`}
          >
            <span className={`weekly-task-dot ${tone}`} />
            <span className="weekly-task-copy">
              <strong>{task.title}</strong>
              <span>{task.summary || '暂无摘要'}</span>
              <small>{agentNames[task.primaryAgent] || task.primaryAgent}</small>
            </span>
            <Tag>{statusLabel[task.status] || task.status}</Tag>
          </button>
        </article>
      ))}
    </div>
  ) : (
    <div className="weekly-list-empty">{empty}</div>
  )

const WeeklyReport = ({ onOpenSidebar }) => {
  const [dimension, setDimension] = useState('week')
  const [reportOffset, setReportOffset] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const range = useMemo(
    () => reportRangeForOffset(dimension, reportOffset),
    [dimension, reportOffset]
  )
  const { data, loading, error, refetch } = useQuery(WEEKLY_REPORT_QUERY, {
    variables: { range },
    fetchPolicy: 'cache-and-network',
  })
  const {
    data: taskDetailData,
    loading: taskDetailLoading,
    error: taskDetailError,
  } = useQuery(TASK_DETAIL_QUERY, {
    variables: { id: selectedTaskId || '' },
    skip: !selectedTaskId,
    fetchPolicy: 'cache-and-network',
  })
  const report = data?.teamWeeklyReport
  const meta = dimensionMeta[dimension]
  const periodLabel =
    reportOffset === 0
      ? meta.current
      : `${Math.abs(reportOffset)} ${meta.unit}前`
  const maximumWork = Math.max(
    1,
    ...(report?.contributions || []).map((item) => item.workCount)
  )

  if (selectedTaskId) {
    return (
      <section className="workspace-view task-runtime-view summary-task-detail">
        {taskDetailData?.taskRun ? (
          <TaskDetail
            task={taskDetailData.taskRun}
            backLabel="返回工作总结"
            onBack={() => setSelectedTaskId(null)}
          />
        ) : taskDetailError ? (
          <div className="runtime-state-panel failure">
            <CircleAlert size={24} />
            <h1>任务详情加载失败</h1>
            <p>{taskDetailError.message}</p>
            <Button onClick={() => setSelectedTaskId(null)}>返回工作总结</Button>
          </div>
        ) : (
          <div className="runtime-state-panel" aria-busy={taskDetailLoading}>
            <RefreshCw className="spin" size={22} />
            <h1>正在加载任务详情</h1>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="workspace-view weekly-report">
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
          <div className="section-kicker">TEAM VALUE REPORT</div>
          <h1>团队与价值总结</h1>
          <p>基于个人数字团队的真实单次任务与 Token 记录自动生成。</p>
        </div>
        <Button
          icon={<RefreshCw size={15} />}
          loading={loading}
          onClick={() => refetch()}
        >
          刷新总结
        </Button>
      </div>

      <div className="weekly-range-controls">
        <Segmented
          className="summary-dimension-switch"
          value={dimension}
          options={Object.entries(dimensionMeta).map(([value, item]) => ({
            value,
            label: item.label,
          }))}
          onChange={(value) => {
            setDimension(value)
            setReportOffset(0)
          }}
        />
        <div className="weekly-range-bar">
          <Button
            type="text"
            icon={<ArrowLeft size={15} />}
            onClick={() => setReportOffset((value) => value - 1)}
          >
            {meta.previous}
          </Button>
          <div>
            <strong>{periodLabel}</strong>
            <span>{formatReportRange(range, dimension)}</span>
          </div>
          <Button
            type="text"
            icon={<ArrowRight size={15} />}
            iconPosition="end"
            disabled={reportOffset === 0}
            onClick={() =>
              setReportOffset((value) => Math.min(0, value + 1))
            }
          >
            {meta.next}
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="总结生成失败"
          description={error.message}
        />
      )}

      {report && (
        <>
          <Card className="weekly-headline">
            <Sparkles size={20} />
            <div>
              <span>{meta.summary}价值摘要</span>
              <strong>{report.headline}</strong>
            </div>
          </Card>

          <div className="weekly-metrics">
            <Card>
              <span>任务总数</span>
              <strong>{report.totalTasks}</strong>
              <small>{meta.scope}进入或完成</small>
            </Card>
            <Card>
              <span>已完成</span>
              <strong>{report.completedTasks}</strong>
              <small>形成可交付结果</small>
            </Card>
            <Card>
              <span>失败</span>
              <strong>{report.failedTasks}</strong>
              <small>需要复盘原因</small>
            </Card>
            <Card>
              <span>待处理</span>
              <strong>{report.pendingTasks}</strong>
              <small>当前仍未闭环</small>
            </Card>
            <Card>
              <span>Token 消耗</span>
              <strong>
                {formatTokenValue(
                  report.totalTokens,
                  report.totalTokenCoverage
                )}
              </strong>
              <small>输入与输出合计</small>
            </Card>
          </div>

          <div className="weekly-layout">
            <Card
              className="weekly-section"
              title={
                <>
                  <CheckCircle2 size={16} /> {meta.scope}完成
                </>
              }
            >
              <ReportTaskList
                items={report.completed}
                empty={`${meta.scope}暂无已完成任务。`}
                tone="success"
                onSelectTask={setSelectedTaskId}
              />
            </Card>
            <Card
              className="weekly-section"
              title={
                <>
                  <Users size={16} /> 岗位贡献
                </>
              }
            >
              {report.contributions.length ? (
                <div className="weekly-contributions">
                  {report.contributions.map((item) => (
                    <div key={item.agent}>
                      <div>
                        <strong>{agentNames[item.agent] || item.agent}</strong>
                        <span>
                          {item.workCount} 个任务 ·{' '}
                          {formatTokenValue(
                            item.totalTokens,
                            item.tokenCoverage
                          )}{' '}
                          Token
                        </span>
                      </div>
                      <i>
                        <b
                          style={{
                            width: `${Math.max(8, (item.workCount / maximumWork) * 100)}%`,
                          }}
                        />
                      </i>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="weekly-list-empty">
                  {meta.scope}暂无岗位贡献记录。
                </div>
              )}
            </Card>
            <Card
              className="weekly-section"
              title={
                <>
                  <CircleAlert size={16} /> 失败与原因
                </>
              }
            >
              <ReportTaskList
                items={report.failures}
                empty={`${meta.scope}没有失败任务。`}
                tone="danger"
                onSelectTask={setSelectedTaskId}
              />
            </Card>
            <Card
              className="weekly-section"
              title={
                <>
                  <Clock3 size={16} /> 待处理事项
                </>
              }
            >
              <ReportTaskList
                items={report.pending}
                empty="当前没有待处理任务。"
                tone="warning"
                onSelectTask={setSelectedTaskId}
              />
            </Card>
          </div>
        </>
      )}
    </section>
  )
}

export default WeeklyReport
