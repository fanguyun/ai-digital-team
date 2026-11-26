# Personal Digital Team（Antigravity 插件）

> 由 `scripts/sync-antigravity.mjs` 自动生成，包含默认入口 Skill（`main-agent`）、入口规则与全部 27 个岗位的按需参考文档。

## 目录结构

```text
antigravity/plugins/personal-digital-team/
├── plugin.json
├── README.md
├── rules/
│   └── AGENTS.md
├── skills/
│   └── main-agent/
│       ├── SKILL.md
│       └── references/
│           ├── ROUTING_MATRIX.md
│           ├── DELIVERY_PROTOCOL.md
│           └── <slug>.md (27 个岗位)
└── scripts/
    ├── list-team.mjs
    ├── inspect-role.mjs
    ├── check-installation.mjs
    ├── task-runtime.mjs
    └── runtime-telemetry.mjs
```

## 在 Antigravity 中启用

方式一：在 `~/.gemini/config/plugins.json` 中声明本仓库的插件父目录（推荐，随时跟随 `yarn sync-antigravity` 更新）：

```json
{
  "entries": [
    { "path": "<repo-root>/antigravity/plugins" }
  ]
}
```

方式二：软链接到 Antigravity 全局插件目录：

```bash
mkdir -p ~/.gemini/config/plugins
ln -s <repo-root>/antigravity/plugins/personal-digital-team ~/.gemini/config/plugins/personal-digital-team
```

## 自检命令

```bash
node antigravity/plugins/personal-digital-team/scripts/check-installation.mjs
node antigravity/plugins/personal-digital-team/scripts/list-team.mjs --format json
```
