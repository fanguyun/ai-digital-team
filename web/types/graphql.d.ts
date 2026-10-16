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

export type InstalledSkill = {
  __typename?: 'InstalledSkill';
  body: Scalars['String']['output'];
  description: Scalars['String']['output'];
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
  appendTaskEvent: AppendTaskEventResult;
  createTaskRun: TaskRun;
  updateInstalledSkill: UpdateInstalledSkillResult;
};


export type MutationappendTaskEventArgs = {
  input: AppendTaskEventInput;
  taskRunId: Scalars['ID']['input'];
};


export type MutationcreateTaskRunArgs = {
  input: CreateTaskRunInput;
};


export type MutationupdateInstalledSkillArgs = {
  id: Scalars['ID']['input'];
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
  runtimeHealth: RuntimeHealth;
  taskRun?: Maybe<TaskRun>;
  taskRuns: TaskRunConnection;
  teamRuntimeOverview: TeamRuntimeOverview;
  teamWeeklyReport: TeamWeeklyReport;
};


/** About the Cedar queries. */
export type QuerytaskRunArgs = {
  id: Scalars['ID']['input'];
};


/** About the Cedar queries. */
export type QuerytaskRunsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TaskRunFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
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

export type TaskRun = {
  __typename?: 'TaskRun';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  currentStage: TaskRunStage;
  events: Array<TaskEvent>;
  externalReference?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
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
};

export type TaskRunEdge = {
  __typename?: 'TaskRunEdge';
  cursor: Scalars['String']['output'];
  node: TaskRun;
};

export type TaskRunFilter = {
  platform?: InputMaybe<Scalars['String']['input']>;
  primaryAgent?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<TaskRunStatus>>;
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

export type CapabilityHealthCenterVariables = Exact<{ [key: string]: never; }>;


export type CapabilityHealthCenter = { __typename?: 'Query', capabilityHealth: { __typename?: 'CapabilityHealth', generatedAt: string, cli: Array<{ __typename?: 'CapabilityCliCheck', id: string, name: string, status: string, path: string, message: string }>, reports: Array<{ __typename?: 'CapabilityPlatformReport', platform: string, generatedAt: string, summary: { __typename?: 'CapabilitySummary', total: number, complete: number, partial: number, notInstalled: number, unbound: number }, agents: Array<{ __typename?: 'AgentCapabilityHealth', slug: string, name: string, status: string, platformSupported: boolean, agentInstalled: boolean, missingRequiredSkills: Array<string>, missingOptionalSkills: Array<string>, missingRequiredTools: Array<string>, unboundRequiredSkills: Array<string>, suggestions: Array<string> }> }> }, runtimeHealth: { __typename?: 'RuntimeHealth', serverTime: string, database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } }, installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, updatable: boolean }> };

export type InstalledSkillsVariables = Exact<{ [key: string]: never; }>;


export type InstalledSkills = { __typename?: 'Query', installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, description: string, source: string, tags: Array<string>, path: string, updatedAt: string, updatable: boolean, body: string }> };

export type UpdateInstalledSkillVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type UpdateInstalledSkill = { __typename?: 'Mutation', updateInstalledSkill: { __typename?: 'UpdateInstalledSkillResult', message: string, skill: { __typename?: 'InstalledSkill', id: string, name: string, description: string, source: string, tags: Array<string>, path: string, updatedAt: string, updatable: boolean, body: string } } };

export type TaskRuntimeDashboardVariables = Exact<{
  filter?: InputMaybe<TaskRunFilter>;
}>;


export type TaskRuntimeDashboard = { __typename?: 'Query', taskRuns: { __typename?: 'TaskRunConnection', edges: Array<{ __typename?: 'TaskRunEdge', cursor: string, node: { __typename?: 'TaskRun', id: string, title: string, platform: string, externalReference?: string | null, primaryAgent: string, status: TaskRunStatus, currentStage: TaskRunStage, summary?: string | null, version: number, startedAt: string, updatedAt: string, completedAt?: string | null, events: Array<{ __typename?: 'TaskEvent', id: string, sequence: number, eventType: string, status?: TaskRunStatus | null, stage: TaskRunStage, agent: string, skills: Array<string>, summary: string, evidence?: Prisma.JsonValue | null, inputTokens?: number | null, outputTokens?: number | null, cachedTokens?: number | null, modelId?: string | null, createdAt: string }> } }>, pageInfo: { __typename?: 'TaskRunPageInfo', endCursor?: string | null, hasNextPage: boolean } }, runtimeHealth: { __typename?: 'RuntimeHealth', serverTime: string, database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } } };

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


export type ActionCenterOverview = { __typename?: 'Query', taskRuns: { __typename?: 'TaskRunConnection', edges: Array<{ __typename?: 'TaskRunEdge', node: { __typename?: 'TaskRun', id: string, title: string, primaryAgent: string, status: TaskRunStatus, summary?: string | null, updatedAt: string } }> }, runtimeHealth: { __typename?: 'RuntimeHealth', database: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null }, realtime: { __typename?: 'RuntimeComponentHealth', status: string, message?: string | null } }, teamRuntimeOverview: { __typename?: 'TeamRuntimeOverview', totalTaskCount: number, trackedWorkCount: number, totalTokenCoverage: RuntimeMetricCoverage }, installedSkills: Array<{ __typename?: 'InstalledSkill', id: string, name: string, updatable: boolean }> };
