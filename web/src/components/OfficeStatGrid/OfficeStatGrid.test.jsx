import { fireEvent, render, screen } from '@cedarjs/testing/web'

import OfficeStatGrid from './OfficeStatGrid'

const stats = { total: 27, working: 3, waiting: 2, idle: 22 }

describe('OfficeStatGrid', () => {
  it('渲染四个状态按钮并展示真实计数', () => {
    const { container } = render(
      <OfficeStatGrid stats={stats} active="all" onSelect={jest.fn()} />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons.map((button) => button.textContent)).toEqual([
      '员工总数27',
      '工作中3',
      '待确认2',
      '空闲22',
    ])
    expect(
      container.querySelector('.office-stat-grid button.working strong')
    ).toHaveTextContent('3')
    expect(
      container.querySelector('.office-stat-grid button.waiting strong')
    ).toHaveTextContent('2')
    expect(
      container.querySelector('.office-stat-grid button.idle strong')
    ).toHaveTextContent('22')
  })

  it('点击任一状态时回调对应 key', () => {
    const onSelect = jest.fn()
    render(<OfficeStatGrid stats={stats} active="all" onSelect={onSelect} />)

    fireEvent.click(
      screen.getByRole('button', { name: /筛选工作中员工，共 3 人/ })
    )
    fireEvent.click(screen.getByRole('button', { name: /筛选待确认员工/ }))
    fireEvent.click(screen.getByRole('button', { name: /筛选空闲员工/ }))
    fireEvent.click(screen.getByRole('button', { name: /筛选全部员工/ }))

    expect(onSelect.mock.calls.map(([key]) => key)).toEqual([
      'working',
      'waiting',
      'idle',
      'all',
    ])
  })

  it('aria-pressed 与 active 高亮随 active 变化', () => {
    const { rerender } = render(
      <OfficeStatGrid stats={stats} active="all" onSelect={jest.fn()} />
    )

    expect(
      screen.getByRole('button', { name: /筛选全部员工/ })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /筛选工作中员工/ })
    ).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <OfficeStatGrid stats={stats} active="working" onSelect={jest.fn()} />
    )

    const workingButton = screen.getByRole('button', {
      name: /筛选工作中员工/,
    })
    expect(workingButton).toHaveAttribute('aria-pressed', 'true')
    expect(workingButton).toHaveClass('working', 'active')
    expect(
      screen.getByRole('button', { name: /筛选全部员工/ })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: /筛选全部员工/ })
    ).not.toHaveClass('active')
  })

  it('没有 onSelect 时点击不报错', () => {
    render(<OfficeStatGrid stats={stats} />)

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /筛选工作中员工/ }))
    ).not.toThrow()
  })
})
