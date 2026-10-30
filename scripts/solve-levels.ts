/**
 * 关卡验证工具：npm run solve
 * 对 20 个关卡和全部每日挑战模板做实际物理搜索，把找到的可行投掷写入 src/levels/solutions.json。
 * 可选参数：只验证某几关，例如 `npm run solve -- 3 7 daily-shelf`
 */
import './nodeMatter'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LEVELS } from '../src/levels/levels'
import { DAILY_TEMPLATES } from '../src/levels/dailyTemplates'
import type { LayoutDef } from '../src/levels/types'
import { replayThrow, solveLayout, type SolveReport, type VerifiedThrow } from './solverCore'

const outPath = fileURLToPath(new URL('../src/levels/solutions.json', import.meta.url))

interface SolutionEntry {
  hitRate: number
  tried: number
  neighborhood: number
  best: VerifiedThrow
  samples: VerifiedThrow[]
}

const only = process.argv.slice(2)
const existing: Record<string, SolutionEntry> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {}
const result: Record<string, SolutionEntry> = only.length ? { ...existing } : {}

const jobs: { key: string; layout: LayoutDef; label: string }[] = [
  ...LEVELS.map((l) => ({ key: `level-${l.id}`, layout: l, label: `第 ${l.id} 关 ${l.name}（目标 ${l.target}）` })),
  ...DAILY_TEMPLATES.map((t) => ({ key: `daily-${t.id}`, layout: t, label: `每日模板 ${t.id} ${t.name}` })),
]

let failed = 0
for (const job of jobs) {
  if (only.length && !only.some((o) => job.key === `level-${o}` || job.key === `daily-${o}` || job.key === o)) continue
  const started = Date.now()
  const report: SolveReport = solveLayout(job.layout)
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (!report.best) {
    failed++
    console.log(`✗ ${job.label}：没有找到可行投掷（${report.tried} 次尝试，${secs}s）`)
    delete result[job.key]
    continue
  }
  const replay = replayThrow(job.layout, report.best)
  if (replay.outcome !== 'hit') {
    failed++
    console.log(`✗ ${job.label}：推荐投掷在全新世界里重放未命中`)
    continue
  }
  const hitRate = report.hits / report.tried
  result[job.key] = {
    hitRate: Math.round(hitRate * 10000) / 10000,
    tried: report.tried,
    neighborhood: report.bestNeighborhood,
    best: report.best,
    samples: report.samples,
  }
  const b = report.best
  console.log(
    `✓ ${job.label}：命中率 ${(hitRate * 100).toFixed(2)}%，推荐 角度 ${b.angleDeg}° 力度 ${(b.power * 100).toFixed(0)}% 出手 ${b.launchTimeMs}ms，邻域 ${report.bestNeighborhood}/9（${secs}s）`,
  )
}

writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
console.log(failed ? `\n有 ${failed} 个布局未通过验证` : '\n全部布局都找到了经过验证的可行投掷')
process.exitCode = failed ? 1 : 0
