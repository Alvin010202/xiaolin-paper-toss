/**
 * 端到端测试：用本机 Google Chrome（playwright-core，channel: 'chrome'）真实操作生产构建。
 * 先运行 `npm run build`，再运行 `npm run test:e2e`。截图保存在 test-results/。
 *
 * 覆盖：首页、触屏拖动 / 鼠标拖动 / 取消拖动、真实投掷与结算、重试、暂停与恢复、
 * 头像导入裁剪 / 刷新恢复 / 编辑 / 删除、成绩卡下载与分享回退、每日挑战、存档损坏与存储不可用。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}test-results`
mkdirSync(outDir, { recursive: true })
const PORT = 4179
const BASE = `http://localhost:${PORT}/`
const solutions = JSON.parse(readFileSync(`${root}src/levels/solutions.json`, 'utf8'))
const SAVE_KEY = 'xiaolin-paper-toss:save'

let failures = 0
const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push(`✓ ${name}`)
  } catch (e) {
    failures++
    results.push(`✗ ${name}\n    ${String(e?.message ?? e).split('\n').slice(0, 4).join('\n    ')}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// ───────── 启动预览服务器 ─────────
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' })
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('预览服务器启动超时')), 20000)
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t)
      resolve()
    }
  })
  server.on('exit', (c) => reject(new Error(`预览服务器退出 ${c}`)))
})

const browser = await chromium.launch({ channel: 'chrome', headless: true })

const probe = (page) => page.evaluate(() => window.__xlptProbe?.())
async function waitPhase(page, phases, timeout = 15000) {
  await page.waitForFunction((ps) => ps.includes(window.__xlptProbe?.()?.phase), phases, { timeout, polling: 50 })
}
async function canvasMapper(page) {
  const box = await page.locator('#stage canvas').boundingBox()
  return (x, y) => ({ x: box.x + (x / 540) * box.width, y: box.y + (y / 960) * box.height })
}
/** 由瞄准参数算出松手位置（逻辑坐标） */
function pullPoint(tp, angleDeg, power) {
  const len = 26 + power * (170 - 26)
  const r = (angleDeg * Math.PI) / 180
  return { x: tp.x - Math.cos(r) * len, y: tp.y + Math.sin(r) * len }
}
async function mouseThrow(page, angleDeg, power) {
  const p = await probe(page)
  const map = await canvasMapper(page)
  const to = pullPoint(p.throwPoint, angleDeg, power)
  const a = map(p.throwPoint.x, p.throwPoint.y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    const q = map(p.throwPoint.x + ((to.x - p.throwPoint.x) * i) / 6, p.throwPoint.y + ((to.y - p.throwPoint.y) * i) / 6)
    await page.mouse.move(q.x, q.y)
  }
  await page.mouse.up()
}
async function touchDrag(cdp, page, to, { end = 'touchEnd' } = {}) {
  const p = await probe(page)
  const map = await canvasMapper(page)
  const a = map(p.throwPoint.x, p.throwPoint.y)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] })
  for (let i = 1; i <= 6; i++) {
    const q = map(p.throwPoint.x + ((to.x - p.throwPoint.x) * i) / 6, p.throwPoint.y + ((to.y - p.throwPoint.y) * i) / 6)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x, y: q.y, id: 1 }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] })
}
// Chrome 对不可取消的 touchcancel 调用 preventDefault 时给出的提示（来自 Phaser 内置触摸监听，不影响功能）
const KNOWN_BENIGN = [/Ignored attempt to cancel a touchcancel event/]
function watchErrors(page, list) {
  page.on('pageerror', (e) => list.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !KNOWN_BENIGN.some((r) => r.test(m.text())) && list.push(`console: ${m.text()}`))
}
async function seed(page, levelsCleared = 0, extra = {}) {
  await page.evaluate(
    ([key, n, extra]) => {
      const levels = {}
      for (let i = 1; i <= n; i++) levels[i] = { stars: 1 }
      localStorage.setItem(key, JSON.stringify({ version: 2, settings: { muted: true, reducedMotion: false }, levels, pitcherId: 'xiaolin', daily: {}, tutorialDone: n > 0, ...extra }))
    },
    [SAVE_KEY, levelsCleared, extra],
  )
}
async function openLevel(page, id) {
  await page.goto(`${BASE}?e2e`)
  await page.getByRole('button', { name: /闯关/ }).click()
  await page.getByRole('button', { name: new RegExp(`^第 ${id} 关 `) }).click()
  await waitPhase(page, ['ready'])
}

