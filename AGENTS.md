# 个人数字团队（Personal Digital Team）

> 一个以 Main Agent 为入口、按长期职责组织数字员工的个人工作空间。

## 使用方式

默认先与 Main Agent 对话；当任务明确属于某个岗位时，再进入对应的子 Agent。岗位目录只保存该岗位的职责、流程、Skill 和边界，业务项目与个人数据仍保存在各自的工作目录。

## 入口规则（Entry Rules）

- 用户没有明确指定岗位 Agent 时，先完整读取 `agents/main-agent/AGENTS.md`。
- 用户明确指定某个岗位 Agent 时，只读取该岗位目录中的 `AGENTS.md`，不自动混用其他岗位规则。
- 当前没有匹配的岗位 Agent 时，由 Main Agent 直接处理；如果任务确实需要长期专属职责，再提出新增岗位建议。
- 岗位 Agent 的规则、数据和操作权限应保持边界清晰；后续新增岗位时，不把岗位专属 Skill 放在团队根目录。

## Agent 索引（Agent Directory）

| Agent | 目录 | 负责范围 |
| --- | --- | --- |
| 数字总经理（Main Agent） | `agents/main-agent/` | 默认入口、任务路由、跨岗位协作、结果整合 |
| 交互 UI 设计师（Interaction UI Designer Agent） | `agents/interaction-ui-designer-agent/` | 项目要求分析、页面设计、页面实现、交互优化、UI 验证 |
| 产品与解决方案负责人（Product & Solution Agent） | `agents/product-solution-agent/` | 需求分析、方案设计、实现型 Markdown PRD、验收标准 |
| 软件工程师（Software Engineer Agent） | `agents/software-engineer-agent/` | 架构选型、接口设计、代码实现、测试、部署与工程排障 |
| 质量与安全工程师（QA & Security Engineer Agent） | `agents/qa-security-engineer-agent/` | 功能测试、回归验证、安全审查、依赖扫描与发布风险判断 |
| 设计实现工程师（Design Engineer Agent） | `agents/design-engineer-agent/` | Figma/设计稿/截图还原、素材映射、页面实现与视觉验证 |
| 平台与运维工程师（Platform & Operations Engineer） | `agents/platform-operations-agent/` | 上线方案、基础设施、硬件建议、监控告警与长期运维 |
| 研究与知识管理（Research & Knowledge Agent） | `agents/research-knowledge-agent/` | 行业研究、竞品分析、资料整理、来源核验与知识库维护建议 |
| 内容与品牌运营（Content & Brand Agent） | `agents/content-brand-agent/` | 内容策划、公众号/小红书/官网内容、品牌表达与发布草稿 |
| 增长与销售（Growth & Sales Agent） | `agents/growth-sales-agent/` | 获客、线索研究、报价草稿、销售话术与跟进计划 |
| 客户成功与交付（Customer Success Agent） | `agents/customer-success-agent/` | 需求澄清、交付跟踪、验收协作、反馈闭环与复购建议 |
| 财务与行政（Finance & Operations Agent） | `agents/finance-operations-agent/` | 记账、报价、合同、回款、成本与经营分析 |
| 自动化与工具工程师（Automation & Tools Agent） | `agents/automation-tools-agent/` | 工作流自动化、MCP、脚本、CLI 与内部工具 |
| 数据分析师（Data Analyst Agent） | `agents/data-analyst-agent/` | 指标、用户数据、转化率、成本、收入与经营报表 |
| 项目管理（Project Manager Agent） | `agents/project-manager-agent/` | 任务、里程碑、进度、依赖、风险与跨岗位协调 |

## 公共边界（Shared Boundaries）

- 规则文件只描述职责、流程、数据边界和验收方式，不保存密码、令牌、银行卡信息或其他敏感凭证。
- 使用岗位 Skill 前，先检查项目中的软链接及其目标 `SKILL.md` 是否存在且可读。目标缺失或软链接失效时，先向用户说明缺失的 Skill、拟执行的全局安装动作和影响范围，等待用户明确确认后再安装。
- Skill 安装完成后，项目侧继续保留 `.agents/skills/` 下的软链接形式；不得把 Skill 文件复制进项目，也不得用复制文件替代软链接。
- 涉及新增、修改、删除、付费或对外发布等有外部影响的操作时，先确认目标和后果，再执行。
- 真实数据目录、代码仓库和知识库由各自的工作对象维护；只有明确授权的 Agent 才能访问或修改。
