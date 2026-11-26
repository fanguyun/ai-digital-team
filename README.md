# 个人数字团队（Personal Digital Team）

这是一个用于展示和管理个人数字员工团队的可视化应用，同时也是团队 Agent 规则与 Skill 软链接的管理目录。

## 当前功能

- 展示数字团队介绍和团队运行状态。
- 展示清单中的全部 Agent 及其中文名、英文名、职责和所属分组。
- 按岗位分组筛选 Agent。
- 搜索角色名称、职责和 Skill。
- 查看单个 Agent 的岗位使命、触发条件和已连接 Skill。
- 展开或收起卡片中的 Skill 信息。
- 查看由 PostgreSQL 保存的真实任务、五阶段协作流程和事件时间线。
- 任务详情「产物」页按目录树展示产物，代码文件点「打开」用带行号与关键字着色的代码视图预览（Markdown 仍走富文本渲染）。
- 运行记录里点开每个阶段查看详情：需求进入 → 需求原文与验收标准，方案规划 → `docs/plans/` 下的方案文件，执行实现 → 该轮次的消息与工具调用轨迹，验证确认 → 证据与复核结论，结果交付 → 产物清单与收尾说明。阶段详情不落库，按需从任务记录、方案文件、会话日志与运行日志实时读取；会话记录读不到时只展示事件时间线并给出说明。
- 通过 GraphQL SSE 自动接收 Codex 与 DeepSeek Harness 的状态更新。
- 使用统一 `task-runtime` CLI 创建任务、等待确认、恢复、完成或失败任务。
- 计划模式下，Codex 与 DeepSeek Harness 只读分析并返回完整 Markdown，由系统按 `docs/plans/<任务ID>/<运行ID>.md` 保存独立版本；修订会生成新版本，失败时不能批准旧方案。任务详情可预览正文、提出修订意见并选择执行平台，默认继承最近一轮平台；批准后仍遵循任务原有的只读设置。首次生成与批量生成前会确认保存方案。
- 新建/编辑任务时可选择「外部知识库：使用 / 不使用」：开启且可用时把知识片段带进提示词；未配置或不可用自动忽略，不阻塞派发（默认使用）。
- 待验收或失败的任务再次执行统一叫「重新派发」：点卡片上的按钮直接打开任务抽屉，在抽屉底部的「重新派发」区块填写本轮修改要求（预填上一轮结论）后点「确认重新派发」；要求并入提示词并写入任务结论。
- 待处理中心支持就地处理三类高频事项：待批准方案可直接「批准并执行」，待验收成果可直接「通过/打回」（打回与无产物通过都要求填写说明），长时间未更新的运行可直接「刷新状态」。
- 待处理中心集中显示待批准方案、待验收成果与失败任务，点击可直达对应任务及方案、产物或执行记录；关联任务的历史运行不会重复提醒。任务查询先筛选状态再取最近 100 条，达到上限时提示；查询失败时保留已有数据并显示同步异常。
- 工作总结新增「交付物统计」：按运行统计变更文件数与增删行数（结束值减去派发基线，避免把派发前就有的未提交改动算进来），按仓库顶层目录分组，根目录文件归入「未分类」；日志、构建产物、软链接与二进制不计入，无统计的历史运行通过覆盖率提示说明。
- 任务页工具栏的「派发到」可以选择本地执行平台（Codex / DeepSeek Harness），选择会被记住，单卡派发、批量派发与方案批准都按它执行。
- 任务页顶部可以按创建时间筛选：全部 / 今日 / 本周（周一起）/ 本月 / 自定义区间，服务端按 `createdAt` 过滤。
- 能力健康中心里每个「需要处理」的岗位都有「修复」按钮：先给出修复方案（安装位置、要建/要替换的软链接、校验方式），确认后自动执行能自动化的部分（只建软链接、不复制文件）；缺少安装的 Skill 只给步骤。
- 点「派发」前会先做确定性预检（`taskPrecheck`）：验收标准是否为空、交付物目录是否存在、只读任务是否要求改代码等，有问题先弹确认；跑完后若验收标准点名的文件没生成，会在结论里标出「缺少验收标准里的交付物」。
- 页面显示「执行中」但本地进程已经结束时，可在运行记录详情或任务卡片点「刷新状态」，后端会按日志/会话快照重新判定（进程退出、日志 15 分钟不动、会话已结束都会自动收尾）。
- 在岗位档案抽屉点击「岗位评估更新」，把只读评估派发给 Codex 或 DeepSeek Harness，报告写入 `docs/role-evaluations/`；同时登记一条任务到任务看板（`岗位评估 · <岗位名>`），跑完自动进入待验收并挂上报告产物。
- 岗位档案还提供「用该角色发起任务」快捷入口（直达新建任务并预选岗位）和「复制调用指令」（复制 `$<slug>`）。
- 评估派发后 20 秒内盯着状态：进程启动失败会直接在面板显示日志里的真实报错；任务看板上的评估任务会跟随评估记录自动收尾，失败时把原因写进任务备注。
- 用 dsh 跑评估时，模型来自那份 profile 的 `agent-default-model`：headless profile 默认是内置 `deepseek-official`（需要 `DEEPSEEK_API_KEY`），接本地 Magpie 网关要在 `~/.dsh/profiles/headless/cordis.patch.yml` 追加 `agent-default-model: provider: magpie-responses`。