// ═════════════ 手机竖屏（触屏） ═════════════
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  watchErrors(page, errors)
  const cdp = await ctx.newCDPSession(page)

  await check('手机：首页加载，四个入口按钮可见', async () => {
    await page.goto(`${BASE}?e2e`)
    for (const n of [/开始闯关/, /每日挑战/, /朋友头像/, /设置/]) await page.getByRole('button', { name: n }).waitFor({ timeout: 8000 })
    await page.screenshot({ path: `${outDir}/mobile-home.png` })
  })

  await check('手机：第 1 关有新手演示，拖动距离太短松手不发射', async () => {
    await page.getByRole('button', { name: /开始闯关/ }).click()
    await page.screenshot({ path: `${outDir}/mobile-levels.png`, fullPage: true })
    await page.getByRole('button', { name: /^第 1 关 / }).click()
    await waitPhase(page, ['ready'])
    const p = await probe(page)
    await touchDrag(cdp, page, { x: p.throwPoint.x - 10, y: p.throwPoint.y + 8 })
    await page.waitForTimeout(300)
    const q = await probe(page)
    assert(q.phase === 'ready' && q.throwsLeft === 5 && !q.ballInFlight, `误触被当成投掷：${JSON.stringify(q)}`)
  })

  await check('手机：触摸被系统取消（touchcancel）时取消拖动，不发射', async () => {
    const p = await probe(page)
    await touchDrag(cdp, page, pullPoint(p.throwPoint, 45, 0.8), { end: 'touchCancel' })
    await page.waitForTimeout(300)
    const q = await probe(page)
    assert(q.phase === 'ready' && q.throwsLeft === 5, `取消后状态不对：${JSON.stringify(q)}`)
  })

  await check('手机：按验证过的方向和力度触屏投掷 → 命中 → 过关结算', async () => {
    const s = solutions['level-1'].best
    const p = await probe(page)
    await touchDrag(cdp, page, pullPoint(p.throwPoint, s.angleDeg, s.power))
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${outDir}/mobile-flying.png` })
    await page.getByRole('dialog').waitFor({ timeout: 10000 })
    const text = await page.getByRole('dialog').innerText()
    assert(text.includes('过关'), `结算不是过关：${text}`)
    const q = await probe(page)
    assert(q.hits === 1 && q.throwsLeft === 4, `进球计数不对：${JSON.stringify(q)}`)
    await page.screenshot({ path: `${outDir}/mobile-result.png` })
    const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY)
    assert(save.levels['1'].stars === 3, `存档星级不对：${JSON.stringify(save.levels)}`)
    assert(save.tutorialDone === true, '新手演示状态未保存')
  })

  await check('手机：结算后重试 → 回合时间和次数重置', async () => {
    await page.getByRole('button', { name: '重试' }).click()
    await waitPhase(page, ['ready'])
    const q = await probe(page)
    assert(q.throwsLeft === 5 && q.hits === 0 && q.roundTimeMs < 1500, `重试后状态不对：${JSON.stringify(q)}`)
  })

  await check('手机：页面不会因拖动而滚动', async () => {
    const y = await page.evaluate(() => window.scrollY)
    assert(y === 0, `页面滚动了 ${y}`)
  })

  await check('手机：没有控制台错误', async () => assert(errors.length === 0, errors.join('\n')))
  await ctx.close()
}

// ═════════════ 桌面（鼠标） ═════════════
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  watchErrors(page, errors)
  await page.goto(`${BASE}?e2e`)
  await seed(page, 3)

  await check('桌面：游戏区域按 9:16 居中完整显示', async () => {
    await openLevel(page, 2)
    const box = await page.locator('#frame').boundingBox()
    assert(Math.abs(box.width / box.height - 540 / 960) < 0.01, `比例不对 ${box.width}x${box.height}`)
    assert(Math.abs(box.x + box.width / 2 - 640) < 2, '没有水平居中')
    assert(box.y >= 0 && box.y + box.height <= 800, '超出窗口')
    await page.screenshot({ path: `${outDir}/desktop-level2.png` })
  })

  await check('桌面：拖动中失去窗口焦点 → 取消拖动', async () => {
    const p = await probe(page)
    const map = await canvasMapper(page)
    const a = map(p.throwPoint.x, p.throwPoint.y)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    const b = map(p.throwPoint.x - 80, p.throwPoint.y + 60)
    await page.mouse.move(b.x, b.y)
    assert((await probe(page)).phase === 'aiming', '没有进入瞄准')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.up()
    await page.waitForTimeout(200)
    const q = await probe(page)
    assert(q.phase === 'ready' && q.throwsLeft === 5, `失焦后没有取消：${JSON.stringify(q)}`)
  })

  await check('桌面：暂停时回合时间冻结，恢复后继续；暂停中重来会重置', async () => {
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: '暂停' }).click()
    const a = await probe(page)
    await page.waitForTimeout(800)
    const b = await probe(page)
    assert(a.paused && b.paused && a.roundTimeMs === b.roundTimeMs, `暂停时时间仍在走：${a.roundTimeMs} → ${b.roundTimeMs}`)
    await page.screenshot({ path: `${outDir}/desktop-pause.png` })
    await page.getByRole('button', { name: '继续' }).click()
    await page.waitForTimeout(500)
    const c = await probe(page)
    assert(!c.paused && c.roundTimeMs > b.roundTimeMs, '恢复后时间没有继续')
    assert(c.roundTimeMs - b.roundTimeMs < 1200, `恢复后时间跳变过大：${c.roundTimeMs - b.roundTimeMs}`)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '重来' }).click()
    await waitPhase(page, ['ready'])
    const d = await probe(page)
    assert(!d.paused && d.roundTimeMs < 1000 && d.throwsLeft === 5, `重来后状态不对：${JSON.stringify(d)}`)
  })

  await check('桌面：飞行中暂停 → 纸团不动；恢复后本次投掷正常结束', async () => {
    await mouseThrow(page, 50, 0.7)
    await page.waitForTimeout(200)
    await page.keyboard.press('p')
    const a = await probe(page)
    await page.waitForTimeout(600)
    const b = await probe(page)
    assert(a.ballInFlight && a.roundTimeMs === b.roundTimeMs, '飞行中暂停没有冻结')
    await page.getByRole('button', { name: '继续' }).click()
    await waitPhase(page, ['ready', 'ended'])
    const c = await probe(page)
    assert(c.throwsLeft === 4, `投掷次数不对：${JSON.stringify(c)}`)
  })

  await check('桌面：鼠标连投 5 次都不进 → 失败结算 → 重试', async () => {
    for (let i = 0; i < 4; i++) {
      await waitPhase(page, ['ready'])
      await mouseThrow(page, 180, 1) // 往左边扔出画面
    }
    await page.getByRole('dialog').waitFor({ timeout: 10000 })
    const t = await page.getByRole('dialog').innerText()
    assert(t.includes('差一点'), `应为失败结算：${t}`)
    await page.screenshot({ path: `${outDir}/desktop-fail.png` })
  })

  await check('桌面：分享成绩 → 不支持系统分享时提供下载图片；本机运行时不生成假网址', async () => {
    await page.getByRole('button', { name: '分享成绩' }).click()
    await page.getByRole('img', { name: '成绩卡预览' }).waitFor()
    assert(!(await page.getByRole('button', { name: '复制链接' }).isVisible()), '本机运行不应提供复制链接')
    assert(await page.getByText('还没有设置正式网址').isVisible(), '缺少未设置网址的说明')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下载图片' }).click()])
    const file = `${outDir}/score-card.png`
    await dl.saveAs(file)
    const buf = readFileSync(file)
    assert(buf.subarray(1, 4).toString() === 'PNG', '下载的不是 PNG')
    assert(buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1350, '成绩卡尺寸不对')
    await page.screenshot({ path: `${outDir}/desktop-share.png` })
    await page.getByRole('button', { name: '关闭' }).click()
    await page.getByRole('button', { name: '重试' }).click()
    await waitPhase(page, ['ready'])
  })

  await check('桌面：关卡选择按场景分组，显示解锁状态和星级', async () => {
    await page.goto(`${BASE}?e2e`)
    await page.getByRole('button', { name: /闯关/ }).click()
    for (const g of ['工位区', '茶水间', '会议室']) assert(await page.getByRole('region', { name: g }).isVisible(), `缺少分组 ${g}`)
    assert(await page.getByRole('button', { name: /第 4 关 .*未通过/ }).isVisible(), '第 4 关应已解锁')
    assert(await page.getByRole('button', { name: /第 5 关，未解锁/ }).isVisible(), '第 5 关应未解锁')
    await page.screenshot({ path: `${outDir}/desktop-levels.png`, fullPage: true })
  })

  await check('桌面：头像导入（格式错误提示 → 裁剪 → 保存 → 选为投手 → 刷新后恢复 → 编辑 → 删除）', async () => {
    await page.goto(`${BASE}?e2e`)
    await page.getByRole('button', { name: '朋友头像' }).click()
    await page.getByRole('button', { name: /导入新朋友/ }).click()
    // 错误文件
    await page.setInputFiles('#avatar-file', { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image at all') })
    await page.getByRole('alert').filter({ hasText: '只支持' }).waitFor()
    // 生成一张 600×400 的 PNG
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 600
      c.height = 400
      const g = c.getContext('2d')
      g.fillStyle = '#4d96ff'
      g.fillRect(0, 0, 600, 400)
      g.fillStyle = '#ffd166'
      g.beginPath()
      g.arc(420, 200, 120, 0, Math.PI * 2)
      g.fill()
      return c.toDataURL('image/png').split(',')[1]
    })
    await page.setInputFiles('#avatar-file', { name: 'friend.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') })
    const crop = page.locator('.cropper')
    await crop.waitFor()
    await page.waitForTimeout(200)
    const cb = await crop.boundingBox()
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2)
    await page.mouse.down()
    await page.mouse.move(cb.x + cb.width / 2 - 60, cb.y + cb.height / 2, { steps: 5 })
    await page.mouse.up()
    await page.getByRole('slider', { name: '缩放' }).fill('1.6')
    await page.getByLabel(/昵称/).fill('测试同事')
    await page.screenshot({ path: `${outDir}/desktop-avatar-crop.png` })
    await page.getByRole('button', { name: '保存' }).click()
    await page.locator('.char-item .nick', { hasText: '测试同事' }).waitFor()
    await page.getByRole('button', { name: '选 测试同事 当投手' }).click()
    await page.reload()
    await page.getByText('当前投手：测试同事').waitFor()
    await page.getByRole('button', { name: '朋友头像' }).click()
    const img = page.locator('.char-item', { hasText: '测试同事' }).locator('img')
    const natural = await img.evaluate((el) => el.naturalWidth)
    assert(natural === 256, `头像尺寸应为 256，实际 ${natural}`)
    await page.getByRole('button', { name: '编辑 测试同事' }).click()
    await page.getByLabel(/昵称/).fill('改名同事')
    await page.getByRole('button', { name: '保存' }).click()
    await page.locator('.char-item .nick', { hasText: '改名同事' }).waitFor()
    await page.screenshot({ path: `${outDir}/desktop-avatars.png`, fullPage: true })
    await page.getByRole('button', { name: '删除 改名同事' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '删除' }).click()
    await page.locator('.char-item .nick', { hasText: '改名同事' }).waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '返回首页' }).click()
    await page.getByText('当前投手：小林').waitFor()
  })

  await check('桌面：导入的人物出现在游戏中当投手（刷新后从 IndexedDB 恢复）', async () => {
    // 上一项已删除；重新导入一位并开始一局，确认没有报错且画面正常
    await page.getByRole('button', { name: '朋友头像' }).click()
    await page.getByRole('button', { name: /导入新朋友/ }).click()
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = c.height = 300
      const g = c.getContext('2d')
      g.fillStyle = '#6bcb77'
      g.fillRect(0, 0, 300, 300)
      return c.toDataURL('image/png').split(',')[1]
    })
    await page.setInputFiles('#avatar-file', { name: 'g.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') })
    await page.getByLabel(/昵称/).fill('绿色朋友')
    await page.getByRole('button', { name: '保存' }).click()
    await page.getByRole('button', { name: '选 绿色朋友 当投手' }).click()
    await page.reload()
    await page.getByText('当前投手：绿色朋友').waitFor()
    await openLevel(page, 1)
    await page.screenshot({ path: `${outDir}/desktop-custom-pitcher.png` })
  })

  await check('桌面：系统分享被用户取消时不提示错误', async () => {
    await page.evaluate(() => {
      navigator.canShare = () => true
      navigator.share = () => Promise.reject(new DOMException('cancel', 'AbortError'))
    })
    for (let i = 0; i < 5; i++) {
      await waitPhase(page, ['ready'])
      await mouseThrow(page, 180, 1)
    }
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: '分享成绩' }).click()
    await page.getByRole('button', { name: '分享给朋友' }).click()
    await page.waitForTimeout(500)
    const toasts = await page.locator('#toast').innerText()
    assert(!toasts.includes('没有完成') && !toasts.includes('失败'), `取消分享出现了错误提示：${toasts}`)
    await page.getByRole('button', { name: '关闭' }).click()
  })

  await check('桌面：每日挑战显示日期和时区，10 球后保存本机最高分与挑战信息', async () => {
    await page.goto(`${BASE}?e2e`)
    await page.getByRole('button', { name: '每日挑战' }).click()
    const info = await page.locator('main').innerText()
    assert(/\d{4}-\d{2}-\d{2}（Asia\/Shanghai 时区）/.test(info), `缺少日期时区：${info.slice(0, 200)}`)
    await page.screenshot({ path: `${outDir}/desktop-daily.png`, fullPage: true })
    await page.getByRole('button', { name: /开始挑战|再挑战/ }).click()
    await waitPhase(page, ['ready'])
    for (let i = 0; i < 10; i++) {
      await waitPhase(page, ['ready'])
      await mouseThrow(page, 180, 1)
    }
    await page.getByRole('dialog').waitFor({ timeout: 15000 })
    const t = await page.getByRole('dialog').innerText()
    assert(t.includes('挑战完成') && t.includes('0 分'), `每日结算不对：${t}`)
    const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY)
    const rec = Object.values(save.daily)[0]
    assert(rec && rec.templateId && Number.isFinite(rec.seed) && rec.ruleVersion === 'daily-v2' && rec.plays === 1, `每日记录不完整：${JSON.stringify(save.daily)}`)
  })

  await check('桌面：设置可切换声音与减少动画并保存；重置存档有确认说明', async () => {
    await page.goto(`${BASE}?e2e`)
    await page.getByRole('button', { name: '设置' }).click()
    await page.getByRole('switch', { name: '减少动画' }).click()
    let save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY)
    assert(save.settings.reducedMotion === true, '减少动画未保存')
    await page.getByRole('switch', { name: '声音' }).click()
    save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY)
    assert(save.settings.muted === false, '声音开关未保存')
    await page.getByRole('button', { name: '重置存档…' }).click()
    const dlg = await page.getByRole('dialog').innerText()
    assert(dlg.includes('星级') && dlg.includes('每日挑战') && dlg.includes('设置'), `确认说明不完整：${dlg}`)
    await page.screenshot({ path: `${outDir}/desktop-reset-confirm.png` })
    await page.getByRole('button', { name: '确认删除' }).click()
    await page.getByText('存档已重置').waitFor()
    save = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)
    assert(save === null || !JSON.parse(save).levels['1'], '重置后仍有关卡记录')
  })

  await check('桌面：没有控制台错误', async () => assert(errors.length === 0, errors.join('\n')))
  await ctx.close()
}

// ═════════════ 存档损坏 / 存储不可用 ═════════════
await check('存档损坏：仍能进入游戏，并提示已重新开始', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.addInitScript((k) => localStorage.setItem(k, '{broken json'), SAVE_KEY)
  await page.goto(`${BASE}?e2e`)
  await page.getByText('存档无法读取').first().waitFor()
  await page.getByRole('button', { name: /开始闯关/ }).click()
  await page.getByRole('button', { name: /^第 1 关 / }).click()
  await waitPhase(page, ['ready'])
  await ctx.close()
})

await check('存储不可用（localStorage / IndexedDB 抛错）：仍能游玩，并给出提示', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError') } })
    Object.defineProperty(window, 'indexedDB', { get() { return undefined } })
  })
  const errors = []
  watchErrors(page, errors)
  await page.goto(`${BASE}?e2e`)
  await page.getByText('不会保存').first().waitFor()
  await page.getByRole('button', { name: /开始闯关/ }).click()
  await page.getByRole('button', { name: /^第 1 关 / }).click()
  await waitPhase(page, ['ready'])
  await mouseThrow(page, 180, 1)
  await waitPhase(page, ['ready'])
  assert((await probe(page)).throwsLeft === 4, '投掷没有计数')
  assert(errors.length === 0, errors.join('\n'))
  await ctx.close()
})

await check('头像文件缺失或损坏：自动显示占位头像，不出现破图', async () => {
  for (const mode of ['missing', 'corrupt']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.route('**/avatars/xiaolin.png', (r) =>
      mode === 'missing' ? r.fulfill({ status: 404, body: 'not found' }) : r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('broken png bytes') }),
    )
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${BASE}?e2e`)
    const img = page.locator('.pitcher-chip img')
    await img.waitFor()
    const w = await img.evaluate((el) => el.complete && el.naturalWidth)
    assert(w === 256, `${mode}：头像没有回退到占位图（naturalWidth=${w}）`)
    await page.getByRole('button', { name: /开始闯关/ }).click()
    await page.getByRole('button', { name: /^第 1 关 / }).click()
    await waitPhase(page, ['ready'])
    assert(errors.length === 0, errors.join('\n'))
    if (mode === 'corrupt') await page.screenshot({ path: `${outDir}/avatar-fallback.png` })
    await ctx.close()
  }
})

await check('手机横屏：游戏区域完整可见', async () => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}?e2e`)
  await seed(page, 0)
  await openLevel(page, 1)
  const box = await page.locator('#frame').boundingBox()
  assert(box.height <= 390 && box.y >= 0, `横屏超出：${JSON.stringify(box)}`)
  await page.screenshot({ path: `${outDir}/mobile-landscape.png` })
  await ctx.close()
})

await browser.close()
server.kill()
writeFileSync(`${outDir}/e2e-report.txt`, results.join('\n') + '\n')
console.log(results.join('\n'))
console.log(failures ? `\n${failures} 项失败` : '\n全部通过')
process.exit(failures ? 1 : 0)
