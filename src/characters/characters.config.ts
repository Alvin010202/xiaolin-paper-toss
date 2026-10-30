import type { CharacterDef } from './types'

/**
 * 开发者预置人物 —— 在这里添加或修改朋友。
 *
 * 添加一位朋友：
 *   1. 把头像图片（正方形最好，JPEG / PNG / WebP，建议 256×256 以上）放进 public/avatars/，例如 public/avatars/friend-a.jpg
 *   2. 复制下面一个占位条目，改 id（英文、唯一）、nickname（昵称）、avatar: 'avatars/friend-a.jpg'
 *   3. 改 accentColor（衣服颜色）和台词
 * 替换头像：直接用同名文件覆盖 public/avatars/ 里的图片即可。
 * avatar 留空或图片加载失败时会自动显示原创占位头像，不会出现破图。
 *
 * 第一位必须是主角小林（id: 'xiaolin'），她是默认投手。
 * 下面几位朋友目前是占位角色（不是真实姓名），等你提供真实朋友的昵称和头像后替换。
 */
export const PRESET_CHARACTERS: CharacterDef[] = [
  {
    id: 'xiaolin',
    nickname: '小林',
    avatar: 'avatars/xiaolin.png',
    accentColor: '#ff8fab',
    cheerLines: ['这球必须进！', '稳稳的～', '看到没，乖巧又准', '纸团也要有归宿'],
    missLines: ['刚才是风的问题', '再来一次！', '手滑了一下下', '桶自己躲开的'],
  },
  {
    id: 'friend-desk',
    nickname: '工位搭子',
    avatar: '',
    accentColor: '#4d96ff',
    cheerLines: ['好球！', '这准头，可以去打 NBA 了', '漂亮！'],
    missLines: ['差一点点！', '方向对了，力度再调调', '没事没事'],
  },
  {
    id: 'friend-coffee',
    nickname: '咖啡续命',
    avatar: '',
    accentColor: '#c08552',
    cheerLines: ['值得一杯美式！', '这球有咖啡因', '帅！'],
    missLines: ['我先去续杯…', '桶：我躲了吗？', '下次一定'],
  },
  {
    id: 'friend-meeting',
    nickname: '会议记录员',
    avatar: '',
    accentColor: '#6bcb77',
    cheerLines: ['已记入会议纪要', '这个结论我同意', '漂亮的抛物线'],
    missLines: ['这个问题会后再议', '建议再试一次', '数据不够，再投一个'],
  },
  {
    id: 'friend-chill',
    nickname: '摸鱼专家',
    avatar: '',
    accentColor: '#9b72cf',
    cheerLines: ['哇哦！', '老板没看见，再来一个', '666'],
    missLines: ['哈哈哈哈', '纸团去摸鱼了', '桶表示不认识你'],
  },
]

/** 玩家自己导入的人物使用的默认台词 */
export const DEFAULT_CHEER_LINES = ['好球！', '进啦！', '漂亮！', '这球必须进！']
export const DEFAULT_MISS_LINES = ['差一点！', '再来！', '没关系～', '风向不对']

/** 导入人物可选的主题色 */
export const ACCENT_CHOICES = ['#ff8fab', '#4d96ff', '#6bcb77', '#ffb703', '#9b72cf', '#c08552', '#ef476f', '#118ab2']
