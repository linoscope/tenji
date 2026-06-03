import { useRef } from 'react'

export type ProjectShareProps = {
  onExport: () => void
  onPickImportFile: (file: File) => void
  error: string | null
  busy: boolean
  /** When true, the "Create shareable link" control is shown (Supabase configured). */
  shareEnabled?: boolean
  onCreateShareLink?: () => void
  shareCreating?: boolean
  shareUrl?: string | null
  shareError?: string | null
}

export default function ProjectShare({
  onExport,
  onPickImportFile,
  error,
  busy,
  shareEnabled = false,
  onCreateShareLink,
  shareCreating = false,
  shareUrl = null,
  shareError = null,
}: ProjectShareProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <section
      data-testid="project-share"
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 12,
      }}
    >
      <strong style={{ fontSize: 12 }}>Project</strong>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          style={{ flex: 1 }}
        >
          Export project
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{ flex: 1 }}
        >
          Import project
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Import project"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickImportFile(file)
          e.target.value = ''
        }}
        style={{ position: 'absolute', left: -9999, width: 1, height: 1 }}
      />
      {error ? (
        <p
          data-testid="project-import-error"
          style={{ color: '#a11', margin: 0, fontSize: 11 }}
        >
          {error}
        </p>
      ) : null}

      {shareEnabled ? (
        <div
          data-testid="project-share-link"
          style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}
        >
          <button
            type="button"
            onClick={onCreateShareLink}
            disabled={busy || shareCreating}
          >
            {shareCreating ? 'Creating…' : 'Create shareable link'}
          </button>
          {shareUrl ? (
            <input
              data-testid="project-share-url"
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable link"
              onFocus={(e) => e.currentTarget.select()}
              style={{ fontSize: 11 }}
            />
          ) : null}
          {shareError ? (
            <p
              data-testid="project-share-error"
              style={{ color: '#a11', margin: 0, fontSize: 11 }}
            >
              {shareError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
