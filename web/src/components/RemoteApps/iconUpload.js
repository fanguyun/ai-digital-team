/** 把用户选择的图片压成 96px 的 data URL，避免把几 MB 的原图塞进数据库 */

export const ICON_SIZE = 96
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = /^image\/(png|jpeg|jpg|webp|gif)$/i

export const resizeImageToDataUrl = (file, size = ICON_SIZE) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('没有拿到文件'))
      return
    }
    if (!ALLOWED_TYPES.test(file.type || '')) {
      reject(new Error('只支持 png / jpeg / webp / gif 图片'))
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('图片不能超过 2MB'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('图片解析失败'))
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('当前浏览器无法处理图片'))
          return
        }

        const scale = Math.min(size / image.width, size / image.height)
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))

        context.clearRect(0, 0, size, size)
        context.drawImage(
          image,
          Math.round((size - width) / 2),
          Math.round((size - height) / 2),
          width,
          height
        )
        resolve(canvas.toDataURL('image/png'))
      }
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
