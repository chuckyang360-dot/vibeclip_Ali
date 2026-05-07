/** Design tokens aligned with Framer Short Drama reference (#1D1D1F palette). */

export const sdFontHeading = { fontFamily: "'Syne', sans-serif" } as const;

/**
 * Remix Icon renders via ::before on <i>. Tailwind preflight sets italic on `i`, which can break
 * icon alignment/visibility in some layouts — normalize with inline-block + not-italic.
 */
export function ri(...classNames: string[]): string {
  return ['inline-block', 'not-italic', 'leading-none', ...classNames].filter(Boolean).join(' ');
}

export const sdColors = {
  ink: '#1D1D1F',
  inkMuted: '#374151',
  textSecondary: '#6E6E73',
  textTertiary: '#8E8E93',
  border: '#EAEAEA',
  surface: '#F7F8FA',
  surface2: '#F5F5F7',
} as const;

/**
 * 与 ShortDramaLayout 顶栏左右留白一致（header 使用 px-6 lg:px-10），
 * 避免工作流子页内容区与 logo 视觉错位。
 */
export const sdWorkflowPageShell = 'mx-auto w-full max-w-[1600px] px-6 lg:px-10' as const;
