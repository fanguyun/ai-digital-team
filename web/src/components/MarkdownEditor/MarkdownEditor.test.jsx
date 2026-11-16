import { fireEvent, render, screen } from '@cedarjs/testing/web'

import MarkdownEditor from './MarkdownEditor'

let mockRenderFailure = false
jest.mock('./MarkdownEditorCore', () => ({
  __esModule: true,
  default: ({ value = '', onChange }) => {
    if (mockRenderFailure) throw new Error('模拟组件加载失败')
    return (
      <textarea
        aria-label="已加载的编辑器"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    )
  },
}))

it('异步加载能够完成，并持续接收外层受控值', async () => {
  const onChange = jest.fn()
  const { rerender } = render(
    <MarkdownEditor value="加载前正文" onChange={onChange} />
  )
  expect(await screen.findByLabelText('已加载的编辑器')).toHaveValue(
    '加载前正文'
  )
  rerender(<MarkdownEditor value="加载后回填" onChange={onChange} />)
  expect(screen.getByLabelText('已加载的编辑器')).toHaveValue('加载后回填')
  fireEvent.change(screen.getByLabelText('已加载的编辑器'), {
    target: { value: '' },
  })
  expect(onChange).toHaveBeenLastCalledWith('')
})

it('失败后显示重试入口，重试继续使用最新受控正文', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    mockRenderFailure = true
    const { rerender } = render(<MarkdownEditor value="失败前正文" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('正文已保留')
    mockRenderFailure = false
    rerender(<MarkdownEditor value="失败期间回填" />)
    fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
    expect(await screen.findByLabelText('已加载的编辑器')).toHaveValue(
      '失败期间回填'
    )
  } finally {
    mockRenderFailure = false
    consoleError.mockRestore()
  }
})