## 启动项目

环境要求：Node.js 24.x、Yarn 4、Docker Desktop 或 Docker Engine。

```bash
corepack enable
yarn install
cp .env.example .env
yarn db:up
yarn db:migrate
yarn dev
```

启动后访问 `http://127.0.0.1:8900`。Cedar API 监听
`http://127.0.0.1:8901`，PostgreSQL 仅绑定 `127.0.0.1:5433`。

页面需要登录后才能进入。首次启动时，如果数据库里还没有
`AUTH_USERNAME` 对应用户，会用 `.env` 中的 `AUTH_PASSWORD` 创建账号，数据库只保存密码哈希。任务运行时 CLI 仍使用 `TASK_RUNTIME_WRITE_TOKEN`，不走登录会话。

常用数据库命令：

```bash
yarn db:status
yarn db:backup
yarn db:down
```

### 同步到 NAS 数据库

本地开发库始终是唯一写入源，NAS 上的库作为异地只读副本。同步脚本会先在
`<库名>__staging` 还原并校验行数，一致后才切换，失败不影响现有库。

```bash
cp scripts/db-sync.env.example scripts/db-sync.env   # 填 NAS_SSH=用户@NAS地址
yarn db:sync-status      # 对比两边表数与行数
yarn db:push             # 本地 → NAS
yarn db:pull             # NAS → 本地（异地改过数据时拉回）
```

前置条件：SSH 免密到 NAS，且 NAS 上 `sudo` 对 `docker` 免密（脚本会在前置检查中提示具体命令）。


团队与插件校验：

```bash
yarn check-team
```

仅检查 Agent 清单：

```bash
yarn check-agents
```

完整构建和浏览器端到端检查属于发布前高成本验证，按仓库确认门单独执行。

## 任务运行时 CLI

CLI 只通过 GraphQL 读写任务，不直接连接 PostgreSQL。写操作使用 `.env` 中的
`TASK_RUNTIME_WRITE_TOKEN`：

```bash
yarn task-runtime start \
  --title "实现实时任务面板" \
  --platform codex \
  --agent software-engineer-agent \
  --stage EXECUTION \
  --skills base-guidelines,typescript-pro \
  --summary "开始执行 CedarJS 迁移"

yarn task-runtime wait-confirmation <task-id> --summary "等待完整构建确认"
yarn task-runtime resume <task-id> --summary "继续执行验证"
yarn task-runtime complete <task-id> --summary "迁移完成"
yarn task-runtime list
yarn task-runtime show <task-id>
yarn task-runtime health
```

未传 `--idempotency-key` 时，CLI 会根据命令和规范化输入生成稳定键，同一命令重试不会重复创建事件。可通过 `--json` 获取结构化输出。

CLI 默认使用 `--telemetry auto` 从当前 Codex 会话 JSONL 或 DeepSeek Harness session 日志提取真实模型与增量 Token。`start` 只记录模型，后续事件按上一个任务事件时间切分增量；适配器不会提取、保存或上传 Prompt、消息正文与工具参数。

需要覆盖自动值时，可在 `start`、`event`、`complete` 等写入命令中增加：

```bash
--model-id "<model-id>" \
--input-tokens <incremental-input> \
--output-tokens <incremental-output> \
--cached-tokens <incremental-cached-input>
```

也可设置 `TASK_RUNTIME_MODEL_ID`、`TASK_RUNTIME_INPUT_TOKENS`、`TASK_RUNTIME_OUTPUT_TOKENS`、`TASK_RUNTIME_CACHED_TOKENS` 作为默认值。优先级为命令行参数、环境变量、自动遥测；使用 `--telemetry off` 或 `TASK_RUNTIME_TELEMETRY=off` 可关闭自动读取。拿不到真实数据时字段保持缺失，面板显示“未采集”，不会估算或写入 0。

