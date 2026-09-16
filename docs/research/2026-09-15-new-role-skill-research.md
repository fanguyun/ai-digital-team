# 新增岗位 Skill 候选研究

## 研究目标

为以下四个拟新增岗位筛选可接入的公开 Skill：

- AI 应用工程师（AI Application Engineer）
- 用户研究与体验研究（User Research Agent）
- 商业战略与经营分析（Business Strategy Agent）
- 隐私与数据治理（Privacy & Data Governance Agent）

研究优先考虑：职责匹配度、来源可追溯性、是否已经安装在本机，以及接入后是否会与现有岗位发生明显职责冲突。访问和核验时间为 2026-09-15。

## 结论摘要

| 岗位 | 建议接入 | 决策 |
| --- | --- | --- |
| AI 应用工程师 | `rag-architect`、`prompt-engineer` | 建议接入；均已安装，且覆盖 AI 应用的两个稳定核心能力 |
| 用户研究与体验研究 | `million-dollar-weekend-research` | 有条件接入；适合需求验证和访谈证据，不等于完整 UX Research 方法库 |
| 商业战略与经营分析 | 暂不接入专项 Skill | 留空；现有候选偏早期市场验证，不能替代商业战略与经营分析 |
| 隐私与数据治理 | 暂不接入专项 Skill | 留空；现有安全 Skill 偏代码安全或审计，缺少数据生命周期和治理职责 |

## 1. AI 应用工程师

### 建议接入

#### `rag-architect`

- **匹配度：高。** 覆盖文档切分、向量存储、混合检索、重排和检索质量评估，适合知识库、语义搜索及有来源约束的 AI 应用。
- **边界：** 只负责 RAG 专项能力，不应扩张为岗位的全部能力；模型接入、工具调用、Agent 工作流、安全和成本仍需岗位规则统一约束。
- **来源：** 本机已安装版本声明作者为 Jeff Allan、许可证为 MIT、版本为 1.1.0；其一手文档提供完整工作流和参考资料索引。
- **建议：** 接入。

#### `prompt-engineer`

- **匹配度：高。** 覆盖 Prompt 模板、结构化输出、函数调用 Schema、评测量表和测试集，符合 AI 应用工程中的可评估交付要求。
- **边界：** Skill 中的具体阈值和提示方法应视作方法建议，不能当作跨任务通用质量标准；生产指标仍需按项目定义。
- **来源：** 本机已安装版本声明作者为 Jeff Allan、许可证为 MIT、版本为 1.2.0；其一手文档包含 Prompt 设计、测试、迭代和部署流程。
- **建议：** 接入。

### 暂不建议作为默认 Skill

- `fine-tuning-expert`：职责聚焦 LoRA、QLoRA、PEFT 与模型训练。当前岗位定位是 AI 应用交付，不应默认宣称模型训练能力；出现明确微调任务时再专项调用。
- `ml-pipeline`：职责聚焦 MLOps、训练编排、特征库和模型注册，超出日常 AI 应用工程的最小岗位边界。

## 2. 用户研究与体验研究

### 有条件接入

#### `million-dollar-weekend-research`

- **匹配度：中高。** 覆盖目标用户、替代方案、用户访谈、证据分级、最小验证实验，以及 Go／调整／停止决策。
- **适用范围：** 发现问题、早期需求验证、访谈设计和需求证据整理。
- **缺口：** 不完整覆盖可用性测试、研究招募、无障碍研究、定性编码、研究伦理、持续体验度量等 UX Research 能力。
- **来源：** 本机已安装 Skill；其内容明确要求询问过去行为、区分陈述与真实承诺，并避免把点赞或泛泛意向当作需求证据。
- **建议：** 可以接入，但岗位文档需明确它是“早期需求验证”工具，而不是该岗位唯一或完整的方法体系。

### 未找到可直接采用的完整专项 Skill

截至本次核验，没有发现来源清晰、内容完整且能直接覆盖端到端 UX Research 职责的已安装 Skill。与其把通用 `research`、UI 评审或网页审计 Skill 强行映射为用户研究，建议暂时只接入上述有边界的候选，或直接留空等待后续补充专项 Skill。

