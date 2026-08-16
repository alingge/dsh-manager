/**
 * 生成应用图标：读取官方 dsh favicon.svg，合成 256x256 PNG（深色圆角背景 + 白色 logo）。
 * 用法：node scripts/gen-icon.mjs
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
// 优先读项目内的图标源（CI/别人机器可用）；找不到再回退到本机官方源码路径
const LOCAL_SRC = path.join(ROOT, 'assets', 'favicon-source.svg')
const OFFICIAL_SRC = 'E:/deepseek-harness/deepseek-harness/apps/web/dist/favicon.svg'
const SRC = fs.existsSync(LOCAL_SRC) ? LOCAL_SRC : OFFICIAL_SRC

let svg = fs.readFileSync(SRC, 'utf8')
// 把暗色媒体查询里的白色规则改为全局生效（logo 变白），不破坏任何标签结构
svg = svg.replace(/@media \(prefers-color-scheme: dark\) \{/, '')
  .replace(/path \{ fill: #fff; \}/, 'path { fill: #ffffff; }')
  .replace(/\t*\}/, '')

// 在 <path> 前插入深色圆角背景矩形（rect 不受 path 样式影响）
const composed = svg.replace('<path id="path"', '<rect x="1" y="1" width="48" height="48" rx="11" fill="#1e1e2e" stroke="#3a3a52" stroke-width="1"/><path id="path"')

const out = path.join(ROOT, 'assets', 'icon.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
await sharp(Buffer.from(composed)).resize(256, 256).png().toFile(out)
console.log('OK icon -> ' + out)
