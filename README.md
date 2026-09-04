# 个人数字团队（Personal Digital Team）

这是一个用于展示和管理个人数字员工团队的可视化应用，同时也是团队 Agent 规则与 Skill 软链接的管理目录。

## 当前功能

- 展示数字团队介绍和团队运行状态。
- 展示当前 15 个 Agent 及其中文名、英文名、职责和所属分组。
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

## 目录结构

```text
.
├── agents/                  # 各个数字员工的规则和 Skill 入口
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

## 后续扩展

新增或调整 Agent 时，需要同步更新：

1. 对应岗位目录的 `AGENTS.md`。
2. 根目录 `AGENTS.md` 的 Agent 索引。
3. `agents/main-agent/AGENTS.md` 的岗位清单和路由规则。
4. `src/main.jsx` 中的展示数据。

当前“协作流程”和“运行记录”使用本地演示数据，不代表已接入真实 Codex 执行日志。后续可以再接入真实的 Agent 文档解析、Skill 状态检测、项目切换和运行记录。