Agent 运行时接入规则位于 `agents/DELIVERY_PROTOCOL.md`。Main Agent 为一个用户任务创建唯一记录并传递 `taskRunId`，协作岗位只追加阶段事件。执行 `yarn sync-team` 后，同一 CLI 会自动分发到 Codex 插件的 `scripts/` 和 DeepSeek Harness 的 `dsh/scripts/`，两个平台均通过 GraphQL 写入，不直接访问数据库。

## 目录结构

```text
.
├── agents/                  # 各个数字员工的规则和 Skill 入口
│   └── manifest.json        # 唯一岗位清单、展示元数据与同步顺序
├── plugins/
│   └── personal-digital-team/ # 插件导出副本（岗位规则）
├── .agents/
│   └── plugins/marketplace.json # 仓库级插件市场
├── api/                     # Cedar API、GraphQL、Services 与 Prisma
├── web/                     # Cedar React 前端与实时任务面板
├── docker/postgres/init/    # PostgreSQL 初始化脚本
├── scripts/task-runtime.mjs # Codex/Harness 统一任务写入 CLI
├── compose.yml              # 本机 PostgreSQL 18
├── cedar.toml               # Cedar 双 side 配置
├── package.json             # 项目脚本和依赖
└── AGENTS.md                # 团队公共规则
```

## Agent 规则

团队默认通过 `agents/main-agent/AGENTS.md` 路由任务。每个岗位目录包含独立的 `AGENTS.md`，岗位专属 Skill 位于对应的 `.agents/skills/` 目录。

`agents/manifest.json` 是岗位元数据的唯一清单，统一维护岗位标识、目录、分组、展示信息、触发条件、Skill 摘要和路由矩阵。前端与插件同步脚本均读取此文件；清单中的岗位目录必须与实际 `agents/*/AGENTS.md` 一一对应。

每个岗位还通过 `capabilityRequirements` 声明跨平台运行依赖：

- `requiredSkills`：缺失时岗位只能部分运行的必需 Skill。
- `optionalSkills`：缺失时不阻断岗位，但会出现在健康检查提示中。
- `requiredTools`：岗位运行依赖的命令行工具。
- `platforms`：当前支持的平台，现为 `codex` 和 `deepseek-harness`。
- `assessment`：可选的人工评估说明，用于记录待补绑定或可移植性风险。

- `agents/ROUTING_MATRIX.md` 由清单自动生成，用于职责重叠和多岗位协作时确定当前主责、协作岗位、边界与交接顺序。
- `agents/DELIVERY_PROTOCOL.md` 是团队统一交付协议，规定任务状态、最小交付字段、验证证据、风险、待确认项和下一责任方。

Codex 与 DeepSeek Harness 共用变更确认规则：文件或已保存内容的变更，先展示计划并获得明确确认后执行；未使用工具原生 Plan 模式时，在对话中给出目标、影响范围、执行步骤和验证方式。保存计划文件也需先确认，跨岗位交接沿用已批准的计划与授权范围。

复杂任务由 Main Agent 使用 `writing-plans` 编写实施计划，简单修改可直接给出简短计划。计划标题、章节、步骤、说明、验证标准和交接文字使用中文，路径、命令和代码保留原样。`writing-plans` 是外部 Skill，需在当前平台可读取，并保持岗位级软链接；插件不会复制其内容。

Skill 入口保持软链接，不复制 Skill 文件。换设备后，如果软链接目标不存在，按团队规则提示并在用户确认后安装。

## 能力依赖与健康检查

运行全部能力测试，并严格检查 Codex 与 DeepSeek Harness：

```bash
yarn check-capabilities
```

也可以单独检查某个平台：

```bash
node scripts/capability-health.mjs --platform codex
node scripts/capability-health.mjs --platform deepseek-harness
```

检查结果包含三种岗位状态：

- `complete`：岗位 Skill 已安装，必需 Skill 和工具均可用。
- `partial`：岗位已安装，但缺少必需 Skill 或工具。
- `not-installed`：该平台未找到岗位 Skill。

可选 Skill 缺失不会把岗位降级为 `partial`。已全局安装但没有建立岗位级软链接的必需 Skill 会单独提示，作为可移植性风险；检查脚本只读运行，不会自动安装 Skill 或修改软链接。

CI 或其他工具需要结构化结果时使用 JSON 输出；需要在岗位不完整时返回非零退出码时增加 `--strict`：

```bash
node scripts/capability-health.mjs --platform codex --format json
node scripts/capability-health.mjs --platform deepseek-harness --strict
```

## 插件使用

