import { Prisma } from "src/lib/db"
import { MergePrismaWithSdlTypes, MakeRelationsOptional } from '@cedarjs/api'
import { TaskRun as PrismaTaskRun, User as PrismaUser, AuthSession as PrismaAuthSession, TaskEvent as PrismaTaskEvent } from 'src/lib/db'
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

type MaybeOrArrayOfMaybe<T> = T | Maybe<T> | Maybe<T>[];
type AllMappedModels = MaybeOrArrayOfMaybe<TaskEvent | TaskRun>


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
  AgentCapabilityHealth: ResolverTypeWrapper<AgentCapabilityHealth>;
  AgentRuntimeMetric: ResolverTypeWrapper<AgentRuntimeMetric>;
  AppendTaskEventInput: AppendTaskEventInput;
  AppendTaskEventResult: ResolverTypeWrapper<Omit<AppendTaskEventResult, 'event' | 'taskRun'> & { event: ResolversTypes['TaskEvent'], taskRun: ResolversTypes['TaskRun'] }>;
  BigInt: ResolverTypeWrapper<Scalars['BigInt']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Byte: ResolverTypeWrapper<Scalars['Byte']['output']>;
  CapabilityCliCheck: ResolverTypeWrapper<CapabilityCliCheck>;
  CapabilityHealth: ResolverTypeWrapper<CapabilityHealth>;
  CapabilityPlatformReport: ResolverTypeWrapper<CapabilityPlatformReport>;
  CapabilitySkillCheck: ResolverTypeWrapper<CapabilitySkillCheck>;
  CapabilitySummary: ResolverTypeWrapper<CapabilitySummary>;
  CapabilityToolCheck: ResolverTypeWrapper<CapabilityToolCheck>;
  Cedar: ResolverTypeWrapper<Cedar>;
  CreateTaskRunInput: CreateTaskRunInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
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
  RuntimeComponentHealth: ResolverTypeWrapper<RuntimeComponentHealth>;
  RuntimeHealth: ResolverTypeWrapper<RuntimeHealth>;
  RuntimeMetricCoverage: RuntimeMetricCoverage;
  RuntimeTimeRange: RuntimeTimeRange;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  TaskEvent: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskEvent, MakeRelationsOptional<TaskEvent, AllMappedModels>, AllMappedModels>>;
  TaskRun: ResolverTypeWrapper<MergePrismaWithSdlTypes<PrismaTaskRun, MakeRelationsOptional<TaskRun, AllMappedModels>, AllMappedModels>>;
  TaskRunConnection: ResolverTypeWrapper<Omit<TaskRunConnection, 'edges'> & { edges: Array<ResolversTypes['TaskRunEdge']> }>;
  TaskRunEdge: ResolverTypeWrapper<Omit<TaskRunEdge, 'node'> & { node: ResolversTypes['TaskRun'] }>;
  TaskRunFilter: TaskRunFilter;
  TaskRunPageInfo: ResolverTypeWrapper<TaskRunPageInfo>;
  TaskRunStage: TaskRunStage;
  TaskRunStatus: TaskRunStatus;
  TeamRuntimeOverview: ResolverTypeWrapper<TeamRuntimeOverview>;
  TeamWeeklyReport: ResolverTypeWrapper<TeamWeeklyReport>;
  Time: ResolverTypeWrapper<Scalars['Time']['output']>;
  UpdateInstalledSkillResult: ResolverTypeWrapper<UpdateInstalledSkillResult>;
  WeeklyAgentContribution: ResolverTypeWrapper<WeeklyAgentContribution>;
  WeeklyTaskItem: ResolverTypeWrapper<WeeklyTaskItem>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AgentCapabilityHealth: AgentCapabilityHealth;
  AgentRuntimeMetric: AgentRuntimeMetric;
  AppendTaskEventInput: AppendTaskEventInput;
  AppendTaskEventResult: Omit<AppendTaskEventResult, 'event' | 'taskRun'> & { event: ResolversParentTypes['TaskEvent'], taskRun: ResolversParentTypes['TaskRun'] };
  BigInt: Scalars['BigInt']['output'];
  Boolean: Scalars['Boolean']['output'];
  Byte: Scalars['Byte']['output'];
  CapabilityCliCheck: CapabilityCliCheck;
  CapabilityHealth: CapabilityHealth;
  CapabilityPlatformReport: CapabilityPlatformReport;
  CapabilitySkillCheck: CapabilitySkillCheck;
  CapabilitySummary: CapabilitySummary;
  CapabilityToolCheck: CapabilityToolCheck;
  Cedar: Cedar;
  CreateTaskRunInput: CreateTaskRunInput;
  Date: Scalars['Date']['output'];
  DateTime: Scalars['DateTime']['output'];
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
  RuntimeComponentHealth: RuntimeComponentHealth;
  RuntimeHealth: RuntimeHealth;
  RuntimeTimeRange: RuntimeTimeRange;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  TaskEvent: MergePrismaWithSdlTypes<PrismaTaskEvent, MakeRelationsOptional<TaskEvent, AllMappedModels>, AllMappedModels>;
  TaskRun: MergePrismaWithSdlTypes<PrismaTaskRun, MakeRelationsOptional<TaskRun, AllMappedModels>, AllMappedModels>;
  TaskRunConnection: Omit<TaskRunConnection, 'edges'> & { edges: Array<ResolversParentTypes['TaskRunEdge']> };
  TaskRunEdge: Omit<TaskRunEdge, 'node'> & { node: ResolversParentTypes['TaskRun'] };
  TaskRunFilter: TaskRunFilter;
  TaskRunPageInfo: TaskRunPageInfo;
  TeamRuntimeOverview: TeamRuntimeOverview;
  TeamWeeklyReport: TeamWeeklyReport;
  Time: Scalars['Time']['output'];
  UpdateInstalledSkillResult: UpdateInstalledSkillResult;
  WeeklyAgentContribution: WeeklyAgentContribution;
  WeeklyTaskItem: WeeklyTaskItem;
};

