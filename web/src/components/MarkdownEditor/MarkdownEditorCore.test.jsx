import { useState } from 'react'

import { Form } from 'antd'

import { act, fireEvent, render, screen, waitFor } from '@cedarjs/testing/web'
import { useMutation } from '@cedarjs/web'

import MarkdownEditorCore from './MarkdownEditorCore'

// The editor uses our renderer, not uiw's ESM-only default preview. Keep the
// actual uiw textarea, command API and native event handlers in these tests.
jest.mock('@uiw/react-markdown-preview/nohighlight', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('src/components/MarkdownDocument/MarkdownDocument', () => ({
  __esModule: true,
  default: ({ content, toggle }) => (
    <div data-testid="project-preview" data-toggle={String(toggle)}>
      {content}
    </div>
  ),
}))
jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useMutation: jest.fn(),
}))

const IMAGE_ID = '01234567-89ab-4cde-8fab-0123456789ab'
const upload = jest.fn()
const originalMessageChannel = global.MessageChannel
const originalMatchMedia = window.matchMedia
beforeAll(() => {
  global.MessageChannel = class {
    port1 = { onmessage: null }
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }
  }
  window.matchMedia = jest.fn((media) => ({
    matches: false,
    media,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }))
})
afterAll(() => {
  global.MessageChannel = originalMessageChannel
  window.matchMedia = originalMatchMedia
})
const Editor = ({ initial = '', ...props }) => {
  const [value, setValue] = useState(initial)
  return <MarkdownEditorCore value={value} onChange={setValue} {...props} />
}
const area = () => screen.getByRole('textbox', { name: 'Markdown 正文' })
const chooseImage = (
  file = new File(['image'], '截图.png', { type: 'image/png' })
) =>
  fireEvent.change(screen.getByLabelText('选择图片'), {
    target: { files: [file] },
  })

beforeEach(() => {
  jest.clearAllMocks()
  useMutation.mockReturnValue([upload])
  upload.mockResolvedValue({ data: { uploadTaskImage: { id: IMAGE_ID } } })
})

it('兼容 Ant Form 回填、连续输入、清空和外部重置', () => {
  let form
  const FormEditor = () => {
    const [instance] = Form.useForm()
    form = instance
    return (
      <Form form={form} initialValues={{ brief: '初始正文' }}>
        <Form.Item name="brief">
          <MarkdownEditorCore />
        </Form.Item>
      </Form>
    )
  }
  render(<FormEditor />)
  expect(area()).toHaveValue('初始正文')
  fireEvent.change(area(), { target: { value: '中文输入' } })
  fireEvent.change(area(), { target: { value: '中文输入，继续' } })
  expect(form.getFieldValue('brief')).toBe('中文输入，继续')
  fireEvent.change(area(), { target: { value: '' } })
  expect(form.getFieldValue('brief')).toBe('')
  act(() => form.setFieldsValue({ brief: '外部回填' }))
  expect(area()).toHaveValue('外部回填')
  act(() => form.resetFields())
  expect(area()).toHaveValue('初始正文')
})

it('使用 uiw 选区命令插入格式，预览使用项目渲染器且正文不丢失', () => {
  render(<Editor initial="选择文字" />)
  area().setSelectionRange(0, 4)
  fireEvent.click(screen.getByRole('button', { name: '粗体' }))
  expect(area()).toHaveValue('**选择文字**')
  fireEvent.click(screen.getByText('预览', { exact: true }))
  expect(screen.getByTestId('project-preview')).toHaveTextContent(
    '**选择文字**'
  )
  expect(screen.getByTestId('project-preview')).toHaveAttribute(
    'data-toggle',
    'false'
  )
  fireEvent.click(screen.getByText('编辑', { exact: true }))
  expect(area()).toHaveValue('**选择文字**')
})

it('禁用状态阻止工具栏、文字、图片和快捷键修改，但允许预览', () => {
  const onChange = jest.fn()
  render(<MarkdownEditorCore value="只读正文" disabled onChange={onChange} />)
  expect(area()).toBeDisabled()
  expect(screen.getByRole('button', { name: '粗体' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '插入图片' })).toBeDisabled()
  fireEvent.change(area(), { target: { value: '不应保存' } })
  fireEvent.keyDown(area(), { key: 'b', ctrlKey: true })
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('预览', { exact: true }))
  expect(screen.getByTestId('project-preview')).toHaveTextContent('只读正文')
})

it('输入法组合期间不执行 Markdown 快捷键', () => {
  render(<Editor initial="中文" />)
  area().setSelectionRange(0, 2)
  fireEvent.keyDown(area(), { key: 'b', ctrlKey: true, isComposing: true })
  expect(area()).toHaveValue('中文')
})

