import { useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/services/api/client'
import { Input } from '@/components/ui/Field'
import { imageUrl } from './format'

/**
 * The token image.
 *
 * A pons token stores this URI on itself permanently, so it has to end up on
 * something that will still resolve years from now — which is what IPFS is for,
 * and why the field is an `ipfs://` URI rather than an upload the way a normal
 * form would have it.
 *
 * Creators should not have to care. Dropping a file here pins it and fills the
 * URI in. Pasting one stays available underneath, because plenty of creators
 * already host their artwork and should not be made to upload it twice.
 */

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

export function ImageUpload({
  value,
  onChange,
  error,
}: {
  /** The current URI — `ipfs://…` after an upload, or whatever was pasted. */
  value: string
  onChange: (uri: string) => void
  error?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  /** A local preview, so the image appears before any gateway has it. */
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const preview = localPreview ?? (value ? imageUrl(value) : null)

  const upload = async (file: File) => {
    setFailed(null)
    if (file.size > MAX_BYTES) {
      setFailed('That image is over 5 MB. Use a smaller one.')
      return
    }
    // Shown immediately; a freshly pinned CID can take a moment to appear on a
    // gateway, and a blank square in the meantime looks like a failure.
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setBusy(true)
    try {
      const { uri } = await api.uploadImage(file)
      onChange(uri)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The upload failed.')
      URL.revokeObjectURL(objectUrl)
      setLocalPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(null)
    setFailed(null)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <span className="block text-[13px] font-semibold tracking-[-0.01em] text-ink-600">Image</span>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={cn(
            'relative flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[16px]',
            'transition-colors disabled:opacity-70',
            preview
              ? 'bg-ink-100 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.1)]'
              : 'border-2 border-dashed border-ink-300 text-ink-400 hover:border-brand-400 hover:text-brand-600',
          )}
          aria-label={preview ? 'Replace image' : 'Upload an image'}
        >
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink-950/45 text-white">
              <Loader2 className="size-5 animate-[var(--animate-spin-slow)]" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-700/8 px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-ink-700/12 disabled:opacity-60"
            >
              <Upload className="size-3.5" />
              {busy ? 'Pinning…' : value ? 'Replace' : 'Upload image'}
            </button>
            {value && !busy && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-700/8 px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-danger/12 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setPasting((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-500 transition-colors hover:bg-ink-700/8 hover:text-ink-800"
            >
              <Link2 className="size-3.5" />
              Paste a URI
            </button>
          </div>

          <p className="text-[12px] leading-snug text-ink-500">
            PNG, JPEG, GIF or WebP, up to 5 MB. Pinned to IPFS and written to the token, where it
            stays for good.
          </p>

          {value && !busy && (
            <p className="truncate font-mono text-[11px] text-ink-400" title={value}>
              {value}
            </p>
          )}
        </div>
      </div>

      {pasting && (
        <Input
          value={value}
          onChange={(e) => {
            if (localPreview) URL.revokeObjectURL(localPreview)
            setLocalPreview(null)
            onChange(e.target.value.trim())
          }}
          placeholder="ipfs://… or https://…"
          className="font-mono text-[13px]"
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          e.target.value = ''
        }}
      />

      {(failed || error) && (
        <p className="text-[12.5px] font-medium text-danger">{failed ?? error}</p>
      )}
    </div>
  )
}
