import {
  buildWorkflowPrompt,
  parseWorkflowOutput,
  RESEARCH_WORKFLOW,
  workflowInputsFor,
} from './workflowDefinition'

const source = {
  id: 'S1',
  title: '资料',
  url: 'https://example.com',
  date: '未知',
  accessedAt: '2026-11-24',
  excerpt: '原文',
  supports: '结论',
  type: 'fact',
}
describe('工作流交付协议', () => {
  it('首个模板固定六步，核验独立于成稿', () => {
    expect(RESEARCH_WORKFLOW.steps).toHaveLength(6)
    expect(RESEARCH_WORKFLOW.steps[3].agentSlug).not.toBe(
      RESEARCH_WORKFLOW.steps[2].agentSlug
    )
    expect(workflowInputsFor('verify')).toEqual(['brief', 'research', 'draft'])
  })
  it('不把普通结束语或缺失证据视为完成', () => {
    expect(() => parseWorkflowOutput('已完成', 'brief')).toThrow()
    expect(() =>
      parseWorkflowOutput('{"status":"OK","markdown":"报告"}', 'research')
    ).toThrow()
  })
  it('区分网页不可达与无命中', () => {
    expect(() =>
      parseWorkflowOutput(
        JSON.stringify({
          status: 'OK',
          markdown: '证据',
          sources: [source],
          webStatus: 'unavailable',
        }),
        'research'
      )
    ).toThrow('公开网页')
    expect(
      parseWorkflowOutput(
        JSON.stringify({
          status: 'OK',
          markdown: '证据',
          sources: [source],
          webStatus: 'empty',
        }),
        'research'
      ).status
    ).toBe('OK')
  })
  it('核验返工必须给出受支持的目标', () => {
    expect(() =>
      parseWorkflowOutput(
        '{"status":"OK","markdown":"不通过","verdict":"REWORK"}',
        'verify'
      )
    ).toThrow()
    expect(
      parseWorkflowOutput(
        '{"status":"OK","markdown":"补证据","verdict":"REWORK","retryFrom":"research"}',
        'verify'
      ).retryFrom
    ).toBe('research')
  })
  it('阻塞不能被当作成功，不接受重复证据编号', () => {
    expect(
      parseWorkflowOutput(
        '{"status":"BLOCKED","markdown":"网页不可达"}',
        'research'
      ).status
    ).toBe('BLOCKED')
    expect(() =>
      parseWorkflowOutput(
        JSON.stringify({
          status: 'OK',
          markdown: '证据',
          sources: [source, source],
          webStatus: 'ok',
        }),
        'research'
      )
    ).toThrow('编号重复')
  })
  it('明确只读、托管运行及不可信来源边界', () => {
    const prompt = buildWorkflowPrompt({
      input: {
        title: '主题',
        questions: '问题',
        audience: '团队',
        scope: '范围',
        materials: '',
        sourceMode: 'knowledge-web',
      },
      step: RESEARCH_WORKFLOW.steps[1],
      upstream: {},
    })
    expect(prompt).toContain('不修改文件')
    expect(prompt).toContain('不调用 task-runtime')
    expect(prompt).toContain('不可信参考资料')
  })
})
