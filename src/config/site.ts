/**
 * 游戏入口地址。
 * 正式部署后可在构建时设置环境变量 VITE_PUBLIC_URL（例如 https://example.com/xiaolin/），
 * 成绩卡和“复制链接”会使用它；未设置时，如果当前页面是公开的 http(s) 地址就用当前地址。
 * 在本机（localhost、局域网 IP、file://）运行时不生成网址，也不生成二维码，避免出现假的链接。
 */
export function publicGameUrl(): string | null {
  const configured = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim()
  if (configured) return configured
  if (typeof location === 'undefined') return null
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return null
  if (isLocalHost(location.hostname)) return null
  return new URL(import.meta.env.BASE_URL, location.href).href
}

export function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}
