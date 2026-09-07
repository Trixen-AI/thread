/**
 * Image uploads, pinned to IPFS through Pinata.
 *
 * A pons token stores its image as a URI on the token itself, forever. Asking a
 * creator to produce an `ipfs://` URI before they can launch means asking them
 * to go and use a different product first, so MESH takes the file and does that
 * part for them.
 *
 * The upload goes through this server rather than straight from the browser,
 * and that is the whole point of the file existing. A Pinata JWT can upload
 * anything to the account that owns it; shipping one to the browser — which is
 * what any `VITE_`-prefixed value does — would publish it to every visitor.
 * Here it stays on the server, and the browser only ever sees the CID that
 * comes back.
 *
 * What this is not: a general file host. Only signed-in accounts may upload,
 * only image types are accepted, and the size is capped.
 */

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files'

/** Types a token image may be. SVG is excluded: it can carry script. */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** Comfortably more than a token logo needs, small enough to forward cheaply. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const jwt = () => (process.env.PINATA_JWT ?? '').trim()

/** True when the server was given a Pinata JWT, so uploads can work at all. */
export const pinataConfigured = () => jwt().length > 0

/**
 * Sends one image to Pinata and returns its CID.
 *
 * Pinata's v3 endpoint takes multipart form-data. Node builds that natively, so
 * this needs no upload library — `FormData` sets its own boundary, which is why
 * the Content-Type header is deliberately not set by hand here.
 */
export async function pinImage({ bytes, contentType, filename }) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: contentType }), filename)
  // Public, or the CID would not resolve on any gateway but Pinata's own.
  form.append('network', 'public')

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt()}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })

  const text = await response.text()
  if (!response.ok) {
    // Pinata's message is far more useful than the status alone, but it can
    // mention the account, so only the reason is passed on.
    let reason = `Pinata refused the upload (${response.status})`
    try {
      const parsed = JSON.parse(text)
      const detail = parsed?.error?.details ?? parsed?.error?.reason ?? parsed?.error
      if (typeof detail === 'string') reason = `Pinata refused the upload: ${detail}`
    } catch {
      /* not JSON; the status alone will have to do */
    }
    const error = new Error(reason)
    error.status = response.status === 401 || response.status === 403 ? 500 : 502
    throw error
  }

  const cid = JSON.parse(text)?.data?.cid
  if (!cid) throw Object.assign(new Error('Pinata returned no CID'), { status: 502 })
  return cid
}

const extensionFor = (contentType) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' })[contentType] ??
  'bin'

/**
 * `POST /api/upload` — raw image bytes in, an `ipfs://` URI out.
 *
 * The body is the file itself rather than a multipart form: there is exactly
 * one file and no other fields, so a parser would be ceremony. The type comes
 * from Content-Type and is checked against the allowlist rather than trusted.
 */
export function uploadHandler(req, res) {
  if (!pinataConfigured()) {
    return res.status(501).json({
      error:
        'Image uploads are not configured on this server. Set PINATA_JWT, or paste an image URI instead.',
    })
  }

  const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (!ACCEPTED_IMAGE_TYPES.includes(contentType)) {
    return res.status(415).json({ error: 'Upload a PNG, JPEG, GIF or WebP image.' })
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'The upload was empty.' })
  }
  if (req.body.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'That image is over 5 MB. Use a smaller one.' })
  }

  pinImage({
    bytes: req.body,
    contentType,
    filename: `mesh-${Date.now()}.${extensionFor(contentType)}`,
  })
    .then((cid) => res.status(201).json({ cid, uri: `ipfs://${cid}` }))
    .catch((error) => {
      res.status(error.status ?? 502).json({ error: error.message ?? 'The upload failed.' })
    })
}
