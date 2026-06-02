import { useRef } from 'react'

export type ProjectShareProps = {
  onExport: () => void
  onPickImportFile: (file: File) => void
  error: string | null
  busy: boolean
}

export default function ProjectShare({
  onExport,
  onPickImportFile,
  error,
  busy,
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
    </section>
  )
}
