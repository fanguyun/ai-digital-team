import {
  normalizePublicationMarkdown,
  publicationPath,
  publicationPathAllowed,
  siyuanPublicationClient,
} from './siyuanPublication'

it('validates titles and directory boundaries without sibling-prefix escapes', () => {
  expect(publicationPath('/团队/AI产物/', '研究结论')).toBe(
    '/团队/AI产物/研究结论'
  )
  for (const title of ['', '..', 'a/b', 'a\\b', 'a\nb'])
    expect(() => publicationPath('/团队', title)).toThrow()
  expect(() => publicationPath('/团队/../其他', '报告')).toThrow()
  expect(publicationPathAllowed('/团队/AI/报告', ['团队/AI'])).toBe(true)
  expect(publicationPathAllowed('/团队/AI2/报告', ['团队/AI'])).toBe(false)
  expect(normalizePublicationMarkdown('正文  \r\n下一行\n')).toBe(
    '正文  \n下一行'
  )
  expect(normalizePublicationMarkdown('    代码  \n')).toBe('    代码  ')
})

it('uses fixed read/create/export endpoints, prevents redirects and excludes remote errors from output', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: [] })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: '20261123095000-abc1234' }))
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          data: { hPath: '/AI/报告', content: '# 正文' },
        })
      )
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: -1, msg: 'private-token-secret' }))
    )
  const client = siyuanPublicationClient({
    origin: 'http://nas.local:6806',
    token: 'private-token-secret',
    fetchImpl,
  })
  expect(await client.find('20261123095000-box1234', '/AI/报告')).toEqual([])
  expect(
    await client.create('20261123095000-box1234', '/AI/报告', '# 正文')
  ).toBe('20261123095000-abc1234')
  expect(await client.read('20261123095000-abc1234')).toMatchObject({
    markdown: '# 正文',
  })
  expect(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/api/filetree/getIDsByHPath',
    '/api/filetree/createDocWithMd',
    '/api/export/exportMdContent',
  ])
  expect(
    fetchImpl.mock.calls.every(([, input]) => input.redirect === 'error')
  ).toBe(true)
  expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
    id: '20261123095000-abc1234',
    addTitle: false,
    yfm: false,
    headingNumber: false,
    preserveTaskMarkers: true,
  })
  await expect(
    client.find('20261123095000-box1234', '/AI/报告')
  ).rejects.toThrow('思源请求未成功')
  await expect(
    client.find('20261123095000-box1234', '/AI/报告')
  ).rejects.not.toThrow('private-token-secret')
})

it('rejects oversized responses and malformed document IDs', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(new Response('x'.repeat(1024 * 1024 + 1)))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: ['../../bad'] }))
    )
  const client = siyuanPublicationClient({
    origin: 'http://nas.local',
    token: 'secret',
    fetchImpl,
  })
  await expect(client.read('20261123095000-abc1234')).rejects.toThrow(
    '思源请求未成功'
  )
  await expect(client.find('20261123095000-box1234', '/报告')).rejects.toThrow(
    '返回无效'
  )
})

it('renders both Markdown bodies through a fixed read-only endpoint and rejects empty or malformed output', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 0, data: { html: '<ul><li>正文</li></ul>' } })
      )
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: { html: '' } }))
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: 'invalid' }))
    )
  const client = siyuanPublicationClient({
    origin: 'http://nas.local',
    token: 'secret',
    fetchImpl,
  })
  expect(await client.render('- 正文')).toBe('<ul><li>正文</li></ul>')
  expect(fetchImpl).toHaveBeenCalledWith(
    'http://nas.local/api/lute/md2html',
    expect.objectContaining({
      body: JSON.stringify({ markdown: '- 正文' }),
      redirect: 'error',
    })
  )
  await expect(client.render('- 正文')).rejects.toThrow('格式核对不可用')
  await expect(client.render('- 正文')).rejects.toThrow('格式核对不可用')
})
