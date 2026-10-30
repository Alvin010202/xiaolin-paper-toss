import './styles/main.css'
import { Sfx } from './audio/sfx'
import { openAvatarStore } from './characters/avatarStore'
import { CharacterRoster } from './characters/roster'
import { probeLocalStorage, SaveManager } from './save/saveManager'
import { App } from './ui/app'
import { toast } from './ui/dom'

async function boot(): Promise<void> {
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const save = new SaveManager(probeLocalStorage(), prefersReduced)
  const avatarStore = await openAvatarStore()
  const roster = new CharacterRoster(avatarStore)
  await roster.load()
  const sfx = new Sfx(save.data.settings.muted)
  const root = document.getElementById('app')!
  const app = new App(root, save, roster, avatarStore, sfx)
  app.go('home')
  if (save.notice && save.loadStatus !== 'empty') toast(save.notice, 4200)
  if (!avatarStore.persistent) toast('浏览器无法长期保存导入的头像，本次仍可使用。', 4200)
}

boot().catch((e) => {
  console.error(e)
  const root = document.getElementById('app')
  if (root) root.textContent = '游戏加载失败，请刷新页面重试。'
})
