import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  collectInstalledSkills,
  parseSkillDocument,
  type SkillScanConfig,
} from './installedSkills'

const makeSkill = (libraryRoot: string, name: string, frontmatter: string) => {
  const dir = path.join(libraryRoot, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), frontmatter)
  return dir
}

const makeConfig = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'))
  const config: SkillScanConfig = {
    libraryRoot: path.join(root, 'library'),
    codexRoot: path.join(root, 'codex'),
    dshRoot: path.join(root, 'dsh'),
  }
  fs.mkdirSync(config.libraryRoot, { recursive: true })
  fs.mkdirSync(config.codexRoot, { recursive: true })
  fs.mkdirSync(config.dshRoot, { recursive: true })
  return config
}

const deploy = (root: string, name: string) => {
  const source = path.join(path.dirname(root), 'library', name)
  fs.symlinkSync(source, path.join(root, name), 'dir')
}

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

  it('只扫描技能库，并标记 codex / dsh 的部署状态', () => {
    const config = makeConfig()

    makeSkill(
      config.libraryRoot,
      'alpha',
      '---\nname: alpha\ndescription: 甲\n---\n\n甲\n'
    )
    makeSkill(
      config.libraryRoot,
      'beta',
      '---\nname: beta\ndescription: 乙\n---\n\n乙\n'
    )
    makeSkill(
      config.libraryRoot,
      'gamma',
      '---\nname: gamma\ndescription: 丙\n---\n\n丙\n'
    )

    deploy(config.codexRoot, 'alpha')
    deploy(config.codexRoot, 'gamma')
    deploy(config.dshRoot, 'alpha')
    deploy(config.dshRoot, 'beta')

    const skills = collectInstalledSkills(config)
    const byName = Object.fromEntries(
      skills.map((skill) => [
        skill.name,
        [skill.codexEnabled, skill.dshEnabled],
      ])
    )

    expect(Object.keys(byName).sort()).toEqual(['alpha', 'beta', 'gamma'])
    expect(byName.alpha).toEqual([true, true])
    expect(byName.beta).toEqual([false, true])
    expect(byName.gamma).toEqual([true, false])
    expect(skills.every((skill) => skill.source === '技能库')).toBe(true)
  })

  it('跳过库里的 .git、.skills-manager 与非技能目录', () => {
    const config = makeConfig()

    makeSkill(config.libraryRoot, 'alpha', '---\nname: alpha\n---\n\n甲\n')
    fs.mkdirSync(path.join(config.libraryRoot, '.git'), { recursive: true })
    fs.mkdirSync(path.join(config.libraryRoot, '.skills-manager'), {
      recursive: true,
    })
    fs.mkdirSync(path.join(config.libraryRoot, 'not-a-skill'), {
      recursive: true,
    })
    fs.writeFileSync(path.join(config.libraryRoot, 'README.md'), '# library')

    const skills = collectInstalledSkills(config)

    expect(skills.map((skill) => skill.name)).toEqual(['alpha'])
  })

  it('只存在于目标目录、库内没有的技能不会出现', () => {
    const config = makeConfig()

    makeSkill(config.libraryRoot, 'alpha', '---\nname: alpha\n---\n\n甲\n')
    fs.mkdirSync(path.join(config.codexRoot, 'only-in-codex'), {
      recursive: true,
    })

    const skills = collectInstalledSkills(config)

    expect(skills.map((skill) => skill.name)).toEqual(['alpha'])
  })

  it('断链按未启用处理，不抛错', () => {
    const config = makeConfig()

    makeSkill(config.libraryRoot, 'alpha', '---\nname: alpha\n---\n\n甲\n')
    fs.symlinkSync(
      path.join(config.libraryRoot, 'does-not-exist'),
      path.join(config.dshRoot, 'alpha'),
      'dir'
    )

    const [alpha] = collectInstalledSkills(config)

    expect(alpha.codexEnabled).toBe(false)
    expect(alpha.dshEnabled).toBe(false)
  })

  it('库目录不存在时返回空数组', () => {
    const config = makeConfig()
    fs.rmSync(config.libraryRoot, { recursive: true, force: true })

    expect(collectInstalledSkills(config)).toEqual([])
  })
})
