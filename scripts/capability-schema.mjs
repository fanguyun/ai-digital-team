const supportedPlatforms = ['codex', 'deepseek-harness']

function findDuplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function validateCapabilityRequirements(requirements) {
  const issues = []
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    return ['capabilityRequirements 必须是对象']
  }

  for (const field of ['requiredSkills', 'optionalSkills', 'requiredTools', 'platforms']) {
    if (!Array.isArray(requirements[field])) {
      issues.push(`${field} 必须是数组`)
      continue
    }
    if (requirements[field].some((value) => typeof value !== 'string' || value.trim() === '')) {
      issues.push(`${field} 必须只包含非空字符串`)
    }
    const duplicates = findDuplicates(requirements[field])
    if (duplicates.length > 0) issues.push(`${field} 存在重复项: ${duplicates.join(', ')}`)
  }

  const required = new Set(requirements.requiredSkills || [])
  const overlap = (requirements.optionalSkills || []).filter((skill) => required.has(skill))
  if (overlap.length > 0) {
    issues.push(`Skill 不能同时声明为必需和可选: ${overlap.join(', ')}`)
  }
  for (const platform of requirements.platforms || []) {
    if (!supportedPlatforms.includes(platform)) issues.push(`不支持的平台: ${platform}`)
  }
  if (requirements.assessment !== undefined && typeof requirements.assessment !== 'string') {
    issues.push('assessment 必须是字符串')
  }
  return issues
}

export { supportedPlatforms }
