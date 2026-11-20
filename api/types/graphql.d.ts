import { Prisma } from "src/lib/db"
import { MergePrismaWithSdlTypes, MakeRelationsOptional } from '@cedarjs/api'
import { TaskRun as PrismaTaskRun, User as PrismaUser, AuthSession as PrismaAuthSession, TaskEvent as PrismaTaskEvent, RemoteApp as PrismaRemoteApp, RoleEvaluation as PrismaRoleEvaluation, Task as PrismaTask, TaskArtifact as PrismaTaskArtifact, TaskImage as PrismaTaskImage, TaskTemplate as PrismaTaskTemplate } from 'src/lib/db'
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { CedarGraphQLContext } from '@cedarjs/graphql-server/dist/types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type ResolverFn<TResult, TParent, TContext, TArgs> = (
      args?: TArgs,
      obj?: { root: TParent; context: TContext; info: GraphQLResolveInfo }
    ) => TResult | Promise<TResult>
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
export type OptArgsResolverFn<TResult, TParent = {}, TContext = {}, TArgs = {}> = (
      args?: TArgs,
      obj?: { root: TParent; context: TContext; info: GraphQLResolveInfo }
    ) => TResult | Promise<TResult>

    export type RequiredResolverFn<TResult, TParent = {}, TContext = {}, TArgs = {}> = (
      args: TArgs,
      obj: { root: TParent; context: TContext; info: GraphQLResolveInfo }
    ) => TResult | Promise<TResult>
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: number; output: number; }
  Byte: { input: Uint8Array; output: Uint8Array; }
  Date: { input: Date | string; output: Date | string; }
  DateTime: { input: Date | string; output: Date | string; }
  File: { input: File; output: File; }
  JSON: { input: Prisma.JsonValue; output: Prisma.JsonValue; }
  JSONObject: { input: Prisma.JsonObject; output: Prisma.JsonObject; }
  Time: { input: Date | string; output: Date | string; }
};

export type ActiveTaskRun = {
  __typename?: 'ActiveTaskRun';
  currentStage: TaskRunStage;
  id: Scalars['ID']['output'];
  primaryAgent: Scalars['String']['output'];
  status: TaskRunStatus;
  taskId?: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AddTaskArtifactInput = {
  kind?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  path: Scalars['String']['input'];
};

export type AgentCapabilityHealth = {
  __typename?: 'AgentCapabilityHealth';
  agentInstalled: Scalars['Boolean']['output'];
  assessment: Scalars['String']['output'];
  missingOptionalSkills: Array<Scalars['String']['output']>;
  missingRequiredSkills: Array<Scalars['String']['output']>;
  missingRequiredTools: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  optionalSkills: Array<CapabilitySkillCheck>;
  platformSupported: Scalars['Boolean']['output'];
  requiredSkills: Array<CapabilitySkillCheck>;
  requiredTools: Array<CapabilityToolCheck>;
  slug: Scalars['String']['output'];
  status: Scalars['String']['output'];
  suggestions: Array<Scalars['String']['output']>;
  unboundRequiredSkills: Array<Scalars['String']['output']>;
};

export type AgentRuntimeMetric = {
  __typename?: 'AgentRuntimeMetric';
  agent: Scalars['String']['output'];
  cachedTokenCoverage: RuntimeMetricCoverage;
  cachedTokens: Scalars['Float']['output'];
  firstTaskAt?: Maybe<Scalars['DateTime']['output']>;
  inputTokenCoverage: RuntimeMetricCoverage;
  inputTokens: Scalars['Float']['output'];
  lastTaskAt?: Maybe<Scalars['DateTime']['output']>;
  latestModelId?: Maybe<Scalars['String']['output']>;
  outputTokenCoverage: RuntimeMetricCoverage;
  outputTokens: Scalars['Float']['output'];
  queuedCount: Scalars['Int']['output'];
  runningCount: Scalars['Int']['output'];
  totalTokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
  trackedWorkCount: Scalars['Int']['output'];
  waitingCount: Scalars['Int']['output'];
  workCount: Scalars['Int']['output'];
};

export type AppendTaskEventInput = {
  agent: Scalars['String']['input'];
  cachedTokens?: InputMaybe<Scalars['Int']['input']>;
  eventType: Scalars['String']['input'];
  evidence?: InputMaybe<Scalars['JSON']['input']>;
  idempotencyKey: Scalars['String']['input'];
  inputTokens?: InputMaybe<Scalars['Int']['input']>;
  modelId?: InputMaybe<Scalars['String']['input']>;
  outputTokens?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['String']['input']>>;
  stage: TaskRunStage;
  status?: InputMaybe<TaskRunStatus>;
  summary: Scalars['String']['input'];
};

export type AppendTaskEventResult = {
  __typename?: 'AppendTaskEventResult';
  duplicate: Scalars['Boolean']['output'];
  event: TaskEvent;
  taskRun: TaskRun;
};

export type CapabilityApplyResult = {
  __typename?: 'CapabilityApplyResult';
  agentSlug: Scalars['String']['output'];
  applied: Array<CapabilityFixResult>;
};

export type CapabilityCliCheck = {
  __typename?: 'CapabilityCliCheck';
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type CapabilityFixItem = {
  __typename?: 'CapabilityFixItem';
  blockedReason?: Maybe<Scalars['String']['output']>;
  canApply: Scalars['Boolean']['output'];
  kind: Scalars['String']['output'];
  linkPath?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  severity: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  steps: Array<CapabilityFixStep>;
  title: Scalars['String']['output'];
};

export type CapabilityFixPlan = {
  __typename?: 'CapabilityFixPlan';
  agentName: Scalars['String']['output'];
  agentSlug: Scalars['String']['output'];
  items: Array<CapabilityFixItem>;
};

export type CapabilityFixResult = {
  __typename?: 'CapabilityFixResult';
  changed: Scalars['Boolean']['output'];
  linkPath: Scalars['String']['output'];
  message: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
  skill: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
};

export type CapabilityFixStep = {
  __typename?: 'CapabilityFixStep';
  detail?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
};

export type CapabilityHealth = {
  __typename?: 'CapabilityHealth';
  cli: Array<CapabilityCliCheck>;
  generatedAt: Scalars['DateTime']['output'];
  reports: Array<CapabilityPlatformReport>;
};

export type CapabilityPlatformReport = {
  __typename?: 'CapabilityPlatformReport';
  agents: Array<AgentCapabilityHealth>;
  generatedAt: Scalars['DateTime']['output'];
  platform: Scalars['String']['output'];
  summary: CapabilitySummary;
};

export type CapabilitySkillCheck = {
  __typename?: 'CapabilitySkillCheck';
  available: Scalars['Boolean']['output'];
  bound: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  path?: Maybe<Scalars['String']['output']>;
};

export type CapabilitySummary = {
  __typename?: 'CapabilitySummary';
  complete: Scalars['Int']['output'];
  notInstalled: Scalars['Int']['output'];
  partial: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  unbound: Scalars['Int']['output'];
};

export type CapabilityToolCheck = {
  __typename?: 'CapabilityToolCheck';
  available: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  path?: Maybe<Scalars['String']['output']>;
};

/**
 * The Cedar Root Schema
 *
 * Defines details about Cedar such as the current user and version information.
 */
export type Cedar = {
  __typename?: 'Cedar';
  /** The current user. */
  currentUser?: Maybe<Scalars['JSON']['output']>;
  /** The version of Prisma. */
  prismaVersion?: Maybe<Scalars['String']['output']>;
  /** The version of CedarJS. */
  version?: Maybe<Scalars['String']['output']>;
};

export type CreateRemoteAppInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  url: Scalars['String']['input'];
};

export type CreateTaskInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  agentSlug: Scalars['String']['input'];
  brief: Scalars['String']['input'];
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  mode?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['String']['input']>;
  readOnly?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};

export type CreateTaskRunInput = {
  cachedTokens?: InputMaybe<Scalars['Int']['input']>;
  evidence?: InputMaybe<Scalars['JSON']['input']>;
  externalReference?: InputMaybe<Scalars['String']['input']>;
  idempotencyKey: Scalars['String']['input'];
  inputTokens?: InputMaybe<Scalars['Int']['input']>;
  modelId?: InputMaybe<Scalars['String']['input']>;
  outputTokens?: InputMaybe<Scalars['Int']['input']>;
  platform: Scalars['String']['input'];
  primaryAgent: Scalars['String']['input'];
  skills?: InputMaybe<Array<Scalars['String']['input']>>;
  stage?: InputMaybe<TaskRunStage>;
  status?: InputMaybe<TaskRunStatus>;
  summary?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateTaskTemplateInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  agentSlug: Scalars['String']['input'];
  brief: Scalars['String']['input'];
  name: Scalars['String']['input'];
  priority?: InputMaybe<Scalars['String']['input']>;
  readOnly?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};

export type DeliveryDirectoryStat = {
  __typename?: 'DeliveryDirectoryStat';
  added: Scalars['Int']['output'];
  directory: Scalars['String']['output'];
  files: Scalars['Int']['output'];
  removed: Scalars['Int']['output'];
};

export type DeliveryStat = {
  __typename?: 'DeliveryStat';
  added: Scalars['Int']['output'];
  files: Scalars['Int']['output'];
  removed: Scalars['Int']['output'];
};

export type DispatchRoleEvaluationInput = {
  agentSlug: Scalars['String']['input'];
  tool: Scalars['String']['input'];
};

export type InstalledSkill = {
  __typename?: 'InstalledSkill';
  body: Scalars['String']['output'];
  codexEnabled: Scalars['Boolean']['output'];
  description: Scalars['String']['output'];
  dshEnabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  source: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  updatable: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addTaskArtifact: Task;
  appendTaskEvent: AppendTaskEventResult;
  cancelTask: Task;
  capabilityApplyFixes: CapabilityApplyResult;
  capabilityFixPlan: CapabilityFixPlan;
  createRemoteApp: RemoteApp;
  createTask: Task;
  createTaskRun: TaskRun;
  createTaskTemplate: TaskTemplate;
  deleteRemoteApp: RemoteApp;
  deleteTaskTemplate: TaskTemplate;
  dispatchRoleEvaluation: RoleEvaluationDispatch;
  dispatchTask: Task;
  dispatchTasks: Array<Task>;
  executeTaskPlan: Task;
  /** 手动刷新运行状态：重新读取会话快照，必要时按已结束收尾 */
  refreshRun: TaskRun;
  /** 手动刷新任务状态：进程已退出/日志不动时按日志收尾并推进任务 */
  refreshTask: Task;
  removeTaskArtifact: Task;
  reviewTask: Task;
  reviseTaskPlan: Task;
  sendRoleEvaluationMessage: RoleEvaluation;
  updateInstalledSkill: UpdateInstalledSkillResult;
  updateRemoteApp: RemoteApp;
  updateTask: Task;
  updateTaskTemplate: TaskTemplate;
  uploadTaskImage: TaskImage;
};


