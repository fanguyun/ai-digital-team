import { db } from 'src/lib/db'
import { createSession, ensureBootstrapUser } from 'src/lib/sessions'

import { handler } from './graphql'

type GraphQLBody = {
  data?: Record<string, unknown> | null
  errors?: Array<{ message: string }>
}

const graphqlRequest = async ({
  query,
  variables,
  token,
  cookie,
}: {
  query: string
  variables?: Record<string, unknown>
  token?: string
  cookie?: string
}) => {
  const response = await handler(
    {
      body: JSON.stringify({ query, variables }),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { cookie } : {}),
      },
      httpMethod: 'POST',
      isBase64Encoded: false,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      path: '/graphql',
      pathParameters: null,
      queryStringParameters: null,
      requestContext: {} as never,
      resource: '/graphql',
      stageVariables: null,
    },
    {} as never
  )

  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body) as GraphQLBody,
  }
}

describe('task runtime GraphQL API', () => {
  const token = 'graphql-test-runtime-token'
  let sessionCookie = ''

  beforeAll(async () => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = token
    process.env.AUTH_USERNAME = 'fan'
    process.env.AUTH_PASSWORD = 'graphql-test-password'
    await ensureBootstrapUser()
    const user = await db.user.findUniqueOrThrow({ where: { username: 'fan' } })
    sessionCookie = `pdt_session=${(await createSession(user)).token}`
  })

  beforeEach(async () => {
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
  })

  it('rejects writes without the runtime token', async () => {
    const result = await graphqlRequest({
      query: `
        mutation CreateTask($input: CreateTaskRunInput!) {
          createTaskRun(input: $input) { id }
        }
      `,
      variables: {
        input: {
          title: 'Unauthorized task',
          platform: 'codex',
          primaryAgent: 'software-engineer-agent',
          idempotencyKey: 'graphql-unauthorized',
        },
      },
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.data).toBeNull()
    expect(result.body.errors?.[0].message).toBe('Invalid runtime writer token')
  })

  it('creates, queries, and reports runtime health', async () => {
    const createResult = await graphqlRequest({
      token,
      query: `
        mutation CreateTask($input: CreateTaskRunInput!) {
          createTaskRun(input: $input) {
            id
            status
            currentStage
          }
        }
      `,
      variables: {
        input: {
          title: 'GraphQL task',
          platform: 'codex',
          primaryAgent: 'software-engineer-agent',
          status: 'RUNNING',
          stage: 'EXECUTION',
          summary: 'GraphQL integration test',
          inputTokens: 2000000000,
          idempotencyKey: 'graphql-create',
        },
      },
    })

    expect(createResult.body.errors).toBeUndefined()
    const created = createResult.body.data?.createTaskRun as { id: string }

    const usageResult = await graphqlRequest({
      token,
      query: `
        mutation AppendEvent($taskRunId: ID!, $input: AppendTaskEventInput!) {
          appendTaskEvent(taskRunId: $taskRunId, input: $input) { duplicate }
        }
      `,
      variables: {
        taskRunId: created.id,
        input: {
          eventType: 'usage.reported',
          stage: 'EXECUTION',
          agent: 'software-engineer-agent',
          summary: 'Report incremental usage',
          inputTokens: 200000000,
          idempotencyKey: 'graphql-large-usage',
        },
      },
    })
    expect(usageResult.body.errors).toBeUndefined()

    const queryResult = await graphqlRequest({
      cookie: sessionCookie,
      query: `
        query TaskRuntime($id: ID!) {
          taskRun(id: $id) {
            id
            title
            events { sequence eventType }
          }
          runtimeHealth {
            database { status }
            realtime { status }
          }
          teamRuntimeOverview {
            totalWorkCount
            totalTaskCount
            trackedWorkCount
            totalTokens
            inputTokenCoverage
            outputTokenCoverage
            cachedTokenCoverage
            totalTokenCoverage
            agents {
              agent
              workCount
              latestModelId
              inputTokenCoverage
              outputTokenCoverage
              cachedTokenCoverage
              totalTokenCoverage
            }
          }
        }
      `,
      variables: { id: created.id },
    })

    expect(queryResult.body).toMatchObject({
      data: {
        taskRun: {
          id: created.id,
          title: 'GraphQL task',
          events: [
            { sequence: 1, eventType: 'task.created' },
            { sequence: 2, eventType: 'usage.reported' },
          ],
        },
        runtimeHealth: {
          database: { status: 'UP' },
          realtime: { status: 'DOWN' },
        },
        teamRuntimeOverview: {
          totalWorkCount: 1,
          totalTaskCount: 1,
          trackedWorkCount: 1,
          totalTokens: 2200000000,
          inputTokenCoverage: 'COMPLETE',
          outputTokenCoverage: 'NONE',
          cachedTokenCoverage: 'NONE',
          totalTokenCoverage: 'PARTIAL',
          agents: [
            {
              agent: 'software-engineer-agent',
              workCount: 1,
              latestModelId: null,
              inputTokenCoverage: 'COMPLETE',
              outputTokenCoverage: 'NONE',
              cachedTokenCoverage: 'NONE',
              totalTokenCoverage: 'PARTIAL',
            },
          ],
        },
      },
    })
  })

  it('returns a user-facing error for an invalid transition', async () => {
    const created = await graphqlRequest({
      token,
      query: `
        mutation CreateTask($input: CreateTaskRunInput!) {
          createTaskRun(input: $input) { id }
        }
      `,
      variables: {
        input: {
          title: 'Invalid transition task',
          platform: 'codex',
          primaryAgent: 'software-engineer-agent',
          status: 'RUNNING',
          stage: 'EXECUTION',
          idempotencyKey: 'graphql-invalid-create',
        },
      },
    })
    const taskRun = created.body.data?.createTaskRun as { id: string }

    const result = await graphqlRequest({
      token,
      query: `
        mutation AppendEvent($taskRunId: ID!, $input: AppendTaskEventInput!) {
          appendTaskEvent(taskRunId: $taskRunId, input: $input) {
            duplicate
          }
        }
      `,
      variables: {
        taskRunId: taskRun.id,
        input: {
          eventType: 'planning.reopened',
          status: 'RUNNING',
          stage: 'PLANNING',
          agent: 'product-solution-agent',
          summary: 'Illegal stage regression',
          idempotencyKey: 'graphql-invalid-event',
        },
      },
    })

    expect(result.body.data).toBeNull()
    expect(result.body.errors?.[0].message).toBe(
      'Task stage cannot move backwards'
    )
  })
})
