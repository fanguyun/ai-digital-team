# 个人数字团队（Personal Digital Team）

这是一个用于展示和管理个人数字员工团队的可视化应用，同时也是团队 Agent 规则与 Skill 软链接的管理目录。

## 当前功能

- 展示数字团队介绍和团队运行状态。
- 展示当前 22 个 Agent 及其中文名、英文名、职责和所属分组。
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

## 目录结构

```text
.
├── agents/                  # 各个数字员工的规则和 Skill 入口
├── plugins/
│   └── personal-digital-team/ # 插件导出副本（岗位规则）
├── .agents/
│   └── plugins/marketplace.json # 仓库级插件市场
├── src/
│   ├── main.jsx             # 应用入口与 Agent 展示数据
│   └── styles.css           # 页面样式与响应式布局
├── index.html               # HTML 入口
├── vite.config.js           # Vite 配置
├── package.json             # 项目脚本和依赖
└── AGENTS.md                # 团队公共规则
```

## Agent 规则

团队默认通过 `agents/main-agent/AGENTS.md` 路由任务。每个岗位目录包含独立的 `AGENTS.md`，岗位专属 Skill 位于对应的 `.agents/skills/` 目录。

Skill 入口保持软链接，不复制 Skill 文件。换设备后，如果软链接目标不存在，按团队规则提示并在用户确认后安装。

## 插件使用

团队同时提供 Codex 插件版本，位置在 `plugins/personal-digital-team/`，仓库级 marketplace 位于 `.agents/plugins/marketplace.json`。

当前插件是“薄插件”：只包含 22 个岗位规则，不复制 Skill 文件；岗位规则通过 `$skill` 引用本机全局 Skill。

插件内置两个只读诊断脚本：

```bash
node plugins/personal-digital-team/scripts/list-team.mjs --format json
node plugins/personal-digital-team/scripts/check-installation.mjs
```

它们用于列出岗位和检查插件安装完整性，不会安装、同步或修改插件文件。

### 同步插件

修改任意 `agents/*/AGENTS.md` 后，运行：

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
## 更新
codex plugin marketplace upgrade personal-digital-team
```

安装后建议开启新线程，让 Codex 重新加载插件中的 skills 和 agent 元数据。

### 调用

- 使用 `$main-agent` 进入默认入口，由 Main Agent 理解和路由任务。
- 需要明确岗位时，直接调用对应 skill，例如 `$software-engineer-agent`、`$qa-security-engineer-agent`。
- 在 Codex 应用中也可以从插件详情页使用预设的启动提示。

原 `agents/` 目录仍是维护源；插件是导出的可安装副本。仓库内继续使用目录式规则时，插件不会改变现有行为。

## 换设备初始化

拉取项目后，先检查 Skill 软链接：

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
2. 根目录 `AGENTS.md` 的 Agent 索引。
3. `agents/main-agent/AGENTS.md` 的岗位清单和路由规则。
4. `src/main.jsx` 中的展示数据。

## 新增 Agent 后同步插件

新增岗位后，先完成“源目录同步”，然后运行同步脚本：

```bash
pnpm sync-plugin
```

脚本会完成以下工作：

- 发现 `agents/<岗位目录名>/AGENTS.md`，生成 `SKILL.md` 和 `agents/openai.yaml`。
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
