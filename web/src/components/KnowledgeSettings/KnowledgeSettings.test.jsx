import { fireEvent, render, screen, waitFor } from '@cedarjs/testing/web'
import { useMutation, useQuery } from '@cedarjs/web'

import KnowledgeSettings from './KnowledgeSettings'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}))
jest.mock('src/components/MarkdownDocument/MarkdownDocument', () => ({
  __esModule: true,
  default: ({ content }) => <pre>{content}</pre>,
}))

const source = {
  enabled: true,
  baseUrl: 'http://nas.local:8787',
  hasToken: true,
  tokenHint: '••••a1b2',
  mode: 'optional',
  timeoutMs: 4000,
  agentSlugs: ['main-agent'],
  pathPrefixes: ['团队/研发'],
  configSource: 'database',
  lastTest: null,
  availableAgents: [
    { slug: 'main-agent', name: '数字总经理' },
    { slug: 'software-engineer-agent', name: '软件工程师' },
  ],
}

// antd 的 Select/Switch 依赖 ResizeObserver，jsdom 没有
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

let mutations

beforeEach(() => {
  mutations = {
    SaveRagKnowledgeSource: jest.fn().mockResolvedValue({ data: {} }),
    TestRagKnowledgeSource: jest.fn().mockResolvedValue({
      data: {
        testRagKnowledgeSource: {
          ok: true,
          latencyMs: 12,
          checks: [
            { name: 'url', ok: true, latencyMs: 0 },
            { name: 'healthz', ok: true, latencyMs: 6 },
            { name: 'search', ok: true, latencyMs: 6, detail: '返回 empty' },
          ],
        },
      },
    }),
    ClearRagKnowledgeSource: jest.fn().mockResolvedValue({ data: {} }),
  }
  useQuery.mockReturnValue({
    data: { ragKnowledgeSource: source },
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue({ data: {} }),
  })
  useMutation.mockImplementation((doc) => {
    const name = doc.definitions[0].name.value
    return [mutations[name], {}]
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

const siyuanSource = { ...source, provider: 'siyuan', notebooks: [] }

it('offers the siyuan provider with a notebook picker', async () => {
  useQuery.mockImplementation((doc) => {
    const name = doc.definitions[0].name.value
    if (name === 'SiYuanNotebooks') {
      return {
        data: {
          siyuanNotebooks: {
            ok: true,
            notebooks: [
              {
                id: '20260806173656-2fkyn83',
                name: '底层规律知识库',
                closed: false,
              },
            ],
          },
        },
        loading: false,
      }
    }
    return {
      data: { ragKnowledgeSource: siyuanSource },
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue({ data: {} }),
    }
  })

  render(<KnowledgeSettings />)

  expect(screen.getByText('允许的笔记本（留空表示不限制）')).toBeInTheDocument()
  expect(screen.getAllByText('思源直连（API Token）').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
  await waitFor(() =>
    expect(mutations.SaveRagKnowledgeSource).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          provider: 'siyuan',
          notebooks: [],
        }),
      },
    })
  )
})

it('shows masked token and current settings', () => {
  render(<KnowledgeSettings />)

  expect(screen.getByText('已启用')).toBeInTheDocument()
  expect(screen.getByText('生效来源：数据库配置')).toBeInTheDocument()
  expect(
    screen.getByPlaceholderText('已配置（••••a1b2），留空不修改')
  ).toBeInTheDocument()
})

it('saves a new token together with the form values', async () => {
  render(<KnowledgeSettings />)

  fireEvent.change(
    screen.getByPlaceholderText('已配置（••••a1b2），留空不修改'),
    {
      target: { value: 'n'.repeat(40) },
    }
  )
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

  await waitFor(() =>
    expect(mutations.SaveRagKnowledgeSource).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          enabled: true,
          baseUrl: 'http://nas.local:8787',
          token: 'n'.repeat(40),
          agentSlugs: ['main-agent'],
          pathPrefixes: ['团队/研发'],
          timeoutMs: 4000,
        }),
      },
    })
  )
  expect(await screen.findByText('已保存知识库配置')).toBeInTheDocument()
})

it('omits the token when the field is left empty', async () => {
  render(<KnowledgeSettings />)

  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

  await waitFor(() => {
    const [{ variables }] = mutations.SaveRagKnowledgeSource.mock.calls[0]
    expect(variables.input).not.toHaveProperty('token')
  })
})

it('renders the connection test checks', async () => {
  render(<KnowledgeSettings />)

  fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

  expect(await screen.findByText('连接正常（12 ms）')).toBeInTheDocument()
  expect(screen.getByText('服务存活检查')).toBeInTheDocument()
  expect(screen.getByText('检索接口与鉴权')).toBeInTheDocument()
  expect(screen.getByText('返回 empty')).toBeInTheDocument()
})

it('surfaces a server error on save', async () => {
  mutations.SaveRagKnowledgeSource.mockRejectedValue(
    new Error('服务地址只填到端口，不要带路径')
  )
  render(<KnowledgeSettings />)

  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

  expect(
    await screen.findByText('服务地址只填到端口，不要带路径')
  ).toBeInTheDocument()
})