export type requireAuthDirectiveArgs = {
  roles?: Maybe<Array<Maybe<Scalars['String']['input']>>>;
};

export type requireAuthDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireAuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type requireRuntimeWriterDirectiveArgs = { };

export type requireRuntimeWriterDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = requireRuntimeWriterDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type skipAuthDirectiveArgs = { };

export type skipAuthDirectiveResolver<Result, Parent, ContextType = CedarGraphQLContext, Args = skipAuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

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
  totalTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
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
  totalTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  trackedWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
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

export interface FileScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['File'], any> {
  name: 'File';
}

export type InstalledSkillResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['InstalledSkill'] = ResolversParentTypes['InstalledSkill']> = {
  body: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  description: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
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
  description?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
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
  appendTaskEvent?: Resolver<ResolversTypes['AppendTaskEventResult'], ParentType, ContextType, RequireFields<MutationappendTaskEventArgs, 'input' | 'taskRunId'>>;
  createTaskRun?: Resolver<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationcreateTaskRunArgs, 'input'>>;
  updateInstalledSkill?: Resolver<ResolversTypes['UpdateInstalledSkillResult'], ParentType, ContextType, RequireFields<MutationupdateInstalledSkillArgs, 'id'>>;
};

export type MutationRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  appendTaskEvent?: RequiredResolverFn<ResolversTypes['AppendTaskEventResult'], ParentType, ContextType, RequireFields<MutationappendTaskEventArgs, 'input' | 'taskRunId'>>;
  createTaskRun?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType, RequireFields<MutationcreateTaskRunArgs, 'input'>>;
  updateInstalledSkill?: RequiredResolverFn<ResolversTypes['UpdateInstalledSkillResult'], ParentType, ContextType, RequireFields<MutationupdateInstalledSkillArgs, 'id'>>;
};

export type QueryResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  capabilityHealth?: OptArgsResolverFn<ResolversTypes['CapabilityHealth'], ParentType, ContextType>;
  cedar?: OptArgsResolverFn<Maybe<ResolversTypes['Cedar']>, ParentType, ContextType>;
  installedSkills?: OptArgsResolverFn<Array<ResolversTypes['InstalledSkill']>, ParentType, ContextType>;
  redwood?: OptArgsResolverFn<Maybe<ResolversTypes['Redwood']>, ParentType, ContextType>;
  runtimeHealth?: OptArgsResolverFn<ResolversTypes['RuntimeHealth'], ParentType, ContextType>;
  taskRun?: Resolver<Maybe<ResolversTypes['TaskRun']>, ParentType, ContextType, RequireFields<QuerytaskRunArgs, 'id'>>;
  taskRuns?: Resolver<ResolversTypes['TaskRunConnection'], ParentType, ContextType, RequireFields<QuerytaskRunsArgs, 'first'>>;
  teamRuntimeOverview?: Resolver<ResolversTypes['TeamRuntimeOverview'], ParentType, ContextType, Partial<QueryteamRuntimeOverviewArgs>>;
  teamWeeklyReport?: Resolver<ResolversTypes['TeamWeeklyReport'], ParentType, ContextType, RequireFields<QueryteamWeeklyReportArgs, 'range'>>;
};

