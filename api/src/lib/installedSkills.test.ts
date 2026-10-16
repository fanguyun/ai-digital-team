import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { collectInstalledSkills, parseSkillDocument } from './installedSkills'

describe('installed skills', () => {
  it('reads name, description, and tags from skill frontmatter', () => {
    const parsed = parseSkillDocument(`---
name: demo-skill
description: 用于演示
tags:
  - 设计
  - 写作
---

# 正文
这里是详情。
`)

    expect(parsed).toMatchObject({
      name: 'demo-skill',
      description: '用于演示',
      tags: ['设计', '写作'],
      body: '# 正文\n这里是详情。',
    })
  })

  it('lists skills by source and skips system skills inside the user root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'))
    const userDir = path.join(root, 'skills', 'travel')
    const systemDir = path.join(root, 'skills', '.system', 'imagegen')
    const pluginDir = path.join(root, 'plugins', 'cache', 'demo', 'skills', 'shadcn')
    fs.mkdirSync(userDir, { recursive: true })
    fs.mkdirSync(systemDir, { recursive: true })
    fs.mkdirSync(pluginDir, { recursive: true })
    fs.writeFileSync(
      path.join(userDir, 'SKILL.md'),
      '---\nname: travel\ndescription: 旅行\ntags: [出行]\n---\n\n旅行详情\n'
    )
    fs.writeFileSync(
      path.join(systemDir, 'SKILL.md'),
      '---\nname: imagegen\ndescription: 图像\n---\n\n系统详情\n'
    )
    fs.writeFileSync(
      path.join(pluginDir, 'SKILL.md'),
      '---\nname: shadcn\ndescription: 组件\ntags: [界面]\n---\n\n插件详情\n'
    )

    const skills = collectInstalledSkills([
      { source: '用户', dir: path.join(root, 'skills') },
      { source: '插件', dir: path.join(root, 'plugins', 'cache') },
      { source: '系统', dir: path.join(root, 'skills', '.system') },
    ])

    expect(skills.map((skill) => [skill.name, skill.source, skill.tags])).toEqual([
      ['imagegen', '系统', ['未标记']],
      ['shadcn', '插件', ['界面']],
      ['travel', '用户', ['出行']],
    ])
  })
})
