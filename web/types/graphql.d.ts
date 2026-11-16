import { Prisma } from "$api/src/lib/db"
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: number; output: number; }
  Byte: { input: Uint8Array; output: Uint8Array; }
  Date: { input: string; output: string; }
  DateTime: { input: string; output: string; }
  File: { input: File; output: File; }
  JSON: { input: Prisma.JsonValue; output: Prisma.JsonValue; }
  JSONObject: { input: Prisma.JsonObject; output: Prisma.JsonObject; }
  Time: { input: string; output: string; }
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
  totalTokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
  trackedWorkCount: Scalars['Int']['output'];
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

export type CapabilityCliCheck = {
  __typename?: 'CapabilityCliCheck';
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  status: Scalars['String']['output'];
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
  tool?: InputMaybe<Scalars['String']['input']>;
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
  taskPulse: TaskPulse;
  taskRun?: Maybe<TaskRun>;
  taskRunLog: Scalars['String']['output'];
  taskRunMessages: Array<TaskRunMessage>;
  taskRuns: TaskRunConnection;
  taskTemplates: Array<TaskTemplate>;
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
export type QuerytaskRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TaskRunFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};


/** About the Cedar queries. */
export type QuerytasksArgs = {
  agentSlug?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
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

export type TeamRuntimeOverview = {
  __typename?: 'TeamRuntimeOverview';
  agents: Array<AgentRuntimeMetric>;
  cachedTokenCoverage: RuntimeMetricCoverage;
  cachedTokens: Scalars['Float']['output'];
  inputTokenCoverage: RuntimeMetricCoverage;
  inputTokens: Scalars['Float']['output'];
  outputTokenCoverage: RuntimeMetricCoverage;
  outputTokens: Scalars['Float']['output'];
  totalTaskCount: Scalars['Int']['output'];
  totalTokenCoverage: RuntimeMetricCoverage;
  totalTokens: Scalars['Float']['output'];
  totalWorkCount: Scalars['Int']['output'];
  trackedWorkCount: Scalars['Int']['output'];
};

export type TeamWeeklyReport = {
  __typename?: 'TeamWeeklyReport';
  cachedTokens: Scalars['Float']['output'];
  cancelledTasks: Scalars['Int']['output'];
  completed: Array<WeeklyTaskItem>;
  completedTasks: Scalars['Int']['output'];
  contributions: Array<WeeklyAgentContribution>;
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

export type CapabilityHealthCenterVariables = Exact<{ [key: string]: never; }>;


export type CapabilityHealthCenter = { __typename?: 'Query', capabilityHealth: { __typename?: 'CapabilityHealth', generatedAt: string, cli: Array<{ __typename?: 'CapabilityCliCheck', id: string, name: string, status: string, path: string, message: string }>, reports: Array<{ __typename?: 'CapabilityPlatformReport', platform: string, generatedAt: string, summary: { __typename?: 'CapabilitySummary', total: number, complete: number, partial: number, notInstalled: number, unbound: number }, agents: Array<{ __typename?: 'AgentCapabilityHealth', slug: string, name: string, status: string, platformSupported: boolean, agentInstalled: boolean, missingRequiredSkills: Array<string>, missingOptionalSkills: Array<string>, missingRequiredTools: Array<string>, unboundRequiredSkills: Array<string>, suggestions: Array<string> }> }> }, runtimeHealth: { __typename?: 'RuntimeHealth', serverTime: string, database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } }, installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, updatable: boolean }> };

export type TaskImageDataUrlVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TaskImageDataUrl = { __typename?: 'Query', taskImageDataUrl: string };

export type UploadTaskImageVariables = Exact<{
  input: UploadTaskImageInput;
}>;


export type UploadTaskImage = { __typename?: 'Mutation', uploadTaskImage: { __typename?: 'TaskImage', id: string, label: string } };

export type RemoteAppsVariables = Exact<{ [key: string]: never; }>;


export type RemoteApps = { __typename?: 'Query', remoteApps: Array<{ __typename?: 'RemoteApp', id: string, name: string, url: string, icon: string, createdAt: string, updatedAt: string }> };

export type CreateRemoteAppVariables = Exact<{
  input: CreateRemoteAppInput;
}>;


export type CreateRemoteApp = { __typename?: 'Mutation', createRemoteApp: { __typename?: 'RemoteApp', id: string } };

export type UpdateRemoteAppVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateRemoteAppInput;
}>;


export type UpdateRemoteApp = { __typename?: 'Mutation', updateRemoteApp: { __typename?: 'RemoteApp', id: string } };

