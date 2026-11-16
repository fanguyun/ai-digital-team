import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import MDEditor, {
  commands as mdCommands,
} from '@uiw/react-md-editor/nohighlight'
import { Button, Segmented, message } from 'antd'
import { ImagePlus, Maximize2, Minimize2, Type } from 'lucide-react'
import { createPortal } from 'react-dom'

import { useMutation } from '@cedarjs/web'

import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'
import { useTheme } from 'src/theme'

const UPLOAD_IMAGE = gql`
  mutation UploadTaskImage($input: UploadTaskImageInput!) {
    uploadTaskImage(input: $input) {
      id
      label
    }
  }
`

const ACTIONS = [
  [mdCommands.heading2, '标题'],
  [mdCommands.bold, '粗体'],
  [mdCommands.italic, '斜体'],
  [mdCommands.unorderedListCommand, '列表'],
  [mdCommands.checkedListCommand, '任务列表'],
  [mdCommands.quote, '引用'],
  [mdCommands.code, '行内代码'],
  [mdCommands.codeBlock, '代码块'],
  [mdCommands.link, '链接'],
  [mdCommands.hr, '分隔线'],
]
const NO_COMMANDS = []
const LINE_HEIGHT = 22
const TEXT_PADDING = 20

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })

const renderPreview = (source) =>
  source.trim() ? (
    <MarkdownDocument content={source} toggle={false} />
  ) : (
    <p className="md-editor-empty">还没有内容</p>
  )
const PREVIEW_COMPONENTS = { preview: renderPreview }