export type MutationaddTaskArtifactArgs = {
  input: AddTaskArtifactInput;
  taskId: Scalars['ID']['input'];
};


export type MutationappendTaskEventArgs = {
  input: AppendTaskEventInput;
  taskRunId: Scalars['ID']['input'];
};


export type MutationcancelTaskArgs = {
  id: Scalars['ID']['input'];
};


export type MutationcapabilityApplyFixesArgs = {
  agentSlug: Scalars['String']['input'];
};


export type MutationcapabilityFixPlanArgs = {
  agentSlug: Scalars['String']['input'];
};


export type MutationcreateRemoteAppArgs = {
  input: CreateRemoteAppInput;
};


export type MutationcreateTaskArgs = {
  input: CreateTaskInput;
};


export type MutationcreateTaskRunArgs = {
  input: CreateTaskRunInput;
};


export type MutationcreateTaskTemplateArgs = {
  input: CreateTaskTemplateInput;
};


export type MutationdeleteRemoteAppArgs = {
  id: Scalars['ID']['input'];
};


export type MutationdeleteTaskTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationdispatchRoleEvaluationArgs = {
  input: DispatchRoleEvaluationInput;
};


export type MutationdispatchTaskArgs = {
  id: Scalars['ID']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
};


export type MutationdispatchTasksArgs = {
  ids: Array<Scalars['ID']['input']>;
  tool?: InputMaybe<Scalars['String']['input']>;
};


export type MutationexecuteTaskPlanArgs = {
  id: Scalars['ID']['input'];
  planPath: Scalars['String']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
};


export type MutationrefreshRunArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationrefreshTaskArgs = {
  id: Scalars['ID']['input'];
};


export type MutationremoveTaskArtifactArgs = {
  id: Scalars['ID']['input'];
};


export type MutationreviewTaskArgs = {
  decision: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
};


export type MutationreviseTaskPlanArgs = {
  id: Scalars['ID']['input'];
  note: Scalars['String']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
};


export type MutationsendRoleEvaluationMessageArgs = {
  id: Scalars['ID']['input'];
  message: Scalars['String']['input'];
};


export type MutationupdateInstalledSkillArgs = {
  id: Scalars['ID']['input'];
};


export type MutationupdateRemoteAppArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRemoteAppInput;
};


export type MutationupdateTaskArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
};


export type MutationupdateTaskTemplateArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTaskTemplateInput;
};


export type MutationuploadTaskImageArgs = {
  input: UploadTaskImageInput;
};

/** About the Cedar queries. */
export type Query = {
  __typename?: 'Query';
  capabilityHealth: CapabilityHealth;
  /** Fetches the Cedar root schema. */
  cedar?: Maybe<Cedar>;
  installedSkills: Array<InstalledSkill>;
  /**
   * Fetches the Cedar root schema.
   * @deprecated Use 'cedar' instead.
   */
  redwood?: Maybe<Redwood>;
  remoteApp?: Maybe<RemoteApp>;
  remoteApps: Array<RemoteApp>;
  roleEvaluationMessages: Array<RoleEvaluationMessage>;
  roleEvaluationReport: Scalars['String']['output'];
  roleEvaluationTools: Array<RoleEvaluationTool>;
  roleEvaluations: Array<RoleEvaluation>;
  runtimeHealth: RuntimeHealth;
  task?: Maybe<Task>;
  taskArtifactContent: Scalars['String']['output'];
  taskImageDataUrl: Scalars['String']['output'];
  taskPlanContent: Scalars['String']['output'];
  taskPrecheck: TaskPrecheck;
  taskPulse: TaskPulse;
  taskRun?: Maybe<TaskRun>;
  taskRunLog: Scalars['String']['output'];
  taskRunMessages: Array<TaskRunMessage>;
  taskRunTrace: TaskRunTrace;
  taskRuns: TaskRunConnection;
  taskTemplates: Array<TaskTemplate>;
  /** 按创建时间筛选：from/to 为 ISO 时间 */
  tasks: Array<Task>;
  teamRuntimeOverview: TeamRuntimeOverview;
  teamWeeklyReport: TeamWeeklyReport;
  workspaceStatus: WorkspaceStatus;
};


/** About the Cedar queries. */
export type QueryremoteAppArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QueryroleEvaluationMessagesArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QueryroleEvaluationReportArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QueryroleEvaluationsArgs = {
  agentSlug?: InputMaybe<Scalars['String']['input']>;
};


