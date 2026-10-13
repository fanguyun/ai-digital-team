# 个人数字团队（Personal Digital Team）

这是一个用于展示和管理个人数字员工团队的可视化应用，同时也是团队 Agent 规则与 Skill 软链接的管理目录。

## 当前功能

- 展示数字团队介绍和团队运行状态。
- 展示清单中的全部 Agent 及其中文名、英文名、职责和所属分组。
- 按岗位分组筛选 Agent。
- 搜索角色名称、职责和 Skill。
- 查看单个 Agent 的岗位使命、触发条件和已连接 Skill。
- 展开或收起卡片中的 Skill 信息。
- 在应用内查看协作流程阶段与岗位分工。
- 在应用内查看本地演示运行记录，并按状态筛选。

## 启动项目

环境要求：Node.js 18+、pnpm 11.21.0。

```bash
pnpm install
pnpm dev
```

启动后访问终端输出的本地地址，通常是 `http://localhost:5173`。

生产构建：

```bash
pnpm build
pnpm preview
```

团队与插件校验：

```bash
pnpm check-team
```

仅检查 Agent 清单：

```bash
pnpm check-agents
```

## 目录结构

```text
.
├── agents/                  # 各个数字员工的规则和 Skill 入口
│   └── manifest.json        # 唯一岗位清单、展示元数据与同步顺序
├── plugins/
│   └── personal-digital-team/ # 插件导出副本（岗位规则）
├── .agents/
│   └── plugins/marketplace.json # 仓库级插件市场
├── src/
│   ├── main.jsx             # 应用入口，展示数据来自 Agent 清单
│   └── styles.css           # 页面样式与响应式布局
├── index.html               # HTML 入口
├── vite.config.js           # Vite 配置
├── package.json             # 项目脚本和依赖
└── AGENTS.md                # 团队公共规则
```

## Agent 规则

团队默认通过 `agents/main-agent/AGENTS.md` 路由任务。每个岗位目录包含独立的 `AGENTS.md`，岗位专属 Skill 位于对应的 `.agents/skills/` 目录。

`agents/manifest.json` 是岗位元数据的唯一清单，统一维护岗位标识、目录、分组、展示信息、触发条件、Skill 摘要和路由矩阵。前端与插件同步脚本均读取此文件；清单中的岗位目录必须与实际 `agents/*/AGENTS.md` 一一对应。

- `agents/ROUTING_MATRIX.md` 由清单自动生成，用于职责重叠和多岗位协作时确定当前主责、协作岗位、边界与交接顺序。
- `agents/DELIVERY_PROTOCOL.md` 是团队统一交付协议，规定任务状态、最小交付字段、验证证据、风险、待确认项和下一责任方。

Skill 入口保持软链接，不复制 Skill 文件。换设备后，如果软链接目标不存在，按团队规则提示并在用户确认后安装。

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
pnpm sync-team
```

该命令会校验清单、刷新自动生成的岗位索引与路由矩阵，再同步插件。插件中的 Main Agent 会携带路由矩阵，全部岗位会携带统一交付协议。仅需重新导出插件时可以单独运行：

```bash
pnpm sync-plugin
```

脚本会自动生成插件岗位规则、清理已删除岗位、校验插件，并在内容变化时更新 `plugin.json` 的 cachebuster。

如果插件校验脚本不在默认的 `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`，可通过 `PLUGIN_VALIDATOR_PATH` 指定：

```bash
PLUGIN_VALIDATOR_PATH=/path/to/validate_plugin.py pnpm sync-plugin
```

同步前可先预览变更，或在 CI 中只检查是否同步：

```bash
pnpm sync-plugin --dry-run
pnpm sync-plugin --check
```

### 安装

```bash
codex plugin marketplace add <repo-root>
codex plugin add personal-digital-team@personal-digital-team
```

本仓库使用本地 marketplace，修改并执行 `pnpm sync-plugin` 后，通过重新执行安装命令刷新插件缓存：

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
pnpm check-skills
```

如果本机的 Skill 管理器路径不同，可设置 `SKILLS_MANAGER_ROOT` 后修复链接：

```bash
SKILLS_MANAGER_ROOT="$HOME/.skills-manager" pnpm bootstrap-team
```

脚本会优先复用本机已有 Skill；缺失 Skill 时会逐项询问是否全局安装，确认后才调用 Skills Manager。项目侧始终保持软链接形式。

## 新增 Agent 的源目录同步

新增或调整 Agent 时，需要同步更新：

1. 对应岗位目录的 `AGENTS.md`。
2. `agents/manifest.json` 中的唯一岗位清单。

`pnpm sync-team` 会自动更新根目录 `AGENTS.md` 的岗位索引、Main Agent 的岗位总览、前端使用的岗位数据和插件导出。若新增岗位需要专门的路由判断或交付方式，仍需补充 `agents/main-agent/AGENTS.md` 中对应的路由规则。

## 新增 Agent 后同步插件

新增岗位后，先完成“源目录同步”，然后运行同步脚本：

```bash
pnpm sync-team
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

当前“协作流程”和“运行记录”使用本地演示数据，不代表已接入真实 Codex 执行日志。后续可以再接入真实的 Agent 文档解析、Skill 状态检测、项目切换和运行记录。
