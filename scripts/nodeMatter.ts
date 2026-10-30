/**
 * 在 Node 中加载 Phaser 包内置的 Matter 源码（与浏览器里 Phaser.Physics.Matter.Matter 为同一份代码）。
 * 只给关卡验证工具和测试使用。
 */
import { createRequire } from 'node:module'
import { setMatter } from '../src/physics/matterLib'

const require = createRequire(import.meta.url)
setMatter(require('phaser/src/physics/matter-js/CustomMain.js'))