公开的 `agency-agents` 仓库包含职责高度匹配的 [UX Researcher](https://github.com/msitarzewski/agency-agents/blob/main/design/design-ux-researcher.md)，覆盖访谈、可用性测试、用户旅程和研究伦理。但它是 Agent 定义文件，不是标准 `SKILL.md`，因此不能直接作为现成 Skill 建立软链接。

## 3. 商业战略与经营分析

### 建议暂时留空

- `million-dollar-weekend-research` 能支持早期市场验证，但其中心是访谈、外联、预售与需求证据，不覆盖组合战略、市场进入、护城河、资源配置、商业模型、年度经营目标和经营复盘。
- `the-fool` 可用于反方论证、预演失败和证据审计，但属于通用决策复核工具，不是商业战略专项 Skill。
- `multi-mental-models` 可扩展分析视角，但同样不能取代商业战略和经营分析的标准流程与交付物。

因此，不建议为了“有 Skill”而绑定职责不完整的候选。岗位可先通过自身 `AGENTS.md` 工作，待找到或创建具备明确商业战略边界的专项 Skill 后再接入。

公开的 `agency-agents` 仓库包含职责匹配的 [Business Strategist](https://github.com/msitarzewski/agency-agents/blob/main/specialized/business-strategist.md)，覆盖竞争、市场进入、商业模式、情景规划和执行。但该文件是 Agent 定义而非标准 Skill，只能作为后续自建 Skill 的研究素材，不能直接接入。

## 4. 隐私与数据治理

### 建议暂时留空

本机已有 `secure-code-guardian`、`security-reviewer`、`project-security-scan` 等安全类 Skill，但职责分别偏向安全实现、漏洞审计和仓库级安全扫描。它们不能完整承担以下数据治理职责：

- 数据发现与分类分级
- 数据流、处理目的和合法性记录
- 数据最小化、保留期限与删除机制
- 数据主体请求和跨境传输审查
- 数据血缘、数据质量、治理责任与控制证据
- AI 训练、检索、日志和第三方模型的数据使用边界

将上述安全 Skill 直接绑定到隐私与数据治理岗位，容易把“没有发现代码漏洞”误写成“隐私合规或数据治理已经成立”。建议岗位 Skill 暂时留空；具体任务需要代码安全审查时，可由质量与安全工程师协作调用现有安全 Skill。

公开的 `agency-agents` 仓库有两个高相关 Agent 定义：[Data Privacy Officer](https://github.com/msitarzewski/agency-agents/blob/main/specialized/data-privacy-officer.md) 覆盖数据地图、DPIA、同意、数据主体请求、跨境传输与泄露响应；[Privacy Engineer](https://github.com/msitarzewski/agency-agents/blob/main/engineering/engineering-privacy-engineer.md) 更偏代码层的 PII、删除、保留和同意执行。二者仍不是标准 Skill，暂不直接接入。

## 来源与证据

### 一手 Skill 来源

- Jeff Allan, `rag-architect` 官方文档：<https://jeffallan.github.io/claude-skills/skills/data-ml/rag-architect/>
- Jeff Allan, `prompt-engineer` 官方文档：<https://jeffallan.github.io/claude-skills/skills/data-ml/prompt-engineer/>
- Jeff Allan 的公开 Skill 仓库：<https://github.com/Jeffallan/claude-skills>
- Matt Pocock 的公开 Skill 仓库（用于核验 `domain-modeling` 等通用工程 Skill 的来源边界）：<https://github.com/mattpocock/skills>
- msitarzewski 的公开 Agent 仓库：<https://github.com/msitarzewski/agency-agents>

2026-09-15 通过 GitHub API 核验时，`Jeffallan/claude-skills` 为 MIT、未归档，约 11,478 stars、1,104 forks，最近推送时间为 2026-08-07；`msitarzewski/agency-agents` 为 MIT、未归档，约 152,432 stars、24,570 forks，最近推送时间为 2026-09-12。stars 和 forks 只作为活跃度信号，不构成内容质量或安全保证。

### 本机安装证据

- `/Users/fan/.codex/skills/rag-architect/SKILL.md`
- `/Users/fan/.codex/skills/prompt-engineer/SKILL.md`
- `/Users/fan/.codex/skills/fine-tuning-expert/SKILL.md`
- `/Users/fan/.codex/skills/ml-pipeline/SKILL.md`
- `/Users/fan/.codex/skills/million-dollar-weekend-research/SKILL.md`
- `/Users/fan/.codex/skills/the-fool/SKILL.md`
- `/Users/fan/.codex/skills/secure-code-guardian/SKILL.md`
- `/Users/fan/.codex/skills/security-reviewer/SKILL.md`
- `/Users/fan/.codex/skills/project-security-scan/SKILL.md`

## 限制与待验证项

- “公开可找到”不等于“适合直接安装”。第三方 Skill 仍需在安装前审查许可证、提示注入风险、工具权限、依赖 Skill、写操作和与 Codex 的兼容性。
- 本报告只做候选研究，没有安装 Skill、创建岗位软链接或修改岗位规则。
- 用户研究、商业战略、隐私与数据治理三个方向仍可继续关注公开生态，但在出现高匹配且来源可审计的候选前，留空比错误接入更安全。

## 实施建议

1. AI 应用工程师接入 `rag-architect` 和 `prompt-engineer`。
2. 用户研究与体验研究可接入 `million-dollar-weekend-research`，并在岗位规则中标注其能力边界；若希望严格保持专项性，也可以先留空。
3. 商业战略与经营分析、隐私与数据治理暂不绑定 Skill。
4. 后续若要创建缺失 Skill，优先分别补齐 `ux-research`、`business-strategy`、`privacy-data-governance` 三个专项能力，而不是复用名称相近但职责不同的 Skill。