团队同时提供 Codex 插件版本，位置在 `plugins/personal-digital-team/`，仓库级 marketplace 位于 `.agents/plugins/marketplace.json`。

当前插件是“薄插件”：只包含清单定义的岗位规则，不复制 Skill 文件；岗位规则通过 `$skill` 引用本机全局 Skill。

插件内置两个只读诊断脚本：

```bash
node plugins/personal-digital-team/scripts/list-team.mjs --format json
node plugins/personal-digital-team/scripts/check-installation.mjs
```

它们用于列出岗位和检查插件安装完整性，不会安装、同步或修改插件文件。

### 同步插件

修改任意 `agents/*/AGENTS.md`、`agents/manifest.json` 或 `agents/DELIVERY_PROTOCOL.md` 后，优先运行团队级同步：

```bash
yarn sync-team
```

该命令会校验清单、刷新自动生成的岗位索引与路由矩阵，再同步 Codex 插件与 DSH 能力包。插件中的 Main Agent 会携带路由矩阵，全部岗位会携带统一交付协议。仅需重新导出时可以按以下顺序运行：

```bash
yarn sync-plugin
yarn sync-deepseek-harness
```

脚本会自动生成插件岗位规则、清理已删除岗位、校验插件，并在内容变化时更新 `plugin.json` 的 cachebuster。

如果插件校验脚本不在默认的 `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`，可通过 `PLUGIN_VALIDATOR_PATH` 指定：

```bash
PLUGIN_VALIDATOR_PATH=/path/to/validate_plugin.py yarn sync-plugin
```

同步前可先预览变更，或在 CI 中只检查是否同步：

```bash
yarn sync-plugin --dry-run
yarn sync-plugin --check
```

### 安装

```bash
codex plugin marketplace add <repo-root>
codex plugin add personal-digital-team@personal-digital-team
```

更新方式取决于 marketplace 的安装来源，可通过 `codex plugin marketplace list` 核对。使用本地 marketplace 时，执行 `yarn sync-team` 后重新安装以刷新插件缓存：

```bash
codex plugin add personal-digital-team@personal-digital-team
```

使用 Git marketplace 时，先将源规则与两端导出提交、推送到安装所引用的分支，再刷新该 marketplace 并重新安装插件：

```bash
codex plugin marketplace upgrade personal-digital-team
codex plugin add personal-digital-team@personal-digital-team
```

`codex plugin marketplace upgrade` 仅用于 Git marketplace；本地来源直接读取已同步的仓库文件。

安装后建议开启新线程，让 Codex 重新加载插件中的 skills 和 agent 元数据。

### 调用

- 使用 `$main-agent` 进入默认入口，由 Main Agent 理解和路由任务。
- 需要明确岗位时，直接调用对应 skill，例如 `$software-engineer-agent`、`$qa-security-engineer-agent`。
- 在 Codex 应用中也可以从插件详情页使用预设的启动提示。

原 `agents/` 目录仍是维护源；插件是导出的可安装副本。仓库内继续使用目录式规则时，插件不会改变现有行为。

## DeepSeek Harness 使用

仓库根包同时声明了 DeepSeek Harness bundle。Harness 安装时会挂载 `dsh/skills/` 中自动生成的 27 个岗位 Skill，不影响现有 Codex 插件。

使用当前 Git 仓库安装到指定 profile，例如 Web：

```bash
dsh plugin --profile web add https://github.com/fanguyun/ai-digital-team.git
```

其他 profile 将 `web` 替换为 `tui` 或 `headless`。安装后可以检查组合配置：

```bash
dsh --profile web --dump-config
```

输出中应包含 `personal-digital-team-skills`。进入 Harness 后使用 `/main-agent` 调用默认入口，或使用 `/personal-executive-assistant-agent` 等岗位命令。

更新已安装的 Git 版本时，先提交并推送 `yarn sync-team` 生成的内容，再更新对应 profile。`web`、`tui`、`headless` 等 CLI 管理的 profile 可以重新添加 Git 来源，例如：

```bash
dsh plugin --profile web add github:fanguyun/ai-digital-team#main
dsh --profile web --dump-config
```

桌面端的 `desktop` profile 由 Electron 应用专属管理，CLI 会拒绝修改。请在桌面应用“插件”中查看 `personal-digital-team` 的更新入口；需要重新安装 Git 来源时，在“添加插件”中填写 `github:fanguyun/ai-digital-team#main`。第三方 Git 包的版本号未变化时，界面可能显示“已是最新版本”，仍需核对安装文件中的规则内容；如界面要求先卸载再安装，执行前确认影响范围。

