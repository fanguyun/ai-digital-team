import { UserInputError } from '@cedarjs/graphql-server'

import {
  collectInstalledSkills,
  updateSkillDirectory,
} from 'src/lib/installedSkills'

const listSkills = () => collectInstalledSkills()

export const installedSkills = () => listSkills()

export const updateInstalledSkill = async ({ id }: { id: string }) => {
  const current = listSkills().find((skill) => skill.id === id)
  if (!current) throw new UserInputError('技能不存在')
  const message = await updateSkillDirectory(current)
  const refreshed = listSkills().find((skill) => skill.id === id) || current
  return { skill: refreshed, message }
}
