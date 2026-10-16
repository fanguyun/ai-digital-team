import agentManifest from '../../../agents/manifest.json'

import {
  AGENT_SCENE_IDS,
  RAFIKI_SCENES,
  sceneForAgent,
  stripSceneBackground,
} from './rafikiScenes'

describe('rafiki scenes', () => {
  it('maps every current agent onto the twelve-scene set', () => {
    expect(Object.keys(AGENT_SCENE_IDS).sort()).toEqual(
      agentManifest.agents.map((agent) => agent.slug).sort()
    )
    expect(new Set(Object.values(AGENT_SCENE_IDS)).size).toBe(12)
    expect(Object.keys(RAFIKI_SCENES)).toEqual(
      expect.arrayContaining(Object.values(AGENT_SCENE_IDS))
    )
  })

  it('returns a local svg for a known agent', () => {
    expect(sceneForAgent('health-longevity-agent')).toEqual({
      id: 'training-at-home',
      title: '居家训练',
      src: '/illustrations/rafiki/training-at-home.svg',
    })
  })

  it('drops the light scene background but keeps the subject', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g id="background-complete"><rect/></g><g id="character-1"><path/></g></svg>`
    const result = stripSceneBackground(svg)
    expect(result).not.toContain('background-complete')
    expect(result).toContain('character-1')
  })
})
