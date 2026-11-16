import { Component, lazy, Suspense } from 'react'

import { Button, Skeleton } from 'antd'

const loadEditor = () => import('./MarkdownEditorCore')
const InitialEditor = lazy(loadEditor)

class EditorBoundary extends Component {
  state = { failed: false, Editor: InitialEditor }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="md-editor-status" role="alert">
          编辑器加载失败，正文已保留。
          <Button
            size="small"
            onClick={() =>
              this.setState({ failed: false, Editor: lazy(loadEditor) })
            }
          >
            重试加载
          </Button>
        </div>
      )
    }
    const Editor = this.state.Editor
    return <Editor {...this.props} />
  }
}

const MarkdownEditor = (props) => (
  <Suspense
    fallback={
      <div className="md-editor-status" role="status" aria-label="编辑器加载中">
        <Skeleton.Input active block size="small" />
      </div>
    }
  >
    <EditorBoundary {...props} />
  </Suspense>
)

export default MarkdownEditor
