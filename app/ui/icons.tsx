import type { Handle, RemixNode } from 'remix/component'

// Paths from Lucide (ISC License, https://lucide.dev), drawn at 24px with a 1.75 stroke.
const paths = {
  menu: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </>
  ),
  search: (
    <>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </>
  ),
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  channels: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  playlists: (
    <>
      <path d="M21 5H3" />
      <path d="M10 12H3" />
      <path d="M10 19H3" />
      <path d="M15 12.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997a1 1 0 0 1-1.517-.86z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  folder: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  ),
  upload: (
    <>
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  network: (
    <>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </>
  ),
} satisfies Record<string, RemixNode>

export type IconName = keyof typeof paths

export function Icon(handle: Handle<{ name: IconName; size?: number }>) {
  return () => {
    let { name, size = 24 } = handle.props
    return (
      <svg
        class="icon"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {paths[name]}
      </svg>
    )
  }
}

/** The LanTube mark: a house whose doorway is a play button. */
export function LogoMark(handle: Handle<{ size?: number }>) {
  return () => {
    let size = handle.props.size ?? 28
    return (
      <svg class="logo-mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <path
          d="M12.2 2.6a2.8 2.8 0 0 1 3.6 0l9.2 7.7c.64.53 1 1.32 1 2.15V23a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V12.45c0-.83.36-1.62 1-2.15z"
          fill="var(--accent)"
        />
        <path d="M11.4 13.1a.9.9 0 0 1 1.37-.77l5.6 3.35a.9.9 0 0 1 0 1.54l-5.6 3.35a.9.9 0 0 1-1.37-.77z" fill="#fff" />
      </svg>
    )
  }
}
