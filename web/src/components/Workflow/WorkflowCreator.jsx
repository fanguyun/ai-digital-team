import { useRef, useState } from 'react'

import { Alert, Button, Flex, Form, Input, Select, Steps } from 'antd'

import { useMutation, useQuery } from '@cedarjs/web'

const TEMPLATES = gql`
  query WorkflowTemplates {
    workflowTemplates {
      key
      name
      version
      steps {
        key
        name
        agentSlug
      }
    }
  }
`
const CREATE = gql`
  mutation CreateWorkflowTask($input: CreateWorkflowTaskInput!) {
    createWorkflowTask(input: $input) {
      id
      workflow {
        version
      }
    }
  }
`
export const START = gql`
  mutation StartWorkflow($taskId: ID!, $version: Int!, $tool: String) {
    startWorkflow(taskId: $taskId, version: $version, tool: $tool) {
      id
    }
  }
`

export default function WorkflowCreator({ onCreated }) {
  const { data, loading, error } = useQuery(TEMPLATES)
  const [create] = useMutation(CREATE)
  const [start] = useMutation(START)
  const [form] = Form.useForm()
  const [tool, setTool] = useState('codex')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const submitting = useRef(false)
  const template = data?.workflowTemplates?.[0]
  const submit = async (launch) => {
    if (submitting.current) return
    submitting.current = true
    let values
    try {
      values = await form.validateFields()
    } catch {
      submitting.current = false
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const result = await create({
        variables: { input: { ...values, templateKey: template.key } },
      })
      const task = result.data.createWorkflowTask
      let message = '工作流草稿已保存'
      if (launch) {
        try {
          await start({
            variables: {
              taskId: task.id,
              version: task.workflow.version,
              tool,
            },
          })
          message = '工作流已启动，入库前将请你确认正文与目标'
        } catch (startError) {
          message = `草稿已保存；启动未完成，请在任务详情重试：${startError.message}`
        }
      }
      await onCreated(task.id, message)
    } catch (submitError) {
      setNotice(submitError.message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  if (loading) return <p role="status">正在读取工作流模板…</p>
  if (error) return <Alert type="error" title={error.message} />
  if (!template)
    return (
      <Alert
        type="info"
        title="工作流入口已停用，已有任务仍可在详情查看和处理。"
      />
    )
  return (
    <div>
      <h3>{template.name}</h3>
      <Steps
        direction="vertical"
        size="small"
        items={template.steps.map((step) => ({
          title: step.name,
          description: step.agentSlug,
        }))}
      />
      <Alert
        type="info"
        title="启动即授权按所列步骤研究知识库与公开网页。默认生成中文内部研究报告；核验失败自动返工一轮，写入思源前再次确认。"
      />
      {notice && <Alert type="error" title={notice} />}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ audience: '个人及团队内部' }}
      >
        <Form.Item
          name="title"
          label="研究主题"
          rules={[{ required: true }, { max: 120 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="questions"
          label="研究问题"
          rules={[{ required: true }, { max: 2000 }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="scope"
          label="范围与时效要求"
          rules={[{ required: true }, { max: 2000 }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="例如：近三个月官方资料，重点分析对当前团队的启发"
          />
        </Form.Item>
        <Form.Item name="audience" label="目标读者" rules={[{ max: 300 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="materials"
          label="补充资料和链接"
          rules={[{ max: 2000 }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
      <Flex gap={8} wrap>
        <Select
          aria-label="工作流执行平台"
          value={tool}
          onChange={setTool}
          options={[
            { value: 'codex', label: 'Codex' },
            { value: 'deepseek-harness', label: 'DeepSeek Harness' },
          ]}
        />
        <Button disabled={busy} onClick={() => submit(false)}>
          保存草稿
        </Button>
        <Button type="primary" loading={busy} onClick={() => submit(true)}>
          确认范围并启动
        </Button>
      </Flex>
    </div>
  )
}