export type QueryRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  capabilityHealth?: RequiredResolverFn<ResolversTypes['CapabilityHealth'], ParentType, ContextType>;
  cedar?: RequiredResolverFn<Maybe<ResolversTypes['Cedar']>, ParentType, ContextType>;
  installedSkills?: RequiredResolverFn<Array<ResolversTypes['InstalledSkill']>, ParentType, ContextType>;
  redwood?: RequiredResolverFn<Maybe<ResolversTypes['Redwood']>, ParentType, ContextType>;
  runtimeHealth?: RequiredResolverFn<ResolversTypes['RuntimeHealth'], ParentType, ContextType>;
  taskRun?: RequiredResolverFn<Maybe<ResolversTypes['TaskRun']>, ParentType, ContextType, RequireFields<QuerytaskRunArgs, 'id'>>;
  taskRuns?: RequiredResolverFn<ResolversTypes['TaskRunConnection'], ParentType, ContextType, RequireFields<QuerytaskRunsArgs, 'first'>>;
  teamRuntimeOverview?: RequiredResolverFn<ResolversTypes['TeamRuntimeOverview'], ParentType, ContextType, Partial<QueryteamRuntimeOverviewArgs>>;
  teamWeeklyReport?: RequiredResolverFn<ResolversTypes['TeamWeeklyReport'], ParentType, ContextType, RequireFields<QueryteamWeeklyReportArgs, 'range'>>;
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

export type TaskRunResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRun'] = ResolversParentTypes['TaskRun']> = {
  completedAt: OptArgsResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  currentStage: OptArgsResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  events: OptArgsResolverFn<Array<ResolversTypes['TaskEvent']>, ParentType, ContextType>;
  externalReference: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: OptArgsResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  platform: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  primaryAgent: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  startedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status: OptArgsResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt: OptArgsResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  version: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRun'] = ResolversParentTypes['TaskRun']> = {
  completedAt?: RequiredResolverFn<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  currentStage?: RequiredResolverFn<ResolversTypes['TaskRunStage'], ParentType, ContextType>;
  events?: RequiredResolverFn<Array<ResolversTypes['TaskEvent']>, ParentType, ContextType>;
  externalReference?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: RequiredResolverFn<ResolversTypes['ID'], ParentType, ContextType>;
  platform?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  primaryAgent?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  startedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  status?: RequiredResolverFn<ResolversTypes['TaskRunStatus'], ParentType, ContextType>;
  summary?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: RequiredResolverFn<ResolversTypes['DateTime'], ParentType, ContextType>;
  version?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskRunConnectionResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunConnection'] = ResolversParentTypes['TaskRunConnection']> = {
  edges: OptArgsResolverFn<Array<ResolversTypes['TaskRunEdge']>, ParentType, ContextType>;
  pageInfo: OptArgsResolverFn<ResolversTypes['TaskRunPageInfo'], ParentType, ContextType>;
};

export type TaskRunConnectionRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunConnection'] = ResolversParentTypes['TaskRunConnection']> = {
  edges?: RequiredResolverFn<Array<ResolversTypes['TaskRunEdge']>, ParentType, ContextType>;
  pageInfo?: RequiredResolverFn<ResolversTypes['TaskRunPageInfo'], ParentType, ContextType>;
};

export type TaskRunEdgeResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunEdge'] = ResolversParentTypes['TaskRunEdge']> = {
  cursor: OptArgsResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  node: OptArgsResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export type TaskRunEdgeRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunEdge'] = ResolversParentTypes['TaskRunEdge']> = {
  cursor?: RequiredResolverFn<ResolversTypes['String'], ParentType, ContextType>;
  node?: RequiredResolverFn<ResolversTypes['TaskRun'], ParentType, ContextType>;
};