/** About the Cedar queries. */
export type QuerytaskArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskArtifactContentArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskImageDataUrlArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskPlanContentArgs = {
  planPath?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskPrecheckArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunLogArgs = {
  runId: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunMessagesArgs = {
  runId: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunTraceArgs = {
  runId: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TaskRunFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};


/** About the Cedar queries. */
export type QuerytasksArgs = {
  agentSlug?: InputMaybe<Scalars['String']['input']>;
  from?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
  to?: InputMaybe<Scalars['DateTime']['input']>;
};


/** About the Cedar queries. */
export type QueryteamRuntimeOverviewArgs = {
  range?: InputMaybe<RuntimeTimeRange>;
};


/** About the Cedar queries. */
export type QueryteamWeeklyReportArgs = {
  range: RuntimeTimeRange;
};

export type Redwood = {
  __typename?: 'Redwood';
  /**
   * The current user.
   * @deprecated Use the Cedar type instead.
   */
  currentUser?: Maybe<Scalars['JSON']['output']>;
  /**
   * The version of Prisma.
   * @deprecated Use the Cedar type instead.
   */
  prismaVersion?: Maybe<Scalars['String']['output']>;
  /**
   * The version of CedarJS.
   * @deprecated Use the Cedar type instead.
   */
  version?: Maybe<Scalars['String']['output']>;
};

export type RemoteApp = {
  __typename?: 'RemoteApp';
  createdAt: Scalars['DateTime']['output'];
  icon: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
};

export type RoleEvaluation = {
  __typename?: 'RoleEvaluation';
  agentName: Scalars['String']['output'];
  agentSlug: Scalars['String']['output'];
  /** 失败时从日志尾部取到的真实报错（成功或运行中为 null） */
  failureReason?: Maybe<Scalars['String']['output']>;
  finishedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  logPath: Scalars['String']['output'];
  pid?: Maybe<Scalars['Int']['output']>;
  projectKey: Scalars['String']['output'];
  projectRoot: Scalars['String']['output'];
  reportPath: Scalars['String']['output'];
  sessionId?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['DateTime']['output'];
  status: Scalars['String']['output'];
  taskId?: Maybe<Scalars['ID']['output']>;
  tool: Scalars['String']['output'];
};

export type RoleEvaluationDispatch = {
  __typename?: 'RoleEvaluationDispatch';
  agentName: Scalars['String']['output'];
  agentSlug: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  logPath: Scalars['String']['output'];
  pid?: Maybe<Scalars['Int']['output']>;
  projectKey: Scalars['String']['output'];
  projectRoot: Scalars['String']['output'];
  prompt: Scalars['String']['output'];
  reportPath: Scalars['String']['output'];
  resultPath: Scalars['String']['output'];
  sessionId?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['DateTime']['output'];
  tool: Scalars['String']['output'];
};

export type RoleEvaluationMessage = {
  __typename?: 'RoleEvaluationMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  role: Scalars['String']['output'];
};

export type RoleEvaluationTool = {
  __typename?: 'RoleEvaluationTool';
  available: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  version?: Maybe<Scalars['String']['output']>;
};

export type RuntimeComponentHealth = {
  __typename?: 'RuntimeComponentHealth';
  message?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
};

export type RuntimeHealth = {
  __typename?: 'RuntimeHealth';
  database: RuntimeComponentHealth;
  realtime: RuntimeComponentHealth;
  serverTime: Scalars['DateTime']['output'];
};

export type RuntimeMetricCoverage =
  | 'COMPLETE'
  | 'NONE'
  | 'PARTIAL';

export type RuntimeTimeRange = {
  from?: InputMaybe<Scalars['DateTime']['input']>;
  to?: InputMaybe<Scalars['DateTime']['input']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  taskRunChanged: TaskRun;
  taskRunsChanged: TaskRun;
};


export type SubscriptiontaskRunChangedArgs = {
  taskRunId: Scalars['ID']['input'];
};

export type Task = {
  __typename?: 'Task';
  acceptance: Scalars['String']['output'];
  agentSlug: Scalars['String']['output'];
  artifacts: Array<TaskArtifact>;
  brief: Scalars['String']['output'];
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dueAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  mode: Scalars['String']['output'];
  planNote?: Maybe<Scalars['String']['output']>;
  planPath?: Maybe<Scalars['String']['output']>;
  priority: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  reviewNote?: Maybe<Scalars['String']['output']>;
  reviewedAt?: Maybe<Scalars['DateTime']['output']>;
  runs: Array<TaskRun>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TaskArtifact = {
  __typename?: 'TaskArtifact';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  label: Scalars['String']['output'];
  path: Scalars['String']['output'];
  source: Scalars['String']['output'];
  taskId: Scalars['ID']['output'];
};

export type TaskEvent = {
  __typename?: 'TaskEvent';
  agent: Scalars['String']['output'];
  cachedTokens?: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['DateTime']['output'];
  eventType: Scalars['String']['output'];
  evidence?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  idempotencyKey: Scalars['String']['output'];
  inputTokens?: Maybe<Scalars['Int']['output']>;
  modelId?: Maybe<Scalars['String']['output']>;
  outputTokens?: Maybe<Scalars['Int']['output']>;
  sequence: Scalars['Int']['output'];
  skills: Array<Scalars['String']['output']>;
  stage: TaskRunStage;
  status?: Maybe<TaskRunStatus>;
  summary: Scalars['String']['output'];
  taskRunId: Scalars['ID']['output'];
};

export type TaskImage = {
  __typename?: 'TaskImage';
  bytes: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  mime: Scalars['String']['output'];
  path: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type TaskPrecheck = {
  __typename?: 'TaskPrecheck';
  expectedPaths: Array<Scalars['String']['output']>;
  warnings: Array<Scalars['String']['output']>;
};

export type TaskPulse = {
  __typename?: 'TaskPulse';
  awaitingReview: Scalars['Int']['output'];
  completedToday: Scalars['Int']['output'];
  failedToday: Scalars['Int']['output'];
  queued: Scalars['Int']['output'];
  running: Scalars['Int']['output'];
};

export type TaskRun = {
  __typename?: 'TaskRun';
  cachedTokens?: Maybe<Scalars['Int']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  currentStage: TaskRunStage;
  dirtyAtDispatch: Scalars['Boolean']['output'];
  events: Array<TaskEvent>;
  externalReference?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  inputTokens?: Maybe<Scalars['Int']['output']>;
  logPath?: Maybe<Scalars['String']['output']>;
  mode: Scalars['String']['output'];
  outputTokens?: Maybe<Scalars['Int']['output']>;
  platform: Scalars['String']['output'];
  primaryAgent: Scalars['String']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: TaskRunStatus;
  summary?: Maybe<Scalars['String']['output']>;
  task?: Maybe<Task>;
  taskId?: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type TaskRunConnection = {
  __typename?: 'TaskRunConnection';
  edges: Array<TaskRunEdge>;
  pageInfo: TaskRunPageInfo;
  statusCounts: Array<TaskRunStatusCount>;
  totalCount: Scalars['Int']['output'];
};

export type TaskRunEdge = {
  __typename?: 'TaskRunEdge';
  cursor: Scalars['String']['output'];
  node: TaskRun;
};

export type TaskRunFilter = {
  platform?: InputMaybe<Scalars['String']['input']>;
  primaryAgent?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<TaskRunStatus>>;
};

export type TaskRunMessage = {
  __typename?: 'TaskRunMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  role: Scalars['String']['output'];
  step?: Maybe<Scalars['Int']['output']>;
};

export type TaskRunPageInfo = {
  __typename?: 'TaskRunPageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

export type TaskRunStage =
  | 'DELIVERY'
  | 'EXECUTION'
  | 'INTAKE'
  | 'PLANNING'
  | 'VERIFICATION';

export type TaskRunStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_CONFIRMATION';

export type TaskRunStatusCount = {
  __typename?: 'TaskRunStatusCount';
  count: Scalars['Int']['output'];
  status: TaskRunStatus;
};

export type TaskRunTool = {
  __typename?: 'TaskRunTool';
  createdAt: Scalars['DateTime']['output'];
  detail: Scalars['String']['output'];
  name: Scalars['String']['output'];
  redacted: Scalars['Boolean']['output'];
  result: Scalars['String']['output'];
  resultTruncated: Scalars['Boolean']['output'];
  step?: Maybe<Scalars['Int']['output']>;
};

export type TaskRunTrace = {
  __typename?: 'TaskRunTrace';
  messages: Array<TaskRunMessage>;
  source: Scalars['String']['output'];
  tools: Array<TaskRunTool>;
  truncated: Scalars['Boolean']['output'];
  turn?: Maybe<Scalars['Int']['output']>;
};

export type TaskTemplate = {
  __typename?: 'TaskTemplate';
  acceptance: Scalars['String']['output'];
  agentSlug: Scalars['String']['output'];
  brief: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  priority: Scalars['String']['output'];
  readOnly: Scalars['Boolean']['output'];
  title: Scalars['String']['output'];
};

export type TeamDeliveryStat = {
  __typename?: 'TeamDeliveryStat';
  added: Scalars['Int']['output'];
  byDirectory: Array<DeliveryDirectoryStat>;
  /** 有交付统计的运行数 */
  coveredRuns: Scalars['Int']['output'];
  files: Scalars['Int']['output'];
  removed: Scalars['Int']['output'];
  totalRuns: Scalars['Int']['output'];
  uncategorized: DeliveryStat;
};

export type TeamRuntimeOverview = {
  __typename?: 'TeamRuntimeOverview';
  activeTasks: Array<ActiveTaskRun>;
  agents: Array<AgentRuntimeMetric>;
  cachedTokenCoverage: RuntimeMetricCoverage;
  cachedTokens: Scalars['Float']['output'];
  inputTokenCoverage: RuntimeMetricCoverage;
  inputTokens: Scalars['Float']['output'];
  outputTokenCoverage: RuntimeMetricCoverage;
  outputTokens: Scalars['Float']['output'];
  queuedCount: Scalars['Int']['output'];
  runningCount: Scalars['Int']['output'];
  totalTaskCount: Scalars['Int']['output'];
  totalTokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
  totalWorkCount: Scalars['Int']['output'];
  trackedWorkCount: Scalars['Int']['output'];
  waitingCount: Scalars['Int']['output'];
};

export type TeamWeeklyReport = {
  __typename?: 'TeamWeeklyReport';
  cachedTokens: Scalars['Float']['output'];
  cancelledTasks: Scalars['Int']['output'];
  completed: Array<WeeklyTaskItem>;
  completedTasks: Scalars['Int']['output'];
  contributions: Array<WeeklyAgentContribution>;
  delivery: TeamDeliveryStat;
  failedTasks: Scalars['Int']['output'];
  failures: Array<WeeklyTaskItem>;
  from: Scalars['DateTime']['output'];
  generatedAt: Scalars['DateTime']['output'];
  headline: Scalars['String']['output'];
  inputTokens: Scalars['Float']['output'];
  outputTokens: Scalars['Float']['output'];
  pending: Array<WeeklyTaskItem>;
  pendingTasks: Scalars['Int']['output'];
  to: Scalars['DateTime']['output'];
  totalTasks: Scalars['Int']['output'];
  totalTokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
};

export type UpdateInstalledSkillResult = {
  __typename?: 'UpdateInstalledSkillResult';
  message: Scalars['String']['output'];
  skill: InstalledSkill;
};

export type UpdateRemoteAppInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  agentSlug?: InputMaybe<Scalars['String']['input']>;
  brief?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['DateTime']['input']>;
  mode?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['String']['input']>;
  readOnly?: InputMaybe<Scalars['Boolean']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskTemplateInput = {
  acceptance?: InputMaybe<Scalars['String']['input']>;
  agentSlug?: InputMaybe<Scalars['String']['input']>;
  brief?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['String']['input']>;
  readOnly?: InputMaybe<Scalars['Boolean']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UploadTaskImageInput = {
  dataUrl: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type WeeklyAgentContribution = {
  __typename?: 'WeeklyAgentContribution';
  agent: Scalars['String']['output'];
  tokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
  trackedWorkCount: Scalars['Int']['output'];
  workCount: Scalars['Int']['output'];
};

export type WeeklyTaskItem = {
  __typename?: 'WeeklyTaskItem';
  currentStage: TaskRunStage;
  id: Scalars['ID']['output'];
  primaryAgent: Scalars['String']['output'];
  status: TaskRunStatus;
  summary?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type WorkspaceStatus = {
  __typename?: 'WorkspaceStatus';
  changedCount: Scalars['Int']['output'];
  dirty: Scalars['Boolean']['output'];
};

type MaybeOrArrayOfMaybe<T> = T | Maybe<T> | Maybe<T>[];
type AllMappedModels = MaybeOrArrayOfMaybe<RemoteApp | RoleEvaluation | Task | TaskArtifact | TaskEvent | TaskImage | TaskRun | TaskTemplate>


export type ResolverTypeWrapper<T> = Promise<T> | T;

export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs>;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActiveTaskRun: ResolverTypeWrapper<ActiveTaskRun>;
  AddTaskArtifactInput: AddTaskArtifactInput;
  AgentCapabilityHealth: ResolverTypeWrapper<AgentCapabilityHealth>;
  AgentRuntimeMetric: ResolverTypeWrapper<AgentRuntimeMetric>;
  AppendTaskEventInput: AppendTaskEventInput;
  AppendTaskEventResult: ResolverTypeWrapper<Omit<AppendTaskEventResult, 'event' | 'taskRun'> & { event: ResolversTypes['TaskEvent'], taskRun: ResolversTypes['TaskRun'] }>;
  BigInt: ResolverTypeWrapper<Scalars['BigInt']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Byte: ResolverTypeWrapper<Scalars['Byte']['output']>;
  CapabilityApplyResult: ResolverTypeWrapper<CapabilityApplyResult>;
  CapabilityCliCheck: ResolverTypeWrapper<CapabilityCliCheck>;
  CapabilityFixItem: ResolverTypeWrapper<CapabilityFixItem>;
  CapabilityFixPlan: ResolverTypeWrapper<CapabilityFixPlan>;
  CapabilityFixResult: ResolverTypeWrapper<CapabilityFixResult>;
  CapabilityFixStep: ResolverTypeWrapper<CapabilityFixStep>;
  CapabilityHealth: ResolverTypeWrapper<CapabilityHealth>;
  CapabilityPlatformReport: ResolverTypeWrapper<CapabilityPlatformReport>;
  CapabilitySkillCheck: ResolverTypeWrapper<CapabilitySkillCheck>;
  CapabilitySummary: ResolverTypeWrapper<CapabilitySummary>;
  CapabilityToolCheck: ResolverTypeWrapper<CapabilityToolCheck>;
  Cedar: ResolverTypeWrapper<Cedar>;
  CreateRemoteAppInput: CreateRemoteAppInput;
  CreateTaskInput: CreateTaskInput;
  CreateTaskRunInput: CreateTaskRunInput;
  CreateTaskTemplateInput: CreateTaskTemplateInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DeliveryDirectoryStat: ResolverTypeWrapper<DeliveryDirectoryStat>;
  DeliveryStat: ResolverTypeWrapper<DeliveryStat>;
  DispatchRoleEvaluationInput: DispatchRoleEvaluationInput;
  File: ResolverTypeWrapper<Scalars['File']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  InstalledSkill: ResolverTypeWrapper<InstalledSkill>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Redwood: ResolverTypeWrapper<Redwood>;
  RemoteApp: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaRemoteApp, MakeRelationsOptional<RemoteApp, AllMappedModels>, AllMappedModels>>;
  RoleEvaluation: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaRoleEvaluation, MakeRelationsOptional<RoleEvaluation, AllMappedModels>, AllMappedModels>>;
  RoleEvaluationDispatch: ResolverTypeWrapper<RoleEvaluationDispatch>;
  RoleEvaluationMessage: ResolverTypeWrapper<RoleEvaluationMessage>;
  RoleEvaluationTool: ResolverTypeWrapper<RoleEvaluationTool>;
  RuntimeComponentHealth: ResolverTypeWrapper<RuntimeComponentHealth>;
  RuntimeHealth: ResolverTypeWrapper<RuntimeHealth>;
  RuntimeMetricCoverage: RuntimeMetricCoverage;
  RuntimeTimeRange: RuntimeTimeRange;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Task: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTask, MakeRelationsOptional<Task, AllMappedModels>, AllMappedModels>>;
  TaskArtifact: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskArtifact, MakeRelationsOptional<TaskArtifact, AllMappedModels>, AllMappedModels>>;
  TaskEvent: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskEvent, MakeRelationsOptional<TaskEvent, AllMappedModels>, AllMappedModels>>;
  TaskImage: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskImage, MakeRelationsOptional<TaskImage, AllMappedModels>, AllMappedModels>>;
  TaskPrecheck: ResolverTypeWrapper<TaskPrecheck>;
  TaskPulse: ResolverTypeWrapper<TaskPulse>;
  TaskRun: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskRun, MakeRelationsOptional<TaskRun, AllMappedModels>, AllMappedModels>>;
  TaskRunConnection: ResolverTypeWrapper<Omit<TaskRunConnection, 'edges'> & { edges: Array<ResolversTypes['TaskRunEdge']> }>;
  TaskRunEdge: ResolverTypeWrapper<Omit<TaskRunEdge, 'node'> & { node: ResolversTypes['TaskRun'] }>;
  TaskRunFilter: TaskRunFilter;
  TaskRunMessage: ResolverTypeWrapper<TaskRunMessage>;
  TaskRunPageInfo: ResolverTypeWrapper<TaskRunPageInfo>;
  TaskRunStage: TaskRunStage;
  TaskRunStatus: TaskRunStatus;
  TaskRunStatusCount: ResolverTypeWrapper<TaskRunStatusCount>;
  TaskRunTool: ResolverTypeWrapper<TaskRunTool>;
  TaskRunTrace: ResolverTypeWrapper<TaskRunTrace>;
  TaskTemplate: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskTemplate, MakeRelationsOptional<TaskTemplate, AllMappedModels>, AllMappedModels>>;
  TeamDeliveryStat: ResolverTypeWrapper<TeamDeliveryStat>;
  TeamRuntimeOverview: ResolverTypeWrapper<TeamRuntimeOverview>;
  TeamWeeklyReport: ResolverTypeWrapper<TeamWeeklyReport>;
  Time: ResolverTypeWrapper<Scalars['Time']['output']>;
  UpdateInstalledSkillResult: ResolverTypeWrapper<UpdateInstalledSkillResult>;
  UpdateRemoteAppInput: UpdateRemoteAppInput;
  UpdateTaskInput: UpdateTaskInput;
  UpdateTaskTemplateInput: UpdateTaskTemplateInput;
  UploadTaskImageInput: UploadTaskImageInput;
  WeeklyAgentContribution: ResolverTypeWrapper<WeeklyAgentContribution>;
  WeeklyTaskItem: ResolverTypeWrapper<WeeklyTaskItem>;
  WorkspaceStatus: ResolverTypeWrapper<WorkspaceStatus>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  ActiveTaskRun: ActiveTaskRun;
  AddTaskArtifactInput: AddTaskArtifactInput;
  AgentCapabilityHealth: AgentCapabilityHealth;
  AgentRuntimeMetric: AgentRuntimeMetric;
  AppendTaskEventInput: AppendTaskEventInput;
  AppendTaskEventResult: Omit<AppendTaskEventResult, 'event' | 'taskRun'> & { event: ResolversParentTypes['TaskEvent'], taskRun: ResolversParentTypes['TaskRun'] };
  BigInt: Scalars['BigInt']['output'];
  Boolean: Scalars['Boolean']['output'];
  Byte: Scalars['Byte']['output'];
  CapabilityApplyResult: CapabilityApplyResult;
  CapabilityCliCheck: CapabilityCliCheck;
  CapabilityFixItem: CapabilityFixItem;
  CapabilityFixPlan: CapabilityFixPlan;
  CapabilityFixResult: CapabilityFixResult;
  CapabilityFixStep: CapabilityFixStep;
  CapabilityHealth: CapabilityHealth;
  CapabilityPlatformReport: CapabilityPlatformReport;
  CapabilitySkillCheck: CapabilitySkillCheck;
  CapabilitySummary: CapabilitySummary;
  CapabilityToolCheck: CapabilityToolCheck;
  Cedar: Cedar;
  CreateRemoteAppInput: CreateRemoteAppInput;
  CreateTaskInput: CreateTaskInput;
  CreateTaskRunInput: CreateTaskRunInput;
  CreateTaskTemplateInput: CreateTaskTemplateInput;
  Date: Scalars['Date']['output'];
  DateTime: Scalars['DateTime']['output'];
  DeliveryDirectoryStat: DeliveryDirectoryStat;
  DeliveryStat: DeliveryStat;
  DispatchRoleEvaluationInput: DispatchRoleEvaluationInput;
  File: Scalars['File']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  InstalledSkill: InstalledSkill;
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  JSONObject: Scalars['JSONObject']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  Redwood: Redwood;
  RemoteApp: MergePrismaWithSdlTypes<PrismaRemoteApp, MakeRelationsOptional<RemoteApp, AllMappedModels>, AllMappedModels>;
  RoleEvaluation: MergePrismaWithSdlTypes<PrismaRoleEvaluation, MakeRelationsOptional<RoleEvaluation, AllMappedModels>, AllMappedModels>;
  RoleEvaluationDispatch: RoleEvaluationDispatch;
  RoleEvaluationMessage: RoleEvaluationMessage;
  RoleEvaluationTool: RoleEvaluationTool;
  RuntimeComponentHealth: RuntimeComponentHealth;
  RuntimeHealth: RuntimeHealth;
  RuntimeTimeRange: RuntimeTimeRange;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  Task: MergePrismaWithSdlTypes<PrismaTask, MakeRelationsOptional<Task, AllMappedModels>, AllMappedModels>;
  TaskArtifact: MergePrismaWithSdlTypes<PrismaTaskArtifact, MakeRelationsOptional<TaskArtifact, AllMappedModels>, AllMappedModels>;
  TaskEvent: MergePrismaWithSdlTypes<PrismaTaskEvent, MakeRelationsOptional<TaskEvent, AllMappedModels>, AllMappedModels>;
  TaskImage: MergePrismaWithSdlTypes<PrismaTaskImage, MakeRelationsOptional<TaskImage, AllMappedModels>, AllMappedModels>;
  TaskPrecheck: TaskPrecheck;
  TaskPulse: TaskPulse;
  TaskRun: MergePrismaWithSdlTypes<PrismaTaskRun, MakeRelationsOptional<TaskRun, AllMappedModels>, AllMappedModels>;
  TaskRunConnection: Omit<TaskRunConnection, 'edges'> & { edges: Array<ResolversParentTypes['TaskRunEdge']> };
  TaskRunEdge: Omit<TaskRunEdge, 'node'> & { node: ResolversParentTypes['TaskRun'] };
  TaskRunFilter: TaskRunFilter;
  TaskRunMessage: TaskRunMessage;
  TaskRunPageInfo: TaskRunPageInfo;
  TaskRunStatusCount: TaskRunStatusCount;
  TaskRunTool: TaskRunTool;
  TaskRunTrace: TaskRunTrace;
  TaskTemplate: MergePrismaWithSdlTypes<PrismaTaskTemplate, MakeRelationsOptional<TaskTemplate, AllMappedModels>, AllMappedModels>;
  TeamDeliveryStat: TeamDeliveryStat;
  TeamRuntimeOverview: TeamRuntimeOverview;
  TeamWeeklyReport: TeamWeeklyReport;
  Time: Scalars['Time']['output'];
  UpdateInstalledSkillResult: UpdateInstalledSkillResult;
  UpdateRemoteAppInput: UpdateRemoteAppInput;
  UpdateTaskInput: UpdateTaskInput;
  UpdateTaskTemplateInput: UpdateTaskTemplateInput;
  UploadTaskImageInput: UploadTaskImageInput;
  WeeklyAgentContribution: WeeklyAgentContribution;
  WeeklyTaskItem: WeeklyTaskItem;
  WorkspaceStatus: WorkspaceStatus;
};

export type requireAuthDirectiveArgs = {
  roles?: Maybe<Array<Maybe<Scalars['String']['input']>>>;
};

export type requireAuthDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireAuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type requireRuntimeWriterDirectiveArgs = { };

export type requireRuntimeWriterDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireRuntimeWriterDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type requireSessionOrRuntimeWriterDirectiveArgs = { };

export type requireSessionOrRuntimeWriterDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireSessionOrRuntimeWriterDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type requireSessionOrTeamReaderDirectiveArgs = { };

export type requireSessionOrTeamReaderDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireSessionOrTeamReaderDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type skipAuthDirectiveArgs = { };

export type skipAuthDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = skipAuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type ActiveTaskRunResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['ActiveTaskRun'] = ResolversParentTypes['ActiveTaskRun']> = {
  currentStage: OptArgsResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  primaryAgent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  taskId: OptArgsResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type ActiveTaskRunRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['ActiveTaskRun'] = ResolversParentTypes['ActiveTaskRun']> = {
  currentStage?: RequiredResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  primaryAgent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  taskId?: RequiredResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type AgentCapabilityHealthResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AgentCapabilityHealth'] = ResolversParentTypes['AgentCapabilityHealth']> = {
  agentInstalled: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  assessment: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  missingOptionalSkills: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  missingRequiredSkills: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  missingRequiredTools: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  optionalSkills: OptArgsResolverFn<Array<ResolversTypes['CapabilitySkillCheck']>, ParentType, ContextType>;
  platformSupported: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  requiredSkills: OptArgsResolverFn<Array<ResolversTypes['CapabilitySkillCheck']>, ParentType, ContextType>;
  requiredTools: OptArgsResolverFn<Array<ResolversTypes['CapabilityToolCheck']>, ParentType, ContextType>;
  slug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  suggestions: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  unboundRequiredSkills: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type AgentCapabilityHealthRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AgentCapabilityHealth'] = ResolversParentTypes['AgentCapabilityHealth']> = {
  agentInstalled?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  assessment?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  missingOptionalSkills?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  missingRequiredSkills?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  missingRequiredTools?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  optionalSkills?: RequiredResolverFn<Array<ResolversTypes['CapabilitySkillCheck']>, ParentType, ContextType>;
  platformSupported?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  requiredSkills?: RequiredResolverFn<Array<ResolversTypes['CapabilitySkillCheck']>, ParentType, ContextType>;
  requiredTools?: RequiredResolverFn<Array<ResolversTypes['CapabilityToolCheck']>, ParentType, ContextType>;
  slug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  suggestions?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  unboundRequiredSkills?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type AgentRuntimeMetricResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AgentRuntimeMetric'] = ResolversParentTypes['AgentRuntimeMetric']> = {
  agent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  cachedTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  firstTaskAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  inputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  lastTaskAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  latestModelId: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  outputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  queuedCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  runningCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  waitingCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  workCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AgentRuntimeMetricRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AgentRuntimeMetric'] = ResolversParentTypes['AgentRuntimeMetric']> = {
  agent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  cachedTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  firstTaskAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  inputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  lastTaskAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  latestModelId?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  outputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  queuedCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  runningCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  waitingCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  workCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AppendTaskEventResultResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AppendTaskEventResult'] = ResolversParentTypes['AppendTaskEventResult']> = {
  duplicate: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  event: OptArgsResolverFn<ResolversTypes['TaskEvent'], ParentType, ContextType>;
  taskRun: OptArgsResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export type AppendTaskEventResultRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['AppendTaskEventResult'] = ResolversParentTypes['AppendTaskEventResult']> = {
  duplicate?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  event?: RequiredResolverFn<ResolversTypes['TaskEvent'], ParentType, ContextType>;
  taskRun?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export interface BigIntScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['BigInt'], any> {
  name: 'BigInt';
}

export interface ByteScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Byte'], any> {
  name: 'Byte';
}

export type CapabilityApplyResultResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityApplyResult'] = ResolversParentTypes['CapabilityApplyResult']> = {
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  applied: OptArgsResolverFn<Array<ResolversTypes['CapabilityFixResult']>, ParentType, ContextType>;
};

export type CapabilityApplyResultRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityApplyResult'] = ResolversParentTypes['CapabilityApplyResult']> = {
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  applied?: RequiredResolverFn<Array<ResolversTypes['CapabilityFixResult']>, ParentType, ContextType>;
};

export type CapabilityCliCheckResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityCliCheck'] = ResolversParentTypes['CapabilityCliCheck']> = {
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  message: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityCliCheckRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityCliCheck'] = ResolversParentTypes['CapabilityCliCheck']> = {
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  message?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityFixItemResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixItem'] = ResolversParentTypes['CapabilityFixItem']> = {
  blockedReason: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  canApply: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  kind: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  linkPath: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  severity: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  steps: OptArgsResolverFn<Array<ResolversTypes['CapabilityFixStep']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityFixItemRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixItem'] = ResolversParentTypes['CapabilityFixItem']> = {
  blockedReason?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  canApply?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  kind?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  linkPath?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  severity?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  steps?: RequiredResolverFn<Array<ResolversTypes['CapabilityFixStep']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityFixPlanResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixPlan'] = ResolversParentTypes['CapabilityFixPlan']> = {
  agentName: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  items: OptArgsResolverFn<Array<ResolversTypes['CapabilityFixItem']>, ParentType, ContextType>;
};

export type CapabilityFixPlanRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixPlan'] = ResolversParentTypes['CapabilityFixPlan']> = {
  agentName?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  items?: RequiredResolverFn<Array<ResolversTypes['CapabilityFixItem']>, ParentType, ContextType>;
};

export type CapabilityFixResultResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixResult'] = ResolversParentTypes['CapabilityFixResult']> = {
  changed: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  linkPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  message: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  ok: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  skill: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CapabilityFixResultRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixResult'] = ResolversParentTypes['CapabilityFixResult']> = {
  changed?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  linkPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  message?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  ok?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  skill?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CapabilityFixStepResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixStep'] = ResolversParentTypes['CapabilityFixStep']> = {
  detail: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityFixStepRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityFixStep'] = ResolversParentTypes['CapabilityFixStep']> = {
  detail?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type CapabilityHealthResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityHealth'] = ResolversParentTypes['CapabilityHealth']> = {
  cli: OptArgsResolverFn<Array<ResolversTypes['CapabilityCliCheck']>, ParentType, ContextType>;
  generatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  reports: OptArgsResolverFn<Array<ResolversTypes['CapabilityPlatformReport']>, ParentType, ContextType>;
};

export type CapabilityHealthRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityHealth'] = ResolversParentTypes['CapabilityHealth']> = {
  cli?: RequiredResolverFn<Array<ResolversTypes['CapabilityCliCheck']>, ParentType, ContextType>;
  generatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  reports?: RequiredResolverFn<Array<ResolversTypes['CapabilityPlatformReport']>, ParentType, ContextType>;
};

export type CapabilityPlatformReportResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityPlatformReport'] = ResolversParentTypes['CapabilityPlatformReport']> = {
  agents: OptArgsResolverFn<Array<ResolversTypes['AgentCapabilityHealth']>, ParentType, ContextType>;
  generatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  platform: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  summary: OptArgsResolverFn<ResolversTypes['CapabilitySummary'], ParentType, ContextType>;
};

export type CapabilityPlatformReportRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityPlatformReport'] = ResolversParentTypes['CapabilityPlatformReport']> = {
  agents?: RequiredResolverFn<Array<ResolversTypes['AgentCapabilityHealth']>, ParentType, ContextType>;
  generatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  platform?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  summary?: RequiredResolverFn<ResolversTypes['CapabilitySummary'], ParentType, ContextType>;
};

export type CapabilitySkillCheckResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilitySkillCheck'] = ResolversParentTypes['CapabilitySkillCheck']> = {
  available: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  bound: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CapabilitySkillCheckRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilitySkillCheck'] = ResolversParentTypes['CapabilitySkillCheck']> = {
  available?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  bound?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CapabilitySummaryResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilitySummary'] = ResolversParentTypes['CapabilitySummary']> = {
  complete: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  notInstalled: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  partial: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  total: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  unbound: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CapabilitySummaryRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilitySummary'] = ResolversParentTypes['CapabilitySummary']> = {
  complete?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  notInstalled?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  partial?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  total?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  unbound?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CapabilityToolCheckResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityToolCheck'] = ResolversParentTypes['CapabilityToolCheck']> = {
  available: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CapabilityToolCheckRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['CapabilityToolCheck'] = ResolversParentTypes['CapabilityToolCheck']> = {
  available?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CedarResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Cedar'] = ResolversParentTypes['Cedar']> = {
  currentUser: OptArgsResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  prismaVersion: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CedarRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Cedar'] = ResolversParentTypes['Cedar']> = {
  currentUser?: RequiredResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  prismaVersion?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DeliveryDirectoryStatResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['DeliveryDirectoryStat'] = ResolversParentTypes['DeliveryDirectoryStat']> = {
  added: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  directory: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  files: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type DeliveryDirectoryStatRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['DeliveryDirectoryStat'] = ResolversParentTypes['DeliveryDirectoryStat']> = {
  added?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  directory?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  files?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type DeliveryStatResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['DeliveryStat'] = ResolversParentTypes['DeliveryStat']> = {
  added: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  files: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type DeliveryStatRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['DeliveryStat'] = ResolversParentTypes['DeliveryStat']> = {
  added?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  files?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export interface FileScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['File'], any> {
  name: 'File';
}

export type InstalledSkillResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['InstalledSkill'] = ResolversParentTypes['InstalledSkill']> = {
  body: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  codexEnabled: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  description: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  dshEnabled: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tags: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  updatable: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type InstalledSkillRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['InstalledSkill'] = ResolversParentTypes['InstalledSkill']> = {
  body?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  codexEnabled?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  description?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  dshEnabled?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tags?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  updatable?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export interface JSONScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export interface JSONObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type MutationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addTaskArtifact?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationaddTaskArtifactArgs, 'input' | 'taskId'>>;
  appendTaskEvent?: Resolver<ResolversTypes['AppendTaskEventResult'], ParentType, ContextType, RequireFields<MutationappendTaskEventArgs, 'input' | 'taskRunId'>>;
  cancelTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationcancelTaskArgs, 'id'>>;
  capabilityApplyFixes?: Resolver<ResolversTypes['CapabilityApplyResult'], ParentType, ContextType, RequireFields<MutationcapabilityApplyFixesArgs, 'agentSlug'>>;
  capabilityFixPlan?: Resolver<ResolversTypes['CapabilityFixPlan'], ParentType, ContextType, RequireFields<MutationcapabilityFixPlanArgs, 'agentSlug'>>;
  createRemoteApp?: Resolver<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationcreateRemoteAppArgs, 'input'>>;
  createTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationcreateTaskArgs, 'input'>>;
  createTaskRun?: Resolver<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationcreateTaskRunArgs, 'input'>>;
  createTaskTemplate?: Resolver<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationcreateTaskTemplateArgs, 'input'>>;
  deleteRemoteApp?: Resolver<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationdeleteRemoteAppArgs, 'id'>>;
  deleteTaskTemplate?: Resolver<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationdeleteTaskTemplateArgs, 'id'>>;
  dispatchRoleEvaluation?: Resolver<ResolversTypes['RoleEvaluationDispatch'], ParentType, ContextType, RequireFields<MutationdispatchRoleEvaluationArgs, 'input'>>;
  dispatchTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationdispatchTaskArgs, 'id'>>;
  dispatchTasks?: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<MutationdispatchTasksArgs, 'ids'>>;
  executeTaskPlan?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationexecuteTaskPlanArgs, 'id' | 'planPath'>>;
  refreshRun?: Resolver<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationrefreshRunArgs, 'runId'>>;
  refreshTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationrefreshTaskArgs, 'id'>>;
  removeTaskArtifact?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationremoveTaskArtifactArgs, 'id'>>;
  reviewTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationreviewTaskArgs, 'decision' | 'id'>>;
  reviseTaskPlan?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationreviseTaskPlanArgs, 'id' | 'note'>>;
  sendRoleEvaluationMessage?: Resolver<ResolversTypes['RoleEvaluation'], ParentType, ContextType, RequireFields<MutationsendRoleEvaluationMessageArgs, 'id' | 'message'>>;
  updateInstalledSkill?: Resolver<ResolversTypes['UpdateInstalledSkillResult'], ParentType, ContextType, RequireFields<MutationupdateInstalledSkillArgs, 'id'>>;
  updateRemoteApp?: Resolver<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationupdateRemoteAppArgs, 'id' | 'input'>>;
  updateTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationupdateTaskArgs, 'id' | 'input'>>;
  updateTaskTemplate?: Resolver<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationupdateTaskTemplateArgs, 'id' | 'input'>>;
  uploadTaskImage?: Resolver<ResolversTypes['TaskImage'], ParentType, ContextType, RequireFields<MutationuploadTaskImageArgs, 'input'>>;
};

export type MutationRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addTaskArtifact?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationaddTaskArtifactArgs, 'input' | 'taskId'>>;
  appendTaskEvent?: RequiredResolverFn<ResolversTypes['AppendTaskEventResult'], ParentType, ContextType, RequireFields<MutationappendTaskEventArgs, 'input' | 'taskRunId'>>;
  cancelTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationcancelTaskArgs, 'id'>>;
  capabilityApplyFixes?: RequiredResolverFn<ResolversTypes['CapabilityApplyResult'], ParentType, ContextType, RequireFields<MutationcapabilityApplyFixesArgs, 'agentSlug'>>;
  capabilityFixPlan?: RequiredResolverFn<ResolversTypes['CapabilityFixPlan'], ParentType, ContextType, RequireFields<MutationcapabilityFixPlanArgs, 'agentSlug'>>;
  createRemoteApp?: RequiredResolverFn<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationcreateRemoteAppArgs, 'input'>>;
  createTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationcreateTaskArgs, 'input'>>;
  createTaskRun?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationcreateTaskRunArgs, 'input'>>;
  createTaskTemplate?: RequiredResolverFn<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationcreateTaskTemplateArgs, 'input'>>;
  deleteRemoteApp?: RequiredResolverFn<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationdeleteRemoteAppArgs, 'id'>>;
  deleteTaskTemplate?: RequiredResolverFn<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationdeleteTaskTemplateArgs, 'id'>>;
  dispatchRoleEvaluation?: RequiredResolverFn<ResolversTypes['RoleEvaluationDispatch'], ParentType, ContextType, RequireFields<MutationdispatchRoleEvaluationArgs, 'input'>>;
  dispatchTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationdispatchTaskArgs, 'id'>>;
  dispatchTasks?: RequiredResolverFn<Array<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<MutationdispatchTasksArgs, 'ids'>>;
  executeTaskPlan?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationexecuteTaskPlanArgs, 'id' | 'planPath'>>;
  refreshRun?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationrefreshRunArgs, 'runId'>>;
  refreshTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationrefreshTaskArgs, 'id'>>;
  removeTaskArtifact?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationremoveTaskArtifactArgs, 'id'>>;
  reviewTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationreviewTaskArgs, 'decision' | 'id'>>;
  reviseTaskPlan?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationreviseTaskPlanArgs, 'id' | 'note'>>;
  sendRoleEvaluationMessage?: RequiredResolverFn<ResolversTypes['RoleEvaluation'], ParentType, ContextType, RequireFields<MutationsendRoleEvaluationMessageArgs, 'id' | 'message'>>;
  updateInstalledSkill?: RequiredResolverFn<ResolversTypes['UpdateInstalledSkillResult'], ParentType, ContextType, RequireFields<MutationupdateInstalledSkillArgs, 'id'>>;
  updateRemoteApp?: RequiredResolverFn<ResolversTypes['RemoteApp'], ParentType, ContextType, RequireFields<MutationupdateRemoteAppArgs, 'id' | 'input'>>;
  updateTask?: RequiredResolverFn<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationupdateTaskArgs, 'id' | 'input'>>;
  updateTaskTemplate?: RequiredResolverFn<ResolversTypes['TaskTemplate'], ParentType, ContextType, RequireFields<MutationupdateTaskTemplateArgs, 'id' | 'input'>>;
  uploadTaskImage?: RequiredResolverFn<ResolversTypes['TaskImage'], ParentType, ContextType, RequireFields<MutationuploadTaskImageArgs, 'input'>>;
};

export type QueryResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  capabilityHealth?: OptArgsResolverFn<ResolversTypes['CapabilityHealth'], ParentType, ContextType>;
  cedar?: OptArgsResolverFn<Maybe<ResolversTypes['Cedar']>, ParentType, ContextType>;
  installedSkills?: OptArgsResolverFn<Array<ResolversTypes['InstalledSkill']>, ParentType, ContextType>;
  redwood?: OptArgsResolverFn<Maybe<ResolversTypes['Redwood']>, ParentType, ContextType>;
  remoteApp?: Resolver<Maybe<ResolversTypes['RemoteApp']>, ParentType, ContextType, RequireFields<QueryremoteAppArgs, 'id'>>;
  remoteApps?: OptArgsResolverFn<Array<ResolversTypes['RemoteApp']>, ParentType, ContextType>;
  roleEvaluationMessages?: Resolver<Array<ResolversTypes['RoleEvaluationMessage']>, ParentType, ContextType, RequireFields<QueryroleEvaluationMessagesArgs, 'id'>>;
  roleEvaluationReport?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QueryroleEvaluationReportArgs, 'id'>>;
  roleEvaluationTools?: OptArgsResolverFn<Array<ResolversTypes['RoleEvaluationTool']>, ParentType, ContextType>;
  roleEvaluations?: Resolver<Array<ResolversTypes['RoleEvaluation']>, ParentType, ContextType, Partial<QueryroleEvaluationsArgs>>;
  runtimeHealth?: OptArgsResolverFn<ResolversTypes['RuntimeHealth'], ParentType, ContextType>;
  task?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QuerytaskArgs, 'id'>>;
  taskArtifactContent?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskArtifactContentArgs, 'id'>>;
  taskImageDataUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskImageDataUrlArgs, 'id'>>;
  taskPlanContent?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskPlanContentArgs, 'taskId'>>;
  taskPrecheck?: Resolver<ResolversTypes['TaskPrecheck'], ParentType, ContextType, RequireFields<QuerytaskPrecheckArgs, 'id'>>;
  taskPulse?: OptArgsResolverFn<ResolversTypes['TaskPulse'], ParentType, ContextType>;
  taskRun?: Resolver<Maybe<ResolversTypes['TaskRun']>, ParentType, ContextType, RequireFields<QuerytaskRunArgs, 'id'>>;
  taskRunLog?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskRunLogArgs, 'runId'>>;
  taskRunMessages?: Resolver<Array<ResolversTypes['TaskRunMessage']>, ParentType, ContextType, RequireFields<QuerytaskRunMessagesArgs, 'runId'>>;
  taskRunTrace?: Resolver<ResolversTypes['TaskRunTrace'], ParentType, ContextType, RequireFields<QuerytaskRunTraceArgs, 'runId'>>;
  taskRuns?: Resolver<ResolversTypes['TaskRunConnection'], ParentType, ContextType, RequireFields<QuerytaskRunsArgs, 'first' | 'skip'>>;
  taskTemplates?: OptArgsResolverFn<Array<ResolversTypes['TaskTemplate']>, ParentType, ContextType>;
  tasks?: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType, Partial<QuerytasksArgs>>;
  teamRuntimeOverview?: Resolver<ResolversTypes['TeamRuntimeOverview'], ParentType, ContextType, Partial<QueryteamRuntimeOverviewArgs>>;
  teamWeeklyReport?: Resolver<ResolversTypes['TeamWeeklyReport'], ParentType, ContextType, RequireFields<QueryteamWeeklyReportArgs, 'range'>>;
  workspaceStatus?: OptArgsResolverFn<ResolversTypes['WorkspaceStatus'], ParentType, ContextType>;
};

export type QueryRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  capabilityHealth?: RequiredResolverFn<ResolversTypes['CapabilityHealth'], ParentType, ContextType>;
  cedar?: RequiredResolverFn<Maybe<ResolversTypes['Cedar']>, ParentType, ContextType>;
  installedSkills?: RequiredResolverFn<Array<ResolversTypes['InstalledSkill']>, ParentType, ContextType>;
  redwood?: RequiredResolverFn<Maybe<ResolversTypes['Redwood']>, ParentType, ContextType>;
  remoteApp?: RequiredResolverFn<Maybe<ResolversTypes['RemoteApp']>, ParentType, ContextType, RequireFields<QueryremoteAppArgs, 'id'>>;
  remoteApps?: RequiredResolverFn<Array<ResolversTypes['RemoteApp']>, ParentType, ContextType>;
  roleEvaluationMessages?: RequiredResolverFn<Array<ResolversTypes['RoleEvaluationMessage']>, ParentType, ContextType, RequireFields<QueryroleEvaluationMessagesArgs, 'id'>>;
  roleEvaluationReport?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType, RequireFields<QueryroleEvaluationReportArgs, 'id'>>;
  roleEvaluationTools?: RequiredResolverFn<Array<ResolversTypes['RoleEvaluationTool']>, ParentType, ContextType>;
  roleEvaluations?: RequiredResolverFn<Array<ResolversTypes['RoleEvaluation']>, ParentType, ContextType, Partial<QueryroleEvaluationsArgs>>;
  runtimeHealth?: RequiredResolverFn<ResolversTypes['RuntimeHealth'], ParentType, ContextType>;
  task?: RequiredResolverFn<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QuerytaskArgs, 'id'>>;
  taskArtifactContent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskArtifactContentArgs, 'id'>>;
  taskImageDataUrl?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskImageDataUrlArgs, 'id'>>;
  taskPlanContent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskPlanContentArgs, 'taskId'>>;
  taskPrecheck?: RequiredResolverFn<ResolversTypes['TaskPrecheck'], ParentType, ContextType, RequireFields<QuerytaskPrecheckArgs, 'id'>>;
  taskPulse?: RequiredResolverFn<ResolversTypes['TaskPulse'], ParentType, ContextType>;
  taskRun?: RequiredResolverFn<Maybe<ResolversTypes['TaskRun']>, ParentType, ContextType, RequireFields<QuerytaskRunArgs, 'id'>>;
  taskRunLog?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType, RequireFields<QuerytaskRunLogArgs, 'runId'>>;
  taskRunMessages?: RequiredResolverFn<Array<ResolversTypes['TaskRunMessage']>, ParentType, ContextType, RequireFields<QuerytaskRunMessagesArgs, 'runId'>>;
  taskRunTrace?: RequiredResolverFn<ResolversTypes['TaskRunTrace'], ParentType, ContextType, RequireFields<QuerytaskRunTraceArgs, 'runId'>>;
  taskRuns?: RequiredResolverFn<ResolversTypes['TaskRunConnection'], ParentType, ContextType, RequireFields<QuerytaskRunsArgs, 'first' | 'skip'>>;
  taskTemplates?: RequiredResolverFn<Array<ResolversTypes['TaskTemplate']>, ParentType, ContextType>;
  tasks?: RequiredResolverFn<Array<ResolversTypes['Task']>, ParentType, ContextType, Partial<QuerytasksArgs>>;
  teamRuntimeOverview?: RequiredResolverFn<ResolversTypes['TeamRuntimeOverview'], ParentType, ContextType, Partial<QueryteamRuntimeOverviewArgs>>;
  teamWeeklyReport?: RequiredResolverFn<ResolversTypes['TeamWeeklyReport'], ParentType, ContextType, RequireFields<QueryteamWeeklyReportArgs, 'range'>>;
  workspaceStatus?: RequiredResolverFn<ResolversTypes['WorkspaceStatus'], ParentType, ContextType>;
};

export type RedwoodResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Redwood'] = ResolversParentTypes['Redwood']> = {
  currentUser: OptArgsResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  prismaVersion: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type RedwoodRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Redwood'] = ResolversParentTypes['Redwood']> = {
  currentUser?: RequiredResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  prismaVersion?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type RemoteAppResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RemoteApp'] = ResolversParentTypes['RemoteApp']> = {
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  icon: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  url: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RemoteAppRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RemoteApp'] = ResolversParentTypes['RemoteApp']> = {
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  icon?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  url?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluation'] = ResolversParentTypes['RoleEvaluation']> = {
  agentName: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  failureReason: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  finishedAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  logPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  pid: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  projectKey: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  projectRoot: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reportPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  sessionId: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskId: OptArgsResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  tool: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluation'] = ResolversParentTypes['RoleEvaluation']> = {
  agentName?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  failureReason?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  finishedAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  logPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  pid?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  projectKey?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  projectRoot?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reportPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  sessionId?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskId?: RequiredResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  tool?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationDispatchResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationDispatch'] = ResolversParentTypes['RoleEvaluationDispatch']> = {
  agentName: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  logPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  pid: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  projectKey: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  projectRoot: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  prompt: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reportPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  resultPath: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  sessionId: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  tool: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationDispatchRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationDispatch'] = ResolversParentTypes['RoleEvaluationDispatch']> = {
  agentName?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  logPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  pid?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  projectKey?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  projectRoot?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  prompt?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reportPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  resultPath?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  sessionId?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  tool?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationMessageResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationMessage'] = ResolversParentTypes['RoleEvaluationMessage']> = {
  content: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  role: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationMessageRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationMessage'] = ResolversParentTypes['RoleEvaluationMessage']> = {
  content?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  role?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RoleEvaluationToolResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationTool'] = ResolversParentTypes['RoleEvaluationTool']> = {
  available: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reason: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type RoleEvaluationToolRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RoleEvaluationTool'] = ResolversParentTypes['RoleEvaluationTool']> = {
  available?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  reason?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type RuntimeComponentHealthResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RuntimeComponentHealth'] = ResolversParentTypes['RuntimeComponentHealth']> = {
  message: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RuntimeComponentHealthRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RuntimeComponentHealth'] = ResolversParentTypes['RuntimeComponentHealth']> = {
  message?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type RuntimeHealthResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RuntimeHealth'] = ResolversParentTypes['RuntimeHealth']> = {
  database: OptArgsResolverFn<ResolversTypes['RuntimeComponentHealth'], ParentType, ContextType>;
  realtime: OptArgsResolverFn<ResolversTypes['RuntimeComponentHealth'], ParentType, ContextType>;
  serverTime: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type RuntimeHealthRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['RuntimeHealth'] = ResolversParentTypes['RuntimeHealth']> = {
  database?: RequiredResolverFn<ResolversTypes['RuntimeComponentHealth'], ParentType, ContextType>;
  realtime?: RequiredResolverFn<ResolversTypes['RuntimeComponentHealth'], ParentType, ContextType>;
  serverTime?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  taskRunChanged?: SubscriptionResolver<ResolversTypes['TaskRun'], "taskRunChanged", ParentType, ContextType, RequireFields<SubscriptiontaskRunChangedArgs, 'taskRunId'>>;
  taskRunsChanged?: SubscriptionResolver<ResolversTypes['TaskRun'], "taskRunsChanged", ParentType, ContextType>;
};

export type SubscriptionRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  taskRunChanged?: SubscriptionResolver<ResolversTypes['TaskRun'], "taskRunChanged", ParentType, ContextType, RequireFields<SubscriptiontaskRunChangedArgs, 'taskRunId'>>;
  taskRunsChanged?: SubscriptionResolver<ResolversTypes['TaskRun'], "taskRunsChanged", ParentType, ContextType>;
};

export type TaskResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Task'] = ResolversParentTypes['Task']> = {
  acceptance: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  artifacts: OptArgsResolverFn<Array<ResolversTypes['TaskArtifact']>, ParentType, ContextType>;
  brief: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  completedAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  dueAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  mode: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  planNote: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  planPath: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  priority: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  readOnly: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  reviewNote: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  runs: OptArgsResolverFn<Array<ResolversTypes['TaskRun']>, ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type TaskRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Task'] = ResolversParentTypes['Task']> = {
  acceptance?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  artifacts?: RequiredResolverFn<Array<ResolversTypes['TaskArtifact']>, ParentType, ContextType>;
  brief?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  completedAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  dueAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  mode?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  planNote?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  planPath?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  priority?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  readOnly?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  reviewNote?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  runs?: RequiredResolverFn<Array<ResolversTypes['TaskRun']>, ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type TaskArtifactResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskArtifact'] = ResolversParentTypes['TaskArtifact']> = {
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  kind: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  label: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskId: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
};

export type TaskArtifactRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskArtifact'] = ResolversParentTypes['TaskArtifact']> = {
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  kind?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  label?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  source?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskId?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
};

export type TaskEventResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskEvent'] = ResolversParentTypes['TaskEvent']> = {
  agent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  cachedTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  eventType: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  evidence: OptArgsResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  idempotencyKey: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  modelId: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  sequence: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  skills: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  stage: OptArgsResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  status: OptArgsResolverFn<Maybe<ResolversTypes['TaskRunStatus']>, ParentType, ContextType>;
  summary: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskRunId: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
};

export type TaskEventRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskEvent'] = ResolversParentTypes['TaskEvent']> = {
  agent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  cachedTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  eventType?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  evidence?: RequiredResolverFn<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  idempotencyKey?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  modelId?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  sequence?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  skills?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  stage?: RequiredResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  status?: RequiredResolverFn<Maybe<ResolversTypes['TaskRunStatus']>, ParentType, ContextType>;
  summary?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  taskRunId?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
};

export type TaskImageResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskImage'] = ResolversParentTypes['TaskImage']> = {
  bytes: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  label: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  mime: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  url: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type TaskImageRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskImage'] = ResolversParentTypes['TaskImage']> = {
  bytes?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  label?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  mime?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  path?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  url?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type TaskPrecheckResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskPrecheck'] = ResolversParentTypes['TaskPrecheck']> = {
  expectedPaths: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  warnings: OptArgsResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type TaskPrecheckRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskPrecheck'] = ResolversParentTypes['TaskPrecheck']> = {
  expectedPaths?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
  warnings?: RequiredResolverFn<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type TaskPulseResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskPulse'] = ResolversParentTypes['TaskPulse']> = {
  awaitingReview: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  completedToday: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  failedToday: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  queued: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  running: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskPulseRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskPulse'] = ResolversParentTypes['TaskPulse']> = {
  awaitingReview?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  completedToday?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  failedToday?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  queued?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  running?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRun'] = ResolversParentTypes['TaskRun']> = {
  cachedTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  completedAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  currentStage: OptArgsResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  dirtyAtDispatch: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  events: OptArgsResolverFn<Array<ResolversTypes['TaskEvent']>, ParentType, ContextType>;
  externalReference: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  logPath: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mode: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  platform: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  primaryAgent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  startedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  task: OptArgsResolverFn<Maybe<ResolversTypes['Task']>, ParentType, ContextType>;
  taskId: OptArgsResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  version: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRun'] = ResolversParentTypes['TaskRun']> = {
  cachedTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  completedAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  currentStage?: RequiredResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  dirtyAtDispatch?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  events?: RequiredResolverFn<Array<ResolversTypes['TaskEvent']>, ParentType, ContextType>;
  externalReference?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  logPath?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mode?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  platform?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  primaryAgent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  startedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  task?: RequiredResolverFn<Maybe<ResolversTypes['Task']>, ParentType, ContextType>;
  taskId?: RequiredResolverFn<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  version?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunConnectionResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunConnection'] = ResolversParentTypes['TaskRunConnection']> = {
  edges: OptArgsResolverFn<Array<ResolversTypes['TaskRunEdge']>, ParentType, ContextType>;
  pageInfo: OptArgsResolverFn<ResolversTypes['TaskRunPageInfo'], ParentType, ContextType>;
  statusCounts: OptArgsResolverFn<Array<ResolversTypes['TaskRunStatusCount']>, ParentType, ContextType>;
  totalCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunConnectionRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunConnection'] = ResolversParentTypes['TaskRunConnection']> = {
  edges?: RequiredResolverFn<Array<ResolversTypes['TaskRunEdge']>, ParentType, ContextType>;
  pageInfo?: RequiredResolverFn<ResolversTypes['TaskRunPageInfo'], ParentType, ContextType>;
  statusCounts?: RequiredResolverFn<Array<ResolversTypes['TaskRunStatusCount']>, ParentType, ContextType>;
  totalCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunEdgeResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunEdge'] = ResolversParentTypes['TaskRunEdge']> = {
  cursor: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  node: OptArgsResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export type TaskRunEdgeRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunEdge'] = ResolversParentTypes['TaskRunEdge']> = {
  cursor?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  node?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export type TaskRunMessageResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunMessage'] = ResolversParentTypes['TaskRunMessage']> = {
  content: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  role: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  step: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskRunMessageRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunMessage'] = ResolversParentTypes['TaskRunMessage']> = {
  content?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  role?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  step?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskRunPageInfoResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunPageInfo'] = ResolversParentTypes['TaskRunPageInfo']> = {
  endCursor: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type TaskRunPageInfoRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunPageInfo'] = ResolversParentTypes['TaskRunPageInfo']> = {
  endCursor?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type TaskRunStatusCountResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunStatusCount'] = ResolversParentTypes['TaskRunStatusCount']> = {
  count: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
};

