/** 统一的人物配置 */
export interface CharacterDef {
  id: string
  /** 显示的昵称 */
  nickname: string
  /**
   * 头像地址（相对网站根目录，例如 'avatars/xiaolin.png'）。
   * 留空或加载失败时自动使用原创占位头像。
   */
  avatar: string
  /** 主题色（身体衣服、气泡描边等） */
  accentColor: string
  /** 命中时的台词（随机抽一句） */
  cheerLines: string[]
  /** 没进时的台词 */
  missLines: string[]
}

export interface RosterCharacter extends CharacterDef {
  source: 'preset' | 'custom'
  /** 占位头像的发型样式（0～3），只在没有头像图片时使用 */
  placeholderStyle: number
}