export type TaskRunPageInfoResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunPageInfo'] = ResolversParentTypes['TaskRunPageInfo']> = {
  endCursor: OptArgsResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage: OptArgsResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type TaskRunPageInfoRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TaskRunPageInfo'] = ResolversParentTypes['TaskRunPageInfo']> = {
  endCursor?: RequiredResolverFn<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: RequiredResolverFn<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type TeamRuntimeOverviewResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamRuntimeOverview'] = ResolversParentTypes['TeamRuntimeOverview']> = {
  agents: OptArgsResolverFn<Array<ResolversTypes['AgentRuntimeMetric']>, ParentType, ContextType>;
  cachedTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  inputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalTaskCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage: OptArgsResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  trackedWorkCount: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TeamRuntimeOverviewRelationResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamRuntimeOverview'] = ResolversParentTypes['TeamRuntimeOverview']> = {
  agents?: RequiredResolverFn<Array<ResolversTypes['AgentRuntimeMetric']>, ParentType, ContextType>;
  cachedTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  cachedTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  inputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  inputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  outputTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  outputTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalTaskCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenCoverage?: RequiredResolverFn<ResolversTypes['RuntimeMetricCoverage'], ParentType, ContextType>;
  totalTokens?: RequiredResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  totalWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  trackedWorkCount?: RequiredResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TeamWeeklyReportResolvers<ContextType = CedarGraphQLContext, ParentType extends ResolversParentTypes['TeamWeeklyReport'] = ResolversParentTypes['TeamWeeklyReport']> = {
  cachedTokens: OptArgsResolverFn<ResolversTypes['Float'], ParentType, ContextType>;
  cancelledTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  completed: OptArgsResolverFn<Array<ResolversTypes['WeeklyTaskItem']>, ParentType, ContextType>;
  completedTasks: OptArgsResolverFn<ResolversTypes['Int'], ParentType, ContextType>;
  contributions: OptArgsResolverFn<Array<ResolversTypes['WeeklyAgentContribution']>, ParentType, ContextType>;
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

export type Resolvers<ContextType = CedarGraphQLContext> = {
  AgentCapabilityHealth: AgentCapabilityHealthResolvers<ContextType>;
  AgentRuntimeMetric: AgentRuntimeMetricResolvers<ContextType>;
  AppendTaskEventResult: AppendTaskEventResultResolvers<ContextType>;
  BigInt: GraphQLScalarType;
  Byte: GraphQLScalarType;
  CapabilityCliCheck: CapabilityCliCheckResolvers<ContextType>;
  CapabilityHealth: CapabilityHealthResolvers<ContextType>;
  CapabilityPlatformReport: CapabilityPlatformReportResolvers<ContextType>;
  CapabilitySkillCheck: CapabilitySkillCheckResolvers<ContextType>;
  CapabilitySummary: CapabilitySummaryResolvers<ContextType>;
  CapabilityToolCheck: CapabilityToolCheckResolvers<ContextType>;
  Cedar: CedarResolvers<ContextType>;
  Date: GraphQLScalarType;
  DateTime: GraphQLScalarType;
  File: GraphQLScalarType;
  InstalledSkill: InstalledSkillResolvers<ContextType>;
  JSON: GraphQLScalarType;
  JSONObject: GraphQLScalarType;
  Mutation: MutationResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Redwood: RedwoodResolvers<ContextType>;
  RuntimeComponentHealth: RuntimeComponentHealthResolvers<ContextType>;
  RuntimeHealth: RuntimeHealthResolvers<ContextType>;
  Subscription: SubscriptionResolvers<ContextType>;
  TaskEvent: TaskEventResolvers<ContextType>;
  TaskRun: TaskRunResolvers<ContextType>;
  TaskRunConnection: TaskRunConnectionResolvers<ContextType>;
  TaskRunEdge: TaskRunEdgeResolvers<ContextType>;
  TaskRunPageInfo: TaskRunPageInfoResolvers<ContextType>;
  TeamRuntimeOverview: TeamRuntimeOverviewResolvers<ContextType>;
  TeamWeeklyReport: TeamWeeklyReportResolvers<ContextType>;
  Time: GraphQLScalarType;
  UpdateInstalledSkillResult: UpdateInstalledSkillResultResolvers<ContextType>;
  WeeklyAgentContribution: WeeklyAgentContributionResolvers<ContextType>;
  WeeklyTaskItem: WeeklyTaskItemResolvers<ContextType>;
};

export type DirectiveResolvers<ContextType = CedarGraphQLContext> = {
  requireAuth: requireAuthDirectiveResolver<any, any, ContextType>;
  requireRuntimeWriter: requireRuntimeWriterDirectiveResolver<any, any, ContextType>;
  skipAuth: skipAuthDirectiveResolver<any, any, ContextType>;
};
