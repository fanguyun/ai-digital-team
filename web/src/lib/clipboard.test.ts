import { copyText } from './clipboard'

describe('copyText', () => {
  const originalClipboard = navigator.clipboard
  const originalExecCommand = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
    document.execCommand = originalExecCommand
  })

  it('uses the clipboard API when it works', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    await expect(copyText('$main-agent')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('$main-agent')
  })

  it('falls back to execCommand when the clipboard API rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    document.execCommand = jest.fn().mockReturnValue(true)

    await expect(copyText('$main-agent')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('reports failure when both paths fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    document.execCommand = jest.fn().mockReturnValue(false)

    await expect(copyText('$main-agent')).resolves.toBe(false)
  })
})