export type DeleteRemoteAppVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteRemoteApp = { __typename?: 'Mutation', deleteRemoteApp: { __typename?: 'RemoteApp', id: string } };

export type RoleEvaluationsVariables = Exact<{
  agentSlug?: InputMaybe<Scalars['String']['input']>;
}>;


export type RoleEvaluations = { __typename?: 'Query', roleEvaluations: Array<{ __typename?: 'RoleEvaluation', id: string, agentSlug: string, agentName: string, projectKey: string, projectRoot: string, tool: string, status: string, sessionId?: string | null, reportPath: string, logPath: string, startedAt: string, finishedAt?: string | null }> };

export type RoleEvaluationMessagesVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RoleEvaluationMessages = { __typename?: 'Query', roleEvaluationMessages: Array<{ __typename?: 'RoleEvaluationMessage', role: string, content: string, createdAt: string }> };

export type RoleEvaluationReportVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RoleEvaluationReport = { __typename?: 'Query', roleEvaluationReport: string };

export type SendRoleEvaluationMessageVariables = Exact<{
  id: Scalars['ID']['input'];
  message: Scalars['String']['input'];
}>;


export type SendRoleEvaluationMessage = { __typename?: 'Mutation', sendRoleEvaluationMessage: { __typename?: 'RoleEvaluation', id: string, status: string } };

export type InstalledSkillsVariables = Exact<{ [key: string]: never; }>;


export type InstalledSkills = { __typename?: 'Query', installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, description: string, source: string, tags: Array<string>, path: string, updatedAt: string, updatable: boolean, body: string, codexEnabled: boolean, dshEnabled: boolean }> };

export type UpdateInstalledSkillVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type UpdateInstalledSkill = { __typename?: 'Mutation', updateInstalledSkill: { __typename?: 'UpdateInstalledSkillResult', message: string, skill: { __typename?: 'InstalledSkill', id: string, name: string, description: string, source: string, tags: Array<string>, path: string, updatedAt: string, updatable: boolean, body: string, codexEnabled: boolean, dshEnabled: boolean } } };

export type TasksVariables = Exact<{
  status?: InputMaybe<Scalars['String']['input']>;
  agentSlug?: InputMaybe<Scalars['String']['input']>;
}>;


export type Tasks = { __typename?: 'Query', tasks: Array<{ __typename?: 'Task', id: string, title: string, brief: string, acceptance: string, agentSlug: string, priority: string, status: string, readOnly: boolean, mode: string, planPath?: string | null, planNote?: string | null, dueAt?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, reviewNote?: string | null, reviewedAt?: string | null, artifacts: Array<{ __typename?: 'TaskArtifact', id: string, kind: string, source: string, path: string, label: string, createdAt: string }>, runs: Array<{ __typename?: 'TaskRun', id: string, status: TaskRunStatus, currentStage: TaskRunStage, platform: string, mode: string, summary?: string | null, logPath?: string | null, dirtyAtDispatch: boolean, inputTokens?: number | null, outputTokens?: number | null, cachedTokens?: number | null, startedAt: string, completedAt?: string | null, externalReference?: string | null, events: Array<{ __typename?: 'TaskEvent', id: string, eventType: string, summary: string, createdAt: string }> }> }> };

export type CreateTaskVariables = Exact<{
  input: CreateTaskInput;
}>;


export type CreateTask = { __typename?: 'Mutation', createTask: { __typename?: 'Task', id: string } };

export type UpdateTaskVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
}>;


export type UpdateTask = { __typename?: 'Mutation', updateTask: { __typename?: 'Task', id: string } };

export type DispatchTaskVariables = Exact<{
  id: Scalars['ID']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
}>;


export type DispatchTask = { __typename?: 'Mutation', dispatchTask: { __typename?: 'Task', id: string, status: string } };

export type CancelTaskVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type CancelTask = { __typename?: 'Mutation', cancelTask: { __typename?: 'Task', id: string } };

export type ReviewTaskVariables = Exact<{
  id: Scalars['ID']['input'];
  decision: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
}>;


export type ReviewTask = { __typename?: 'Mutation', reviewTask: { __typename?: 'Task', id: string, status: string } };

export type TaskTemplatesVariables = Exact<{ [key: string]: never; }>;


export type TaskTemplates = { __typename?: 'Query', taskTemplates: Array<{ __typename?: 'TaskTemplate', id: string, name: string, title: string, brief: string, acceptance: string, agentSlug: string, priority: string, readOnly: boolean }> };

export type CreateTaskTemplateVariables = Exact<{
  input: CreateTaskTemplateInput;
}>;


