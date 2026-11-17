# Personal Digital Team Panel

给 DeepSeek Harness Web 界面加一个左侧栏一级入口「数字团队」，把 `agents/manifest.json` 里的岗位清单直接呈现在 DSH 中。

## 功能

- 左侧栏新增「数字团队」入口，与「插件」「自动化任务」同级。
- 全宽全高布局：岗位列表独立滚动，右侧岗位档案或团队概览占满可用高度。
- 按 `groups` 分组展示全部数字员工，卡片显示岗位名、英文名、职责与能力数量。
- 搜索岗位名、英文名、目录名、职责、触发条件与 Skill。
- 分组筛选、成员/分组/在线数量统计、手动刷新。
- 岗位详情：使命、负责范围、触发条件、能力与 Skill、能力要求、适用平台、加入时间、协作路由。
- 一键复制 `$<slug>` 调用指令和 `agents/<slug>/AGENTS.md` 档案路径。
- 实时团队态势：今日任务、进行中、待确认、今日 Token；岗位卡片显示执行状态、7 日任务量与 Token。
- 执行中的岗位卡片显示当前任务标题；点击任务行会在 DSH 右侧 Browser 中打开运行记录，并按岗位过滤；岗位详情里也可直接打开任务看板。
- 支持「仅活跃」筛选和按调用量/最近活跃排序；实时数据每 20 秒轮询，失败时保留静态清单并标注未连接。
- 岗位清单实时读取 `agents/manifest.json`；找不到清单时回退到打包内的快照。
- 运行数据来自团队任务 API 的只读聚合查询，Token 不采集时显示「未采集」，不按 0 处理。

## 数据来源

Host 端按以下顺序定位清单，命中即用：

1. 插件配置 `teamRoot`
2. 环境变量 `PERSONAL_DIGITAL_TEAM_ROOT`
3. DSH 进程工作目录向上查找 `agents/manifest.json`
4. 插件包目录向上查找 `agents/manifest.json`
5. 内置快照 `lib/data/team.json`

因此从本仓库以本地目录安装时，面板会一直读取仓库里的清单；发布或迁移到别处时，快照保证面板仍有内容。

需要覆盖清单位置时，在 profile 的 `cordis.patch.yml` 中按 id 追加配置：

```yaml
- id: personal-digital-team-panel
  config:
    teamRoot: /path/to/ai-digital-team
```

## 实时数据

Host 端通过只读 token 调用任务 API 的 `teamRuntimeOverview` 聚合查询：

- 任务次数：按 `TaskRun.primaryAgent` 统计（主责接单量）。
- Token：按 `TaskEvent.agent` 汇总 `inputTokens + outputTokens`；`cachedTokens` 单独保留。
- 状态：当前 `RUNNING` / `WAITING_CONFIRMATION` / `QUEUED` 的任务数，不受统计区间限制。
- 时间范围：今日（本地零点起）与最近 7 天。

只读 token 只用于聚合查询，不授予写权限；返回内容包含活跃任务标题，不包含任务正文。

只读 token 配置在团队仓库 `.env`（不进入浏览器）：

```bash
TEAM_READ_TOKEN=<random-token>
```

API 侧同一变量启用 `@requireSessionOrTeamReader` 指令。Host 读取顺序：

1. 插件配置 `readToken`
2. 环境变量 `PERSONAL_DIGITAL_TEAM_READ_TOKEN` / `TEAM_READ_TOKEN`
3. 团队仓库 `.env` 的 `TEAM_READ_TOKEN`

API 地址默认 `http://127.0.0.1:8901/graphql`，可通过插件配置 `apiUrl` 或 `PERSONAL_DIGITAL_TEAM_API_URL` 覆盖。

任务看板地址默认 `http://127.0.0.1:8900`，可通过插件配置 `appUrl`、`PERSONAL_DIGITAL_TEAM_APP_URL` 或 `.env` 的 `TEAM_APP_URL` 覆盖。任务行跳转使用 `?view=runs&agent=<slug>`，任务看板按钮使用 `?view=tasks&agent=<slug>`；团队 Web 应用的 `HomePage`、`TaskBoard` 与运行记录页已支持对应深链。

## 安装

推荐在 DSH 的插件管理里安装本地目录：目标填
`/Users/fan/ai-digital-team/plugins/personal-digital-team-panel`。插件管理会同时写入依赖和 bundle 清单，并热应用。

使用 CLI 时，`dsh plugin add` 只安装依赖，还需要把包名加进 profile 的 bundle 清单：

```bash
dsh plugin --profile desktop add link:/Users/fan/ai-digital-team/plugins/personal-digital-team-panel
```

然后确认 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 包含
`personal-digital-team-panel`，重启 DSH。左侧栏出现「数字团队」即安装成功。

## 更新快照

```bash
node plugins/personal-digital-team-panel/scripts/sync-snapshot.mjs
```

输出 `lib/data/team.json`。仓库内实时读取清单时不需要执行；仅在内置兜底数据需要同步时运行。

## 结构

```text
plugins/personal-digital-team-panel/
├── cordis.patch.yml        # 把插件挂进 DSH 的 bundle patch
├── icon.svg
├── lib/
│   ├── index.js            # Host：/team 清单 + /live 只读聚合
│   ├── normalize.js        # 清单裁剪与校验（Host 与快照脚本共用）
│   ├── client.js           # Browser：sidebar.panellist + main 面板 + 实时态势
│   └── data/team.json      # 内置快照
└── scripts/sync-snapshot.mjs
```

## 验证

- `node --check lib/client.js lib/index.js lib/normalize.js`
- 打开左侧栏「数字团队」，确认分组、搜索、详情与复制按钮可用。
- 修改 `agents/manifest.json` 后点击「刷新」，面板应读取到新数据。