更新后按界面提示重新加载 DSH 实例并开启新会话。仅同步仓库中的 `dsh/skills/` 不会自动更新已安装的 Git 包，也不会改写已有会话的上下文。

Harness bundle 只内置团队的岗位 Skill、路由矩阵和统一交付协议。岗位文档引用的 `research`、`xlsx`、`agently-mail` 等外部专项 Skill 不会被复制进本仓库；需要这些能力时，将对应 Skill 单独安装到 Harness 支持的 `.dsh/skills` 或 `.agents/skills` 目录。

### 新设备初始化（DSH）

插件不随 DeepSeek 账号同步。安装记录保存在每台设备本机的
`~/.dsh/profiles/<profile>/package.json`，登录同一账号只会带回会话历史与
偏好设置，不会带回插件。换设备时按以下清单操作：

1. 安装 DSH 本体并登录同一 DeepSeek 账号（会话与用量自动恢复）。
2. 逐 profile 重装插件（Electron 桌面端使用 `desktop` profile）：

```bash
dsh plugin --profile desktop add github:fanguyun/ai-digital-team#main
dsh plugin --profile web add github:fanguyun/ai-digital-team#main
dsh plugin --profile tui add github:fanguyun/ai-digital-team#main
```

3. 验证组合配置包含 `personal-digital-team` bundle：

```bash
dsh --profile web --dump-config
```

4. 补齐外部专项 Skill（Harness bundle 不复制这些文件，缺失时岗位只能部分运行）：

```bash
yarn check-skills
SKILLS_MANAGER_ROOT="$HOME/.skills-manager" yarn bootstrap-team
```

5. 检查各平台岗位健康状态：

```bash
node scripts/capability-health.mjs --platform deepseek-harness
```

6. 开新会话，让 Harness 重新加载 skills 与岗位元数据。

注意：`desktop` profile 由 Electron 应用独占管理，CLI 无法 dump 其配置；桌面端
也可在 GUI 插件管理器中完成安装。不建议直接拷贝 `~/.dsh/profiles/` 目录迁移：
`node_modules` 含平台相关二进制，且容易带入旧缓存。

## Antigravity 插件使用

仓库同时提供原生 Antigravity 插件导出，位置在 `antigravity/plugins/personal-digital-team/`，与 Codex 插件及 DeepSeek Harness 共享同一份 `agents/` 源规则。

为避免 27 个岗位同时占用 Antigravity 的 Skill 上下文预算，插件采用渐进式披露结构：仅暴露 `main-agent` 1 个入口 Skill 与精简的 `rules/AGENTS.md`（严格低于 24 KB 上限），其余岗位规则与共享协议存放于 `skills/main-agent/references/` 按需读取；外部专项 Skill 仍保持本机全局安装，不复制到插件内。

### 同步与校验

```bash
yarn sync-antigravity
yarn check-antigravity
```

`yarn sync-team` 与 `yarn check-team` 已自动包含 Antigravity 插件的同步与校验。

### 在 Antigravity 中启用

方式一（推荐）：在 `~/.gemini/config/plugins.json` 中注册本仓库插件父目录，后续执行 `yarn sync-antigravity` 即自动生效：

```json
{
  "entries": [
    { "path": "<repo-root>/antigravity/plugins" }
  ]
}
```

方式二：将插件目录软链接到 Antigravity 全局插件目录：

```bash
mkdir -p ~/.gemini/config/plugins
ln -s <repo-root>/antigravity/plugins/personal-digital-team ~/.gemini/config/plugins/personal-digital-team
```

内置只读自检命令：

```bash
node antigravity/plugins/personal-digital-team/scripts/check-installation.mjs
node antigravity/plugins/personal-digital-team/scripts/list-team.mjs --format json
```

## 换设备初始化

拉取项目后，先检查 Skill 软链接。该检查同时验证已有软链接是否有效，以及岗位规则引用的已安装 Skill 是否已建立岗位级绑定：

```bash
yarn check-skills
```

如果本机的 Skill 管理器路径不同，可设置 `SKILLS_MANAGER_ROOT` 后修复链接：

```bash
SKILLS_MANAGER_ROOT="$HOME/.skills-manager" yarn bootstrap-team
```

脚本会优先复用本机已有 Skill；缺失 Skill 时会逐项询问是否全局安装，确认后才调用 Skills Manager。项目侧始终保持软链接形式。

## 新增 Agent 的源目录同步

新增或调整 Agent 时，需要同步更新：

1. 对应岗位目录的 `AGENTS.md`。
2. `agents/manifest.json` 中的唯一岗位清单。

