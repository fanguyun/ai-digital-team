import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'

const decompressZstdFrame = promisify(zstdDecompress)

const ZSTD_FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/**
 * DeepSeek Harness 的会话日志是「追加写」的 zstd 文件：每轮写入一个新 frame，
 * 因此文件里是多个连续 frame。`zstdDecompressSync` 只解第一个 frame，必须按
 * magic 切开逐帧解压才能读到完整会话。
 */
const frameOffsets = (compressed: Buffer) => {
  const offsets: number[] = []
  let offset = 0
  while ((offset = compressed.indexOf(ZSTD_FRAME_MAGIC, offset)) >= 0) {
    offsets.push(offset)
    offset += ZSTD_FRAME_MAGIC.length
  }
  return offsets
}

/** 读取多帧 zstd 会话日志的完整文本 */
export const readZstdText = async (path: string) => {
  const compressed = await readFile(path)
  const offsets = frameOffsets(compressed)
  if (offsets[0] !== 0) throw new Error('Invalid Zstd session log')

  let text = ''
  for (let index = 0; index < offsets.length; index += 1) {
    const frame = compressed.subarray(
      offsets[index],
      offsets[index + 1] ?? compressed.length
    )
    text += (await decompressZstdFrame(frame)).toString('utf8')
  }
  return text
}

/** 逐行读取多帧 zstd 会话日志（不把整份文件拼成一个字符串） */
export async function* readZstdLines(path: string) {
  const compressed = await readFile(path)
  const offsets = frameOffsets(compressed)
  if (offsets[0] !== 0) throw new Error('Invalid Zstd session log')

  let remainder = ''
  for (let index = 0; index < offsets.length; index += 1) {
    const frame = compressed.subarray(
      offsets[index],
      offsets[index + 1] ?? compressed.length
    )
    const text = remainder + (await decompressZstdFrame(frame)).toString('utf8')
    const lines = text.split(/\r?\n/)
    remainder = lines.pop() ?? ''
    for (const line of lines) yield line
  }
  if (remainder) yield remainder
}