export type TaskRunStatusCountRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunStatusCount'] = ResolversParentTypes['TaskRunStatusCount']> = {
  count?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
};

export type TaskRunToolResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunTool'] = ResolversParentTypes['TaskRunTool']> = {
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  detail: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  redacted: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  result: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  resultTruncated: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  step: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskRunToolRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunTool'] = ResolversParentTypes['TaskRunTool']> = {
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  detail?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  redacted?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  result?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  resultTruncated?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  step?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskRunTraceResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunTrace'] = ResolversParentTypes['TaskRunTrace']> = {
  messages: OptArgsResolverFn<Array<ResolversTypes['TaskRunMessage']>, ParentType, ContextType>;
  source: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tools: OptArgsResolverFn<Array<ResolversTypes['TaskRunTool']>, ParentType, ContextType>;
  truncated: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  turn: OptArgsResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskRunTraceRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunTrace'] = ResolversParentTypes['TaskRunTrace']> = {
  messages?: RequiredResolverFn<Array<ResolversTypes['TaskRunMessage']>, ParentType, ContextType>;
  source?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tools?: RequiredResolverFn<Array<ResolversTypes['TaskRunTool']>, ParentType, ContextType>;
  truncated?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  turn?: RequiredResolverFn<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type TaskTemplateResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskTemplate'] = ResolversParentTypes['TaskTemplate']> = {
  acceptance: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  brief: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  priority: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  readOnly: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type TaskTemplateRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskTemplate'] = ResolversParentTypes['TaskTemplate']> = {
  acceptance?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  agentSlug?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  brief?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  name?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  priority?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  readOnly?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
};

