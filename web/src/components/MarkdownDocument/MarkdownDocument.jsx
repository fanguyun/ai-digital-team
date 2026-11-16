import { useState } from 'react'

import { Segmented, Skeleton } from 'antd'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useQuery } from '@cedarjs/web'

const IMAGE_QUERY = gql`
  query TaskImageDataUrl($id: ID!) {
    taskImageDataUrl(id: $id)
  }
`

const IMAGE_PATH = /^\/images\/([0-9a-f-]{36})$/i

/** 编辑器里插入的图片用 /images/<id> 引用，渲染时换成 data URL */
const MarkdownImage = ({ src, alt, ...props }) => {
  const match = IMAGE_PATH.exec(String(src || ''))
  const { data, loading } = useQuery(IMAGE_QUERY, {
    variables: { id: match?.[1] },
    skip: !match,
    fetchPolicy: 'cache-first',
  })

  if (!match) return <img src={src} alt={alt} {...props} />
  if (loading)
    return <Skeleton.Image active style={{ width: 160, height: 100 }} />

  return <img src={data?.taskImageDataUrl} alt={alt} {...props} />
}

const components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
  img: ({ node: _node, ...props }) => <MarkdownImage {...props} />,
  table: ({ node: _node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
}

function MarkdownDocument({ content, toggle = true }) {
  const [mode, setMode] = useState('preview')
  const source = String(content || '')

  const preview = (
    <div className="markdown-document">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )

  if (!toggle) return preview

  return (
    <div className="md-viewer">
      <div className="md-toolbar">
        <Segmented
          size="small"
          value={mode}
          onChange={setMode}
          options={[
            { label: '预览', value: 'preview' },
            { label: '源码', value: 'source' },
          ]}
        />
      </div>
      {mode === 'source' ? <pre className="md-source">{source}</pre> : preview}
    </div>
  )
}

export default MarkdownDocument
