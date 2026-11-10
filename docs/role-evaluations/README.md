# 岗位评估记录

岗位档案抽屉里的「岗位评估更新」按钮，会把一次只读评估派发给 Codex 或 DeepSeek Harness，产物落在本目录。

## 目录约定

- `<slug>-<YYYYMMDD-HHmm>.md`：`role-development-agent` 产出的评估报告，入库。
- `logs/`：派发日志、最终回复与 sidecar JSON，不入库（已写入 `.gitignore`）。

## 派发记录（sidecar）

`logs/<slug>-<YYYYMMDD-HHmm>.json` 记录岗位、工具、PID、开始时间、报告路径与实际执行的 argv，便于回溯失败原因。

## 边界

- 评估只读：不修改 `agents/`、`web/`、`api/`、`scripts/`，不安装 Skill，不提交代码。
- 报告只作建议；应用变更前按 `agents/DELIVERY_PROTOCOL.md` 走人工确认。
- 停用派发：在 `.env` 里设置 `ROLE_EVAL_ALLOW_DISPATCH=0` 后重启 API。
- 日志和报告都按分钟命名，同一分钟重复派发会被同岗互斥拦下，先结束旧进程再重试。
