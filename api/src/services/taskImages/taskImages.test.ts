import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

import { db } from 'src/lib/db'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'

import {
  imageIdsFromMarkdown,
  resolveTaskImages,
  taskImageDataUrl,
  uploadTaskImage,
} from './taskImages'

const PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const created: string[] = []

describe('taskImages', () => {
  beforeEach(async () => {
    await db.taskImage.deleteMany()
    created.length = 0
  })

  afterAll(() => {
    for (const file of created) {
      if (existsSync(file)) rmSync(file, { force: true })
    }
  })

  it('extracts image ids from markdown', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(
      imageIdsFromMarkdown(`看这个 ![截图](/images/${id}) 和别的`)
    ).toEqual([id])
    expect(imageIdsFromMarkdown('没有图片')).toEqual([])
  })

  it('stores an uploaded image and reads it back as data URL', async () => {
    const row = await uploadTaskImage({
      input: { dataUrl: PNG_BASE64, name: '登录页截图.png' },
    })

    expect(row.url).toBe(`/images/${row.id}`)
    expect(row.path).toMatch(/^docs\/tasks\/uploads\/\d{8}\/.+\.png$/)
    created.push(path.join(resolveRepoRoot(), row.path))

    const dataUrl = await taskImageDataUrl({ id: row.id })
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejects non-image input', async () => {
    await expect(
      uploadTaskImage({
        input: { dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' },
      })
    ).rejects.toThrow('只支持 png')
  })

  it('resolves markdown images to absolute paths for dispatch', async () => {
    const row = await uploadTaskImage({ input: { dataUrl: PNG_BASE64 } })
    created.push(path.join(resolveRepoRoot(), row.path))

    const paths = await resolveTaskImages(`![x](/images/${row.id})`)
    expect(paths).toHaveLength(1)
    expect(paths[0].startsWith(resolveRepoRoot())).toBe(true)
  })
})