const MarkdownEditorCore = ({
  value = '',
  onChange,
  placeholder,
  minRows = 4,
  maxRows = 12,
  disabled = false,
  id,
  ...formProps
}) => {
  const { theme } = useTheme()
  const [mode, setMode] = useState('edit')
  const [fullscreen, setFullscreen] = useState(false)
  const [wide, setWide] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [height, setHeight] = useState(minRows * LINE_HEIGHT + TEXT_PADDING)
  const [host] = useState(() => document.createElement('div'))
  const anchorRef = useRef(null)
  const rootRef = useRef(null)
  const editorRef = useRef(null)
  const fileRef = useRef(null)
  const selectionRef = useRef(null)
  const activeRef = useRef(false)
  const uploadingRef = useRef(false)
  const uploadGeneration = useRef(0)
  const modeBeforeFullscreen = useRef('edit')
  const latest = useRef({ value, onChange, disabled })
  latest.current = { value: String(value || ''), onChange, disabled }
  const [uploadImage] = useMutation(UPLOAD_IMAGE)
  const preview = mode === 'live' && !wide ? 'edit' : mode

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      uploadGeneration.current += 1
    }
  }, [])

  useLayoutEffect(() => {
    if (disabled) uploadGeneration.current += 1
  }, [disabled])

  // Keep the editor mounted; use state-preserving moves when supported.
  useLayoutEffect(() => {
    const textarea = editorRef.current?.textarea
    const focused = document.activeElement
    const selection = textarea && {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    }
    const parent = fullscreen ? document.body : anchorRef.current
    if (host.isConnected && typeof parent.moveBefore === 'function') {
      parent.moveBefore(host, null)
    } else {
      parent.appendChild(host)
    }
    if (focused && host.contains(focused)) {
      focused.focus({ preventScroll: true })
      if (selection) textarea.setSelectionRange(selection.start, selection.end)
    }
  }, [host, fullscreen])

  useLayoutEffect(() => () => host.remove(), [host])

  useEffect(() => {
    if (!fullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [fullscreen])

  useLayoutEffect(() => {
    const measure = () => {
      const width = rootRef.current?.getBoundingClientRect().width || 0
      const next = width >= 768
      setWide(next)
      if (!next) setMode((current) => (current === 'live' ? 'edit' : current))
    }
    measure()
    const frame = window.requestAnimationFrame(measure)
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(rootRef.current)
    window.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [fullscreen])

  useLayoutEffect(() => {
    const minimum = Math.max(1, minRows) * LINE_HEIGHT + TEXT_PADDING
    const maximum = Math.max(minRows, maxRows) * LINE_HEIGHT + TEXT_PADDING
    const measure = () => {
      const textarea = editorRef.current?.textarea
      if (!textarea) return
      const previous = textarea.style.height
      textarea.style.height = '0px'
      const contentHeight = textarea.scrollHeight
      textarea.style.height = previous
      setHeight(Math.min(maximum, Math.max(minimum, contentHeight)))
    }
    measure()
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (editorRef.current?.container)
      observer?.observe(editorRef.current.container)
    return () => observer?.disconnect()
  }, [value, minRows, maxRows, preview, fullscreen])

  const rememberSelection = () => {
    const state = editorRef.current?.commandOrchestrator?.getState()
    if (state) selectionRef.current = state.selection
  }

  const toggleFullscreen = () => {
    rememberSelection()
    if (fullscreen) setMode(modeBeforeFullscreen.current)
    else modeBeforeFullscreen.current = mode
    setFullscreen((current) => !current)
  }

  const changeValue = (next) => {
    if (latest.current.disabled) return
    const text = String(next ?? '')
    latest.current = { ...latest.current, value: text }
    latest.current.onChange?.(text)
  }

  const execute = (command) => {
    if (latest.current.disabled || preview === 'preview') return
    const editor = editorRef.current
    editor?.commandOrchestrator?.executeCommand(command)
    const next = editor?.textarea?.value
    // uiw's native fallback does not always trigger React's onChange (jsdom).
    if (next !== undefined && next !== latest.current.value) changeValue(next)
    rememberSelection()
  }

  const commands = useMemo(
    () =>
      ACTIONS.map(([command, label]) => ({
        ...command,
        icon:
          command === mdCommands.heading2 ? <Type size={14} /> : command.icon,
        buttonProps: { title: label, 'aria-label': label },
        execute: (...args) => {
          if (!latest.current.disabled) command.execute(...args)
        },
      })),
    []
  )

  const uploadAndInsert = async (file) => {
    if (
      !file ||
      latest.current.disabled ||
      uploadingRef.current ||
      preview === 'preview'
    )
      return
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)) {
      message.error('只支持 PNG、JPEG、WebP、GIF 图片')
      return
    }
    if (!file.size || file.size > 4 * 1024 * 1024) {
      message.error(file.size ? '图片不能超过 4MB' : '图片内容为空')
      return
    }
    uploadingRef.current = true
    setUploading(true)
    const generation = uploadGeneration.current
    const canInsert = () =>
      activeRef.current &&
      !latest.current.disabled &&
      generation === uploadGeneration.current
    try {
      const dataUrl = await readAsDataUrl(file)
      if (!canInsert()) return
      const { data } = await uploadImage({
        variables: { input: { dataUrl, name: file.name || '图片' } },
      })
      if (!canInsert()) return
      const imageId = data?.uploadTaskImage?.id
      if (!imageId) throw new Error('上传失败')
      const label = (file.name || '图片').replace(/[\\[\]\r\n]/g, ' ')
      const snippet = `![${label}](/images/${imageId})`
      const editor = editorRef.current
      const state = editor?.commandOrchestrator?.getState()
      if (state && editor.textarea?.isConnected) {
        // Read the current textarea, never the value captured before upload.
        execute({ execute: (_state, api) => api.replaceSelection(snippet) })
      } else {
        const text = latest.current.value
        const start = Math.min(
          selectionRef.current?.start ?? text.length,
          text.length
        )
        const end = Math.min(selectionRef.current?.end ?? start, text.length)
        changeValue(`${text.slice(0, start)}${snippet}${text.slice(end)}`)
      }
      message.success('图片已插入，派发时会作为附件传给 agent')
    } catch (error) {
      if (canInsert()) message.error(error.message || '图片上传失败')
    } finally {
      uploadingRef.current = false
      if (activeRef.current) setUploading(false)
    }
  }

  const onPaste = (event) => {
    if (latest.current.disabled) return
    const item = [...(event.clipboardData?.items || [])].find((entry) =>
      entry.type.startsWith('image/')
    )
    const file = item?.getAsFile()
    if (!file) return
    event.preventDefault()
    void uploadAndInsert(file)
  }

  const onKeyDownCapture = (event) => {
    // uiw installs native key handlers; protect IME composition before they run.
    if (
      event.target.tagName === 'TEXTAREA' &&
      (disabled || event.nativeEvent.isComposing || event.keyCode === 229)
    ) {
      event.stopPropagation()
    }
    if (!fullscreen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      toggleFullscreen()
    }
    if (event.key === 'Tab') {
      const controls = [
        ...rootRef.current.querySelectorAll(
          'button:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        ),
      ]
      const first = controls[0]
      const last = controls.at(-1)
      if (
        (event.shiftKey && event.target === first) ||
        (!event.shiftKey && event.target === last)
      ) {
        event.preventDefault()
        event.stopPropagation()
        const target = event.shiftKey ? last : first
        target?.focus()
      }
    }
  }

  return (
    <>
      <div ref={anchorRef} className="md-editor-anchor" />
      {createPortal(
        <div
          ref={rootRef}
          className={`md-editor${disabled ? ' is-disabled' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
          data-color-mode={theme}
          role={fullscreen ? 'dialog' : undefined}
          aria-modal={fullscreen || undefined}
          aria-label={fullscreen ? 'Markdown 全屏编辑器' : undefined}
          onKeyDownCapture={onKeyDownCapture}
        >
          <div className="md-editor-toolbar">
            <div className="md-editor-actions">
              {commands.map((command) => (
                <Button
                  key={command.name}
                  size="small"
                  type="text"
                  {...command.buttonProps}
                  disabled={disabled || preview === 'preview'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => execute(command)}
                  icon={command.icon}
                />
              ))}
              <Button
                size="small"
                type="text"
                title="插入图片"
                aria-label="插入图片"
                loading={uploading}
                disabled={disabled || preview === 'preview'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  rememberSelection()
                  fileRef.current?.click()
                }}
                icon={<ImagePlus size={14} />}
              />
              <input
                ref={fileRef}
                type="file"
                aria-label="选择图片"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={disabled}
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void uploadAndInsert(file)
                }}
              />
            </div>
            <div className="md-editor-modes">
              <Segmented
                size="small"
                value={preview}
                onChange={(next) => {
                  rememberSelection()
                  setMode(next)
                }}
                options={[
                  { label: '编辑', value: 'edit' },
                  ...(wide ? [{ label: '分栏', value: 'live' }] : []),
                  { label: '预览', value: 'preview' },
                ]}
              />
              <Button
                size="small"
                type="text"
                title={fullscreen ? '退出全屏' : '全屏编辑'}
                aria-label={fullscreen ? '退出全屏' : '全屏编辑'}
                onClick={toggleFullscreen}
                icon={
                  fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />
                }
              />
            </div>
          </div>
          <MDEditor
            ref={editorRef}
            value={String(value || '')}
            onChange={changeValue}
            preview={preview}
            commands={commands}
            extraCommands={NO_COMMANDS}
            components={PREVIEW_COMPONENTS}
            height={fullscreen ? '100%' : height}
            minHeight={0}
            hideToolbar
            visibleDragbar={false}
            highlightEnable={false}
            overflow={false}
            disabled={disabled}
            defaultTabEnable
            data-color-mode={theme}
            textareaProps={{
              id,
              'aria-label': 'Markdown 正文',
              ...formProps,
              placeholder:
                placeholder ||
                '支持 Markdown：**粗体**、- 列表、> 引用、`代码`',
              onSelect: rememberSelection,
              onPaste,
            }}
          />
        </div>,
        host
      )}
    </>
  )
}

export default MarkdownEditorCore