it('全屏移动同一个 textarea，退出恢复模式、正文、选区和 body 滚动设置', () => {
  document.body.style.overflow = 'clip'
  const { unmount } = render(<Editor initial="全屏正文" />)
  const input = area()
  input.focus()
  input.setSelectionRange(1, 3)
  fireEvent.click(screen.getByRole('button', { name: '全屏编辑' }))
  expect(area()).toBe(input)
  expect(input.selectionStart).toBe(1)
  expect(input.selectionEnd).toBe(3)
  expect(document.body).toHaveStyle({ overflow: 'hidden' })
  expect(screen.getByRole('dialog').parentElement.parentElement).toBe(
    document.body
  )
  fireEvent.click(screen.getByText('预览', { exact: true }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(area()).toHaveValue('全屏正文')
  expect(document.body).toHaveStyle({ overflow: 'clip' })
  fireEvent.click(screen.getByRole('button', { name: '全屏编辑' }))
  unmount()
  expect(document.body).toHaveStyle({ overflow: 'clip' })
  document.body.style.overflow = ''
})

it('容器变窄时隐藏分栏并回到编辑模式', () => {
  const bounds = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: 900 })
  render(<Editor initial="分栏正文" />)
  fireEvent.click(screen.getByText('分栏', { exact: true }))
  expect(screen.getByTestId('project-preview')).toHaveTextContent('分栏正文')
  bounds.mockReturnValue({ width: 600 })
  fireEvent(window, new Event('resize'))
  expect(screen.queryByText('分栏', { exact: true })).not.toBeInTheDocument()
  expect(area()).toHaveValue('分栏正文')
  expect(screen.queryByTestId('project-preview')).not.toBeInTheDocument()
  bounds.mockRestore()
})

it('上传完成在最新正文选区插入图片，不覆盖上传期间输入', async () => {
  let finish
  upload.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  render(<Editor initial="开始" />)
  chooseImage()
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
  fireEvent.change(area(), { target: { value: '开始，继续输入' } })
  area().setSelectionRange(7, 7)
  await act(async () => finish({ data: { uploadTaskImage: { id: IMAGE_ID } } }))
  expect(area()).toHaveValue(`开始，继续输入![截图.png](/images/${IMAGE_ID})`)
  expect(upload.mock.calls[0][0].variables.input.dataUrl).toMatch(
    /^data:image\/png;base64,/
  )
})

it('粘贴图片沿用上传链路，普通文本粘贴不被接管', async () => {
  render(<Editor />)
  const textPaste = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(textPaste, 'clipboardData', { value: { items: [] } })
  fireEvent(area(), textPaste)
  expect(textPaste.defaultPrevented).toBe(false)
  const file = new File(['image'], '粘贴.png', { type: 'image/png' })
  fireEvent.paste(area(), {
    clipboardData: { items: [{ type: file.type, getAsFile: () => file }] },
  })
  await waitFor(() => expect(area().value).toContain(`/images/${IMAGE_ID}`))
})

it('上传失败、超限或格式不支持时保留正文', async () => {
  upload.mockRejectedValue(new Error('服务暂不可用'))
  render(<Editor initial="已有正文" />)
  chooseImage(new File(['x'], '不支持.svg', { type: 'image/svg+xml' }))
  expect(upload).not.toHaveBeenCalled()
  chooseImage(
    new File([new Uint8Array(4 * 1024 * 1024 + 1)], '大图.png', {
      type: 'image/png',
    })
  )
  expect(upload).not.toHaveBeenCalled()
  chooseImage()
  await waitFor(() =>
    expect(screen.getByText('服务暂不可用')).toBeInTheDocument()
  )
  expect(area()).toHaveValue('已有正文')
})

it.each(['disabled', 'unmount', 'reEnabled'])(
  '上传等待期间 %s 后不回写正文',
  async (action) => {
    let finish
    const onChange = jest.fn()
    upload.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const { rerender, unmount } = render(
      <MarkdownEditorCore value="保留" onChange={onChange} />
    )
    chooseImage()
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    if (action !== 'unmount') {
      rerender(<MarkdownEditorCore value="保留" onChange={onChange} disabled />)
      if (action === 'reEnabled') {
        rerender(<MarkdownEditorCore value="保留" onChange={onChange} />)
      }
    } else unmount()
    await act(async () =>
      finish({ data: { uploadTaskImage: { id: IMAGE_ID } } })
    )
    expect(onChange).not.toHaveBeenCalled()
  }
)
