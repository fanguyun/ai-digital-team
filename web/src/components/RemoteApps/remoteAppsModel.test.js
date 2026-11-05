import {
  displayHost,
  hashColor,
  initialFor,
  isDataUrlIcon,
  isImageIcon,
  isValidUrl,
  normalizeUrlInput,
} from './remoteAppsModel'

describe('remoteAppsModel', () => {
  it('缺协议时补 https，危险协议返回空', () => {
    expect(normalizeUrlInput('192.168.31.150:5080')).toBe(
      'https://192.168.31.150:5080'
    )
    expect(normalizeUrlInput('http://a.local:8080/x')).toBe(
      'http://a.local:8080/x'
    )
    expect(normalizeUrlInput('javascript:alert(1)')).toBe('')
    expect(normalizeUrlInput('   ')).toBe('')
  })

  it('校验只放行 http/https 且能解析的地址', () => {
    expect(isValidUrl('example.com')).toBe(true)
    expect(isValidUrl('https://192.168.31.150:5080')).toBe(true)
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })

  it('区分图片图标与文字图标', () => {
    expect(isImageIcon('https://cdn.example.com/logo.png')).toBe(true)
    expect(isImageIcon('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isImageIcon('🖥')).toBe(false)
    expect(isImageIcon('')).toBe(false)
  })

  it('识别上传产生的 data URL', () => {
    expect(isDataUrlIcon('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isDataUrlIcon('data:image/webp;base64,UklGRg==')).toBe(true)
    expect(isDataUrlIcon('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(isDataUrlIcon('https://cdn.example.com/logo.png')).toBe(false)
  })

  it('无图标时用名称首字兜底', () => {
    expect(initialFor('pgAdmin')).toBe('P')
    expect(initialFor('思源笔记')).toBe('思')
    expect(initialFor('   ')).toBe('?')
  })

  it('同名颜色稳定，不同名一般不同', () => {
    expect(hashColor('思源笔记')).toBe(hashColor('思源笔记'))
    expect(hashColor('思源笔记')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('卡片显示域名+端口', () => {
    expect(displayHost('https://192.168.31.150:5080/login')).toBe(
      '192.168.31.150:5080'
    )
    expect(displayHost('not a url')).toBe('not a url')
  })
})
