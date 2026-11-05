import { db } from 'src/lib/db'

import {
  createRemoteApp,
  deleteRemoteApp,
  normalizeUrl,
  remoteApp,
  remoteApps,
  updateRemoteApp,
} from './remoteApps'

describe('remoteApps service', () => {
  beforeEach(async () => {
    await db.remoteApp.deleteMany()
  })

  it('creates and lists apps in creation order', async () => {
    const pgadmin = await createRemoteApp({
      input: { name: 'pgAdmin', url: 'http://192.168.31.150:5080', icon: '🖥' },
    })
    const siyuan = await createRemoteApp({
      input: { name: '思源笔记', url: '192.168.31.150:6806' },
    })

    expect(pgadmin).toMatchObject({
      name: 'pgAdmin',
      url: 'http://192.168.31.150:5080',
      icon: '🖥',
    })
    // 缺协议时补 https://
    expect(siyuan.url).toBe('https://192.168.31.150:6806')
    expect(siyuan.icon).toBe('')

    const listed = await remoteApps()
    expect(listed.map((app) => app.name)).toEqual(['pgAdmin', '思源笔记'])
  })

  it('rejects non-http protocols and empty names', async () => {
    await expect(
      createRemoteApp({
        input: { name: 'bad', url: 'javascript:alert(1)' },
      })
    ).rejects.toThrow('只支持 http 或 https')

    await expect(
      createRemoteApp({ input: { name: '   ', url: 'https://example.com' } })
    ).rejects.toThrow('应用名称不能为空')

    await expect(
      createRemoteApp({ input: { name: 'x', url: '' } })
    ).rejects.toThrow('应用链接不能为空')
  })

  it('updates only the provided fields', async () => {
    const created = await createRemoteApp({
      input: { name: '青龙', url: 'https://192.168.31.150:5777', icon: '🐳' },
    })

    const updated = await updateRemoteApp({
      id: created.id,
      input: { name: '青龙面板' },
    })

    expect(updated.name).toBe('青龙面板')
    expect(updated.url).toBe('https://192.168.31.150:5777')
    expect(updated.icon).toBe('🐳')
  })

  it('deletes an app and returns the removed record', async () => {
    const created = await createRemoteApp({
      input: { name: '临时', url: 'https://example.com' },
    })

    const removed = await deleteRemoteApp({ id: created.id })

    expect(removed.id).toBe(created.id)
    expect(await remoteApps()).toHaveLength(0)
    expect(await remoteApp({ id: created.id })).toBeNull()
  })

  it('normalizes urls consistently', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('  http://a.local:8080/path  ')).toBe(
      'http://a.local:8080/path'
    )
    expect(() => normalizeUrl('ftp://example.com')).toThrow(
      '只支持 http 或 https'
    )
  })
})

describe('remoteApps icon handling', () => {
  beforeEach(async () => {
    await db.remoteApp.deleteMany()
  })

  it('接受上传产生的图片 data URL', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

    const created = await createRemoteApp({
      input: { name: '图标上传', url: 'example.com', icon: dataUrl },
    })

    expect(created.icon).toBe(dataUrl)
  })

  it('拒绝非图片的 data URL 和超长文字图标', async () => {
    await expect(
      createRemoteApp({
        input: {
          name: 'x',
          url: 'example.com',
          icon: 'data:text/html;base64,PHNjcmlwdD4=',
        },
      })
    ).rejects.toThrow('只支持 png / jpeg / webp / gif')

    await expect(
      createRemoteApp({
        input: { name: 'x', url: 'example.com', icon: '很长的文字'.repeat(5) },
      })
    ).rejects.toThrow('文字图标不能超过')
  })
})