`yarn sync-team` 会自动更新根目录 `AGENTS.md` 的岗位索引、Main Agent 的岗位总览、前端使用的岗位数据和插件导出。若新增岗位需要专门的路由判断或交付方式，仍需补充 `agents/main-agent/AGENTS.md` 中对应的路由规则。

## 新增 Agent 后同步插件

新增岗位后，先完成“源目录同步”，然后运行同步脚本：

```bash
yarn sync-team
```

脚本会完成以下工作：

- 校验清单字段、岗位 ID、岗位目录和分组的一致性。
- 校验路由场景、主责岗位、协作岗位和统一交付协议结构。
- 生成 `agents/ROUTING_MATRIX.md`，刷新根目录岗位索引和 Main Agent 岗位总览。
- 按 `agents/manifest.json` 的岗位顺序生成 `SKILL.md` 和 `agents/openai.yaml`。
- 生成 `dsh/skills/` 下的 Harness Skill，并把岗位间调用转换为 `/岗位名`。
- 清理已删除岗位对应的插件 skill 目录。
- 内容变化时更新 `plugin.json` 的 cachebuster，并运行插件校验。
- 跨岗位路径会从 `../` 转换为 `$<skill>`。

仍需手动完成两件事：

1. 如果新增岗位引用了新的 Skill，先确认该 Skill 已存在于 `~/.codex/skills` 和 `~/.agents/skills`。当前插件不复制 Skill 文件；缺失时补全局软链或全局安装。
2. 同步完成后重装插件并开新线程验证：

```bash
codex plugin add personal-digital-team@personal-digital-team
```

不要手工编辑 `.agents/plugins/marketplace.json`；marketplace 条目由插件工作流维护。

任务运行时只保存状态元数据、短摘要和证据路径，不保存完整 Prompt、凭证或敏感正文。浏览器保持只读，写入令牌不会进入 `web` bundle。

## NAS 思源外部知识库（首期关键词检索）

面板派发任务可在取得运行资格后，向 NAS 上的只读检索服务请求一次知识片段，再交给 Codex 或 DeepSeek Harness。检索链路不建立向量索引、不缓存跨任务结果、不读取附件或展开块引用。独立客户端会话不受此配置影响。AI 文档入库使用下述独立确认流程。

**AI 产物写入思源**

更新服务前执行 `yarn cedar prisma migrate deploy` 应用发布记录表的增量迁移，并重新生成 Prisma Client。知识库配置选择「思源直连」，启用所需岗位并配置允许的笔记本与目录。

1. 在任务详情的「产物 → 知识库文档入库」选择 `docs/` 下的 `.md`／`.txt` 产物；其他 AI 生成内容可在「团队设置 → 外部知识库」的同名入口粘贴正文。
2. 选择笔记本、目录和标题，点击「预览待入库文档」。后端保存正文快照，此时不会写入思源。
3. 核对正文与完整目标路径，点击「确认写入思源并回读验证」。后端创建文档、回读核对路径及正文，验证通过后返回 `siyuan://blocks/<文档ID>` 链接与回执。

仅登录用户可确认自己的入库记录；Agent 不接收写入令牌。直连的岗位、笔记本和目录范围同时约束入库；检索桥暂不支持写入。单篇上限 200KB，暂不自动上传本地图片或附件。同名不同正文不会覆盖，修改正文或更换来源需使用新标题。超时记录可继续核对，系统不会盲目再次创建。回读先比较正文哈希，格式不同时使用思源 `/api/lute/md2html` 分别渲染两份正文，要求完整 HTML 一致；此接口不支持或内容不一致时保留为「结果待核对」。发布快照含完整正文并保存在团队数据库中，应纳入现有数据库访问与备份管理。

功能默认关闭。当前仓库交付代码与部署模板，**尚未连接真实 NAS、核验思源版本、部署或通过真实资料评测**。先完成以下启用条件：

1. 确认思源实际版本、部署方式、容器内可达地址、团队后端到 NAS 的局域网/VPN 路径。
2. 由资料负责人确定共享笔记本 ID、首批 20～50 篇非敏感文档，并允许片段进入现有模型、网关、会话及日志链路。
3. 在 NAS 网络位置核验 `POST /api/notebook/lsNotebooks` 返回 `data.notebooks`（含 `id`、`closed`），`POST /api/query/sql` 接受固定 `SELECT` 与 `mode: "readonly"`，业务 `code` 为 `0`。读取样本须有 `id`、`root_id`、`box`、`type`、`content`、`hpath`、文档标题及可选 `updated`；保存脱敏样本。代码依赖这些字段，版本不符时先调整契约，不能静默取消权限检查。首期 SQL 只读取文档、标题、段落，不需要调用整篇导出或 Kramdown 接口。
4. 在隔离环境验证只读策略；思源 Token 可能有更大权限，服务白名单不等于思源本身有笔记本级隔离。

