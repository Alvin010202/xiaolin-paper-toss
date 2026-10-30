/**
 * Matter 物理库的注入点。
 *
 * 游戏在浏览器里使用 Phaser 内置的 Matter（Phaser.Physics.Matter.Matter），
 * 关卡验证工具和测试在 Node 里直接加载 Phaser 包内同一份 Matter 源码
 * （phaser/src/physics/matter-js/CustomMain.js），两边的物理规则完全相同。
 */

export interface Vec2 {
  x: number
  y: number
}

/** 本项目用到的 Matter 刚体字段（Matter 0.20） */
export interface MBody {
  id: number
  label: string
  position: Vec2
  positionPrev: Vec2
  velocity: Vec2
  force: Vec2
  angle: number
  angularVelocity: number
  speed: number
  mass: number
  isStatic: boolean
  isSensor: boolean
  parts: MBody[]
  parent: MBody
  plugin: Record<string, unknown>
}

export interface MPair {
  bodyA: MBody
  bodyB: MBody
  isSensor: boolean
  collision: { depth: number; normal: Vec2 }
}

export interface MEngine {
  world: unknown
  gravity: { x: number; y: number; scale: number }
  positionIterations: number
  velocityIterations: number
  timing: { timestamp: number }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MatterLib = any

let matterLib: MatterLib | null = null

export function setMatter(lib: MatterLib): void {
  matterLib = lib
}

export function getMatter(): MatterLib {
  if (!matterLib) throw new Error('Matter 物理库尚未初始化')
  return matterLib
}
