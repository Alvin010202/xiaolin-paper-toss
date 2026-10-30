import { defineConfig } from 'vite'

// 使用相对路径（base: './'），构建结果可以放在任意静态托管的任意子目录下
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
})