NAS 侧配置模板位于 [nas/siyuan-rag/.env.example](nas/siyuan-rag/.env.example)。确认部署位置和网络边界后，复制为同目录 `.env`，通过受控文件填写思源地址、Token、笔记本 ID 白名单和独立服务密钥；真实凭证不提交仓库、不贴进任务正文。不要把现有思源容器、数据库或工作空间挂载进新服务。Compose 默认只绑定 NAS 本机，需要跨主机时改为已确认的 NAS 局域网 IP 并设置防火墙；跨不可信网络使用现有 HTTPS 反向代理。

部署操作应在获准的 NAS 环境执行（本次未执行）：

```bash
docker compose --env-file nas/siyuan-rag/.env -f nas/siyuan-rag/compose.yml up -d --build
```

镜像仅以检索服务目录为构建上下文，不发送仓库其他配置。`GET /healthz` 只证明进程存活；`POST /v1/search` 以 `Authorization: Bearer <独立服务密钥>` 鉴权，只接受 `{ "query": "有限查询", "limit": 6 }`。传入 SQL、地址、凭证、笔记本范围等额外字段会被拒绝。每次请求检查白名单笔记本是否打开，并对返回行再次校验范围；不向思源转发调用方凭证，不执行模型生成 SQL。

团队后端按根目录 [.env.example](.env.example) 配置（重载后生效）：

| 配置 | 含义 |
| --- | --- |
| `SETTINGS_SECRET` | 至少 32 字符；用于加密保存「团队设置 → 外部知识库」里的访问令牌。未配置时界面无法保存令牌（但仍可用下面的环境变量方式） |
| `KNOWLEDGE_ENABLED=0` | 默认关闭；实例核验与数据去向确认后设为 `1` |
| `KNOWLEDGE_BRIDGE_URL` | 固定服务 origin，不带路径、查询串或凭证，禁止跟随重定向 |
| `KNOWLEDGE_BRIDGE_TOKEN` | 与 NAS 的 `RAG_BRIDGE_TOKEN` 相同，至少 32 字符；团队侧不保存思源 Token |
| `KNOWLEDGE_AGENTS=main-agent` | 先仅为 main-agent 试点，逗号分隔岗位 slug；它不是资料权限配置 |
| `KNOWLEDGE_MODE=optional` | 无命中或失败继续任务并声明无证据；`required` 在无有效证据或配置失败时阻止派发 |
| `KNOWLEDGE_TIMEOUT_MS=4000` | 总调用预算，最多 4 秒，无自动重试 |

首期模式为后端统一配置，不能由任务正文切换。NAS 白名单为空时拒绝启动，缺少或关闭任一配置笔记本时报告知识源异常，不扩大搜索范围。未列入试点的岗位沿用原流程。

查询仅使用当前标题、需求及本轮修订/打回意见（修订优先），最多 300 字符；不附加岗位规则、完整提示或历史。服务提取最多 6 个词，以关键词命中数排序，最多返回 6 个片段；最终注入最多 4 个，同一文档最多 2 个，每个正文最多 1,500 字符、合计最多 5,000 字符。服务处理预算 3 秒、团队响应上限 256 KiB。不调用 Embedding、重排或其他付费模型。关键词命中不代表语义相似度或答案正确率。

引用包含 `[KB-n]`、标题、文档/块 ID、`siyuan://blocks/<块ID>`、可用的源更新时间、读取时间和 SHA-256 摘要。设备须安装并关联思源才能打开链接，也可复制块 ID 定位；面板点击行为待实机核验。外部片段仅作资料，不能改变只读、批准与工具权限。检索凭证从新任务子进程环境剔除；这不提供操作系统隔离，因此试点只用允许共享的资料。片段会进入现有模型提示与执行日志；`TaskEvent.evidence.knowledge` 只保存状态、模式、耗时、适配器版本、来源 ID、哈希和读取时间，不保存查询或片段正文。

**在「团队设置」里配置知识库**

支持两种连接方式，在卡片里的「连接方式」切换：