export type CreateTaskTemplate = { __typename?: 'Mutation', createTaskTemplate: { __typename?: 'TaskTemplate', id: string, name: string } };

export type UpdateTaskTemplateVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTaskTemplateInput;
}>;


export type UpdateTaskTemplate = { __typename?: 'Mutation', updateTaskTemplate: { __typename?: 'TaskTemplate', id: string, name: string } };

export type DeleteTaskTemplateVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteTaskTemplate = { __typename?: 'Mutation', deleteTaskTemplate: { __typename?: 'TaskTemplate', id: string } };

export type ReviseTaskPlanVariables = Exact<{
  id: Scalars['ID']['input'];
  note: Scalars['String']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
}>;


export type ReviseTaskPlan = { __typename?: 'Mutation', reviseTaskPlan: { __typename?: 'Task', id: string, status: string } };

export type ExecuteTaskPlanVariables = Exact<{
  id: Scalars['ID']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
}>;


export type ExecuteTaskPlan = { __typename?: 'Mutation', executeTaskPlan: { __typename?: 'Task', id: string, status: string } };

export type DispatchTasksVariables = Exact<{
  ids: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
  tool?: InputMaybe<Scalars['String']['input']>;
}>;


export type DispatchTasks = { __typename?: 'Mutation', dispatchTasks: Array<{ __typename?: 'Task', id: string, status: string }> };

export type TaskRunMessagesVariables = Exact<{
  runId: Scalars['ID']['input'];
}>;


export type TaskRunMessages = { __typename?: 'Query', taskRunMessages: Array<{ __typename?: 'TaskRunMessage', role: string, content: string, createdAt: string }> };

export type WorkspaceStatusVariables = Exact<{ [key: string]: never; }>;


export type WorkspaceStatus = { __typename?: 'Query', workspaceStatus: { __typename?: 'WorkspaceStatus', dirty: boolean, changedCount: number } };

export type AddTaskArtifactVariables = Exact<{
  taskId: Scalars['ID']['input'];
  input: AddTaskArtifactInput;
}>;


export type AddTaskArtifact = { __typename?: 'Mutation', addTaskArtifact: { __typename?: 'Task', id: string } };

export type RemoveTaskArtifactVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveTaskArtifact = { __typename?: 'Mutation', removeTaskArtifact: { __typename?: 'Task', id: string } };

export type TaskRunLogVariables = Exact<{
  runId: Scalars['ID']['input'];
}>;


export type TaskRunLog = { __typename?: 'Query', taskRunLog: string };

export type TaskArtifactContentVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TaskArtifactContent = { __typename?: 'Query', taskArtifactContent: string };

export type TaskPulseVariables = Exact<{ [key: string]: never; }>;


export type TaskPulse = { __typename?: 'Query', taskPulse: { __typename?: 'TaskPulse', awaitingReview: number, running: number, queued: number, completedToday: number, failedToday: number } };

export type TaskRuntimeDashboardVariables = Exact<{
  filter?: InputMaybe<TaskRunFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TaskRuntimeDashboard = { __typename?: 'Query', taskRuns: { __typename?: 'TaskRunConnection', totalCount: number, edges: Array<{ __typename?: 'TaskRunEdge', cursor: string, node: { __typename?: 'TaskRun', id: string, title: string, platform: string, externalReference?: string | null, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, version: number, startedAt: string, updatedAt: string, completedAt?: string | null, events: Array<{ __typename?: 'TaskEvent', id: string, sequence: number, eventType: string, status?: TaskRunStatus | null, stage: TaskRunStage, agent: string, skills: Array<string>, summary: string, evidence?: Prisma.JsonValue | null, inputTokens?: number | null, outputTokens?: number | null, cachedTokens?: number | null, modelId?: string | null, createdAt: string }> } }>, pageInfo: { __typename?: 'TaskRunPageInfo', endCursor?: string | null, hasNextPage: boolean }, statusCounts: Array<{ __typename?: 'TaskRunStatusCount', status: TaskRunStatus, count: number }> }, runtimeHealth: { __typename?: 'RuntimeHealth', serverTime: string, database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } } };

export type TaskRunsChangedVariables = Exact<{ [key: string]: never; }>;


export type TaskRunsChanged = { __typename?: 'Subscription', taskRunsChanged: { __typename?: 'TaskRun', id: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, version: number, updatedAt: string, completedAt?: string | null } };

export type TeamWeeklyReportVariables = Exact<{
  range: RuntimeTimeRange;
}>;