export type TeamDeliveryStatResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamDeliveryStat'] = ResolversParentTypes['TeamDeliveryStat']> = {
  added: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  byDirectory: OptArgsResolverFn<Array<ResolversTypes['DeliveryDirectoryStat']>, ParentType, ContextType>;
  coveredRuns: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  files: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalRuns: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  uncategorized: OptArgsResolverFn<ResolversTypes['DeliveryStat'], ParentType, ContextType>;
};

export type TeamDeliveryStatRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamDeliveryStat'] = ResolversParentTypes['TeamDeliveryStat']> = {
  added?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  byDirectory?: RequiredResolverFn<Array<ResolversTypes['DeliveryDirectoryStat']>, ParentType, ContextType>;
  coveredRuns?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  files?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  removed?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalRuns?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  uncategorized?: RequiredResolverFn<ResolversTypes['DeliveryStat'], ParentType, ContextType>;
};

export type TeamRuntimeOverviewResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamRuntimeOverview'] = ResolversParentTypes['TeamRuntimeOverview']> = {
  activeTasks: OptArgsResolverFn<Array<ResolversTypes['ActiveTaskRun']>, ParentType, ContextType>;
  agents: OptArgsResolverFn<Array<ResolversTypes['AgentRuntimeMetric']>, ParentType, ContextType>;
  cachedTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  inputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  queuedCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  runningCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTaskCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  trackedWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  waitingCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TeamRuntimeOverviewRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamRuntimeOverview'] = ResolversParentTypes['TeamRuntimeOverview']> = {
  activeTasks?: RequiredResolverFn<Array<ResolversTypes['ActiveTaskRun']>, ParentType, ContextType>;
  agents?: RequiredResolverFn<Array<ResolversTypes['AgentRuntimeMetric']>, ParentType, ContextType>;
  cachedTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  inputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  queuedCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  runningCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTaskCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  trackedWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  waitingCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TeamWeeklyReportResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamWeeklyReport'] = ResolversParentTypes['TeamWeeklyReport']> = {
  cachedTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  cancelledTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  completed: OptArgsResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  completedTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  contributions: OptArgsResolverFn<Array<ResolversTypes['WeeklyAgentContribution']>, ParentType, ContextType>;
  delivery: OptArgsResolverFn<ResolversTypes['TeamDeliveryStat'], ParentType, ContextType>;
  failedTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  failures: OptArgsResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  from: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  generatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  headline: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  pending: OptArgsResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  pendingTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  to: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  totalTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
};

