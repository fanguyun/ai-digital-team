import { useMemo } from 'react'

import { tokenizeLine } from './artifactTree'

/**
 * 轻量代码预览：行号 + 关键字/字符串/注释着色。
 * 不引入编辑器依赖，长文件只渲染纯 <pre>，够读代码即可。
 */
const CodePreview = ({ content = '', language = 'ts', maxHeight = '68vh' }) => {
  const lines = useMemo(() => content.split('\n'), [content])
  const rendered = useMemo(
    () =>
      lines.map((line, index) => ({
        number: index + 1,
        tokens: tokenizeLine(line, language),
      })),
    [lines, language]
  )

  return (
    <div className="code-preview" style={{ maxHeight }}>
      <pre>
        <code>
          {rendered.map((line) => (
            <span className="code-preview-line" key={line.number}>
              <span className="code-preview-gutter">{line.number}</span>
              <span className="code-preview-code">
                {line.tokens.map((token, index) => (
                  <span
                    className={`code-token ${token.type}`}
                    key={`${line.number}-${index}`}
                  >
                    {token.text}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

export default CodePreview