export type TeamWeeklyReport = { __typename?: 'Query', teamWeeklyReport: { __typename?: 'TeamWeeklyReport', from: string, to: string, generatedAt: string, totalTasks: number, completedTasks: number, failedTasks: number, cancelledTasks: number, pendingTasks: number, inputTokens: number, outputTokens: number, cachedTokens: number, totalTokens: number, totalTokenCoverage: RuntimeMetricCoverage, headline: string, contributions: Array<{ __typename?: 'WeeklyAgentContribution', agent: string, workCount: number, trackedWorkCount: number, totalTokens: number, tokenCoverage: RuntimeMetricCoverage }>, completed: Array<{ __typename?: 'WeeklyTaskItem', id: string, title: string, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, updatedAt: string }>, failures: Array<{ __typename?: 'WeeklyTaskItem', id: string, title: string, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, updatedAt: string }>, pending: Array<{ __typename?: 'WeeklyTaskItem', id: string, title: string, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, updatedAt: string }> } };

export type SummaryTaskDetailVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type SummaryTaskDetail = { __typename?: 'Query', taskRun?: { __typename?: 'TaskRun', id: string, title: string, platform: string, externalReference?: string | null, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, version: number, startedAt: string, updatedAt: string, completedAt?: string | null, events: Array<{ __typename?: 'TaskEvent', id: string, sequence: number, eventType: string, status?: TaskRunStatus | null, stage: TaskRunStage, agent: string, skills: Array<string>, summary: string, evidence?: Prisma.JsonValue | null, inputTokens?: number | null, outputTokens?: number | null, cachedTokens?: number | null, modelId?: string | null, createdAt: string }> } | null };

export type AgentRuntimeStatusesVariables = Exact<{
  overviewRange?: InputMaybe<RuntimeTimeRange>;
}>;


export type AgentRuntimeStatuses = { __typename?: 'Query', taskRuns: { __typename?: 'TaskRunConnection', edges: Array<{ __typename?: 'TaskRunEdge', node: { __typename?: 'TaskRun', id: string, title: string, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, updatedAt: string } }> }, teamRuntimeOverview: { __typename?: 'TeamRuntimeOverview', totalWorkCount: number, totalTaskCount: number, trackedWorkCount: number, inputTokens: number, outputTokens: number, cachedTokens: number, totalTokens: number, inputTokenCoverage: RuntimeMetricCoverage, outputTokenCoverage: RuntimeMetricCoverage, cachedTokenCoverage: RuntimeMetricCoverage, totalTokenCoverage: RuntimeMetricCoverage, agents: Array<{ __typename?: 'AgentRuntimeMetric', agent: string, workCount: number, trackedWorkCount: number, inputTokens: number, outputTokens: number, cachedTokens: number, totalTokens: number, inputTokenCoverage: RuntimeMetricCoverage, outputTokenCoverage: RuntimeMetricCoverage, cachedTokenCoverage: RuntimeMetricCoverage, totalTokenCoverage: RuntimeMetricCoverage, latestModelId?: string | null, firstTaskAt?: string | null, lastTaskAt?: string | null }> } };

export type AgentRuntimeChangedVariables = Exact<{ [key: string]: never; }>;


export type AgentRuntimeChanged = { __typename?: 'Subscription', taskRunsChanged: { __typename?: 'TaskRun', id: string, primaryAgent: string, status: TaskRunStatus, updatedAt: string } };

export type ActionCenterOverviewVariables = Exact<{ [key: string]: never; }>;


export type ActionCenterOverview = { __typename?: 'Query', taskRuns: { __typename?: 'TaskRunConnection', edges: Array<{ __typename?: 'TaskRunEdge', node: { __typename?: 'TaskRun', id: string, title: string, primaryAgent: string, status: TaskRunStatus, summary?: string | null, updatedAt: string } }> }, runtimeHealth: { __typename?: 'RuntimeHealth', database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } }, installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, updatable: boolean }> };

export type RoleEvaluationToolsVariables = Exact<{ [key: string]: never; }>;


export type RoleEvaluationTools = { __typename?: 'Query', roleEvaluationTools: Array<{ __typename?: 'RoleEvaluationTool', id: string, name: string, available: boolean, version?: string | null, reason?: string | null }> };

export type DispatchRoleEvaluationVariables = Exact<{
  input: DispatchRoleEvaluationInput;
}>;


export type DispatchRoleEvaluation = { __typename?: 'Mutation', dispatchRoleEvaluation: { __typename?: 'RoleEvaluationDispatch', id: string, agentSlug: string, agentName: string, tool: string, startedAt: string, reportPath: string, logPath: string, pid?: number | null } };