| 方式 | 地址 | 令牌 | 说明 |
| --- | --- | --- | --- |
| 思源直连 | 思源服务地址（默认 `http://<NAS_IP>:6806`） | 思源「设置 → 关于 → API token」 | 团队后端直接调用只读接口 `POST /api/search/fullTextSearchBlock` 与 `POST /api/notebook/lsNotebooks`，鉴权头为 `Authorization: Token <token>`；笔记本与目录都在团队侧过滤 |
| 自建检索桥 | 桥的 origin（默认 `:8787`） | 桥的 `RAG_BRIDGE_TOKEN` | 桥侧维护笔记本白名单，团队侧只拿片段，鉴权头为 `Authorization: Bearer <token>` |

> 直连模式会把思源 Token 加密保存在团队数据库（只回显末 4 位）。该 Token 等同该账号对全部笔记本的读写权限，仅在单人/可信环境使用；多用户部署仍建议走检索桥。


团队设置页（能力健康中心）新增「外部知识库（RAG）」卡片，可在界面维护：启用开关、服务地址、访问令牌、检索模式、超时、试点岗位与允许的目录。配置存库（`RagKnowledgeConfig` 单行），令牌以 AES-256-GCM 密文保存、只回显末 4 位；「测试连接」依次检查地址合法性、`GET /healthz` 与 `POST /v1/search` 的鉴权与响应形状，并把结果与耗时写入配置。数据库配置优先于环境变量，清除配置后自动回落到 `KNOWLEDGE_*`。

- 「目录」是团队侧白名单：检索服务只接受 `{query, limit}`，笔记本白名单仍在 NAS 侧维护；这里的目录用于丢弃范围外片段（等于前缀或以「前缀/」开头），被过滤数量记入 `TaskEvent.evidence.knowledge.filteredOut`。
- 测试连接只针对**已保存的地址**，改完地址需先保存再测试，避免把后端当作任意 URL 的跳板。
- 保存令牌需要 `SETTINGS_SECRET`；密钥轮换后需重新填写一次令牌（旧密文解密失败会提示「令牌不可用」）。
- 界面保存的令牌只校验「非空 + 不超过 512 字符」，具体长度与格式要求由检索服务判定；是否填写正确请用「测试连接」验证。

本地定向验证（不调用真实模型或思源）：

```bash
node --test services/siyuan-rag-bridge/server.test.mjs services/siyuan-rag-bridge/siyuan.test.mjs
yarn test:api:unit --runInBand --runTestsByPath api/src/lib/knowledgeConfig.test.ts api/src/lib/knowledgeRetrieval.test.ts api/src/lib/knowledgeContext.test.ts api/src/lib/knowledgeDispatch.test.ts api/src/lib/agentDispatch.test.ts
# 先确认 TEST_DATABASE_URL 是与业务库不同的专用测试库；该命令会重置测试库。
yarn test:api --runInBand --runTestsByPath api/src/services/tasks/tasks.test.ts
git diff --check
```

HTTP 入口测试直接调用真实处理器及内存流，不开放网络监听；模拟测试不能替代 NAS 实例契约和端口连通性验证。启用前按[已确认方案](docs/plans/0aa53ce3-8988-417e-b079-98f806bfe8a2/bdcd669f-8882-4d58-89fd-0bddc15772e0.md)完成 40 道人工标准证据题、30 次计时、两平台各一次真实任务，以及更新、删除、移出白名单、笔记本关闭与停用演练。前 4 片段须覆盖至少 22/24 道有答案问题，引用支持率至少 95%，P95 新增耗时目标不超过 3 秒；越界、伪造引用或批准绕过阻断扩大试点。同义表达召回不足时再另行规划语义索引。

2026-11-20 局部验证记录：后端 47 项单元/模拟派发测试、NAS 服务 10 项测试通过，变更文件 ESLint 与 `git diff --check` 通过；检索配置、客户端、上下文及其单测通过定向 TypeScript 检查（`--skipLibCheck`）；Compose 模板通过 `config --no-env-resolution --quiet` 静态检查，未加载部署密钥、构建或启动容器。专用 PostgreSQL 测试库地址已确认与业务库不同，但派发回归在初始化阶段因 `127.0.0.1:5433` 不可达而未运行，模拟派发测试不能替代数据库并发回归。API 全量类型检查在现有生成声明、鉴权测试、`passwords.ts` 等未改文件报错，本次改动文件无报告错误；全量类型检查未通过。NAS 实例、真实模型、性能评测、完整构建、端到端和独立验收均未执行。

停用时将 `KNOWLEDGE_ENABLED=0` 并重载后端，验证普通任务恢复原派发流程；必要时停止独立检索服务或撤销它的服务密钥。无需数据库迁移或改动思源笔记。已启动任务及模型日志中的片段不能通过关闭开关撤回，需要取消任务并按原日志保留策略处理。