export type TeamWeeklyReportRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamWeeklyReport'] = ResolversParentTypes['TeamWeeklyReport']> = {
  cachedTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  cancelledTasks?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  completed?: RequiredResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  completedTasks?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  contributions?: RequiredResolverFn<Array<ResolversTypes['WeeklyAgentContribution']>, ParentType, ContextType>;
  delivery?: RequiredResolverFn<ResolversTypes['TeamDeliveryStat'], ParentType, ContextType>;
  failedTasks?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  failures?: RequiredResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  from?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  generatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  headline?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  pending?: RequiredResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  pendingTasks?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  to?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  totalTasks?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
};

export interface TimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Time'], any> {
  name: 'Time';
}

export type UpdateInstalledSkillResultResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['UpdateInstalledSkillResult'] = ResolversParentTypes['UpdateInstalledSkillResult']> = {
  message: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  skill: OptArgsResolverFn<ResolversTypes['InstalledSkill'], ParentType, ContextType>;
};

export type UpdateInstalledSkillResultRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['UpdateInstalledSkillResult'] = ResolversParentTypes['UpdateInstalledSkillResult']> = {
  message?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  skill?: RequiredResolverFn<ResolversTypes['InstalledSkill'], ParentType, ContextType>;
};

export type WeeklyAgentContributionResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WeeklyAgentContribution'] = ResolversParentTypes['WeeklyAgentContribution']> = {
  agent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  workCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type WeeklyAgentContributionRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WeeklyAgentContribution'] = ResolversParentTypes['WeeklyAgentContribution']> = {
  agent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  tokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  workCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type WeeklyTaskItemResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WeeklyTaskItem'] = ResolversParentTypes['WeeklyTaskItem']> = {
  currentStage: OptArgsResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  primaryAgent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type WeeklyTaskItemRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WeeklyTaskItem'] = ResolversParentTypes['WeeklyTaskItem']> = {
  currentStage?: RequiredResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  primaryAgent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type WorkspaceStatusResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WorkspaceStatus'] = ResolversParentTypes['WorkspaceStatus']> = {
  changedCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  dirty: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type WorkspaceStatusRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['WorkspaceStatus'] = ResolversParentTypes['WorkspaceStatus']> = {
  changedCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  dirty?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type Resolvers<ContextType = CedarGraphQLContext> = {
  ActiveTaskRun: ActiveTaskRunResolvers<ContextType>;
  AgentCapabilityHealth: AgentCapabilityHealthResolvers<ContextType>;
  AgentRuntimeMetric: AgentRuntimeMetricResolvers<ContextType>;
  AppendTaskEventResult: AppendTaskEventResultResolvers<ContextType>;
  BigInt: GraphQLScalarType;
  Byte: GraphQLScalarType;
  CapabilityApplyResult: CapabilityApplyResultResolvers<ContextType>;
  CapabilityCliCheck: CapabilityCliCheckResolvers<ContextType>;
  CapabilityFixItem: CapabilityFixItemResolvers<ContextType>;
  CapabilityFixPlan: CapabilityFixPlanResolvers<ContextType>;
  CapabilityFixResult: CapabilityFixResultResolvers<ContextType>;
  CapabilityFixStep: CapabilityFixStepResolvers<ContextType>;
  CapabilityHealth: CapabilityHealthResolvers<ContextType>;
  CapabilityPlatformReport: CapabilityPlatformReportResolvers<ContextType>;
  CapabilitySkillCheck: CapabilitySkillCheckResolvers<ContextType>;
  CapabilitySummary: CapabilitySummaryResolvers<ContextType>;
  CapabilityToolCheck: CapabilityToolCheckResolvers<ContextType>;
  Cedar: CedarResolvers<ContextType>;
  Date: GraphQLScalarType;
  DateTime: GraphQLScalarType;
  DeliveryDirectoryStat: DeliveryDirectoryStatResolvers<ContextType>;
  DeliveryStat: DeliveryStatResolvers<ContextType>;
  File: GraphQLScalarType;
  InstalledSkill: InstalledSkillResolvers<ContextType>;
  JSON: GraphQLScalarType;
  JSONObject: GraphQLScalarType;
  Mutation: MutationResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Redwood: RedwoodResolvers<ContextType>;
  RemoteApp: RemoteAppResolvers<ContextType>;
  RoleEvaluation: RoleEvaluationResolvers<ContextType>;
  RoleEvaluationDispatch: RoleEvaluationDispatchResolvers<ContextType>;
  RoleEvaluationMessage: RoleEvaluationMessageResolvers<ContextType>;
  RoleEvaluationTool: RoleEvaluationToolResolvers<ContextType>;
  RuntimeComponentHealth: RuntimeComponentHealthResolvers<ContextType>;
  RuntimeHealth: RuntimeHealthResolvers<ContextType>;
  Subscription: SubscriptionResolvers<ContextType>;
  Task: TaskResolvers<ContextType>;
  TaskArtifact: TaskArtifactResolvers<ContextType>;
  TaskEvent: TaskEventResolvers<ContextType>;
  TaskImage: TaskImageResolvers<ContextType>;
  TaskPrecheck: TaskPrecheckResolvers<ContextType>;
  TaskPulse: TaskPulseResolvers<ContextType>;
  TaskRun: TaskRunResolvers<ContextType>;
  TaskRunConnection: TaskRunConnectionResolvers<ContextType>;
  TaskRunEdge: TaskRunEdgeResolvers<ContextType>;
  TaskRunMessage: TaskRunMessageResolvers<ContextType>;
  TaskRunPageInfo: TaskRunPageInfoResolvers<ContextType>;
  TaskRunStatusCount: TaskRunStatusCountResolvers<ContextType>;
  TaskRunTool: TaskRunToolResolvers<ContextType>;
  TaskRunTrace: TaskRunTraceResolvers<ContextType>;
  TaskTemplate: TaskTemplateResolvers<ContextType>;
  TeamDeliveryStat: TeamDeliveryStatResolvers<ContextType>;
  TeamRuntimeOverview: TeamRuntimeOverviewResolvers<ContextType>;
  TeamWeeklyReport: TeamWeeklyReportResolvers<ContextType>;
  Time: GraphQLScalarType;
  UpdateInstalledSkillResult: UpdateInstalledSkillResultResolvers<ContextType>;
  WeeklyAgentContribution: WeeklyAgentContributionResolvers<ContextType>;
  WeeklyTaskItem: WeeklyTaskItemResolvers<ContextType>;
  WorkspaceStatus: WorkspaceStatusResolvers<ContextType>;
};

export type DirectiveResolvers<ContextType = CedarGraphQLContext> = {
  requireAuth: requireAuthDirectiveResolver<any, any, ContextType>;
  requireRuntimeWriter: requireRuntimeWriterDirectiveResolver<any, any, ContextType>;
  requireSessionOrRuntimeWriter: requireSessionOrRuntimeWriterDirectiveResolver<any, any, ContextType>;
  requireSessionOrTeamReader: requireSessionOrTeamReaderDirectiveResolver<any, any, ContextType>;
  skipAuth: skipAuthDirectiveResolver<any, any, ContextType>;
};
