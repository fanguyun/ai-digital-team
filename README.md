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
- 通过 GraphQL SSE 自动接收 Codex 与 DeepSeek Harness 的状态更新。
- 使用统一 `task-runtime` CLI 创建任务、等待确认、恢复、完成或失败任务。

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

修改任意 `agents/*/AGENTS.md` 或 `agents/manifest.json` 后，优先运行团队级同步：

```bash
yarn sync-team
```

该命令会校验清单、刷新自动生成的岗位索引与路由矩阵，再同步插件。插件中的 Main Agent 会携带路由矩阵，全部岗位会携带统一交付协议。仅需重新导出插件时可以单独运行：

```bash
yarn sync-plugin
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

本仓库使用本地 marketplace，修改并执行 `yarn sync-plugin` 后，通过重新执行安装命令刷新插件缓存：

```bash
codex plugin add personal-digital-team@personal-digital-team
```

`codex plugin marketplace upgrade` 仅用于 Git marketplace，不适用于当前 `source: local` 配置。

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

Harness bundle 只内置团队的岗位 Skill、路由矩阵和统一交付协议。岗位文档引用的 `research`、`xlsx`、`agently-mail` 等外部专项 Skill 不会被复制进本仓库；需要这些能力时，将对应 Skill 单独安装到 Harness 支持的 `.dsh/skills` 或 `.agents/skills` 目录。

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
