/**
 * 启用预渲染以生成 Tauri 需要的静态入口文件，同时保留标准的 SSR
 * 渲染流程（仅在构建阶段执行），运行时仍由浏览器端接管。
 */
export const prerender = true;
export const ssr = true;
