import { strFromU8, strToU8, unzipSync, zipSync, type UnzipFileInfo } from 'fflate'

const PROJECT_FORMAT = 'omniframe-project'
const PROJECT_SCHEMA_VERSION = 1
const MANIFEST_PATH = 'manifest.json'
const MAX_PROJECT_BYTES = 1024 * 1024 * 1024
const MAX_EXPANDED_BYTES = 1536 * 1024 * 1024
const MAX_ATTACHMENT_BYTES = 512 * 1024 * 1024
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024
const MAX_INLINE_DATA_URL_LENGTH = 64 * 1024
const MAX_ARCHIVE_ENTRIES = 20_000
const REF_TAG = '__omniframeBundleRef'

type Encoded = null | boolean | number | string | Encoded[] | { [key: string]: Encoded }

interface AttachmentRecord {
  id: string
  path: string
  mimeType: string
  size: number
  sha256: string
  fileName?: string
  lastModified?: number
}

interface OmniManifest {
  format: typeof PROJECT_FORMAT
  schemaVersion: number
  projectName: string
  createdAt: string
  state: Encoded
  attachments: AttachmentRecord[]
}

export interface ParsedOmniProject {
  projectName: string
  state: Record<string, unknown>
}

const NON_DOCUMENT_KEYS = new Set([
  'past', 'future', 'mediaImportNotice', 'playing', 'scrubbing', 'inInteraction', 'activeBgRemovalJob',
  'rotoBusy', 'guidedMatteBusy', 'cloneSourcePoint', 'smartPatchStatus',
])

function safeArchivePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || path.includes('\\') || path.includes('\0')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function bytesFromView(view: ArrayBufferView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice()
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure SHA-256 verification is unavailable in this browser; the project was not saved.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function readUrlBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(`A project resource could not be read for saving: ${url.slice(0, 120)}. Re-import or relink that source file, then try again.`)
  }
  if (!response.ok) throw new Error(`A project resource could not be read (HTTP ${response.status}): ${url.slice(0, 120)}.`)
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

function isResourceKey(key: string): boolean {
  return /(?:url|uri|src)$/i.test(key)
}

function fileNameFromUrl(url: string): string | undefined {
  if (!url.startsWith('blob:')) return undefined
  try {
    const tail = url.split('/').pop()
    return tail ? `embedded-${tail.slice(0, 32)}` : undefined
  } catch {
    return undefined
  }
}

async function encodeProjectState(
  root: Record<string, unknown>,
  attachments: AttachmentRecord[],
  files: Record<string, Uint8Array>,
): Promise<Encoded> {
  const idsByUrl = new Map<string, string>()
  const active = new WeakSet<object>()
  let nextAttachment = 1
  let totalAttachmentBytes = 0

  const addAttachment = async (
    bytes: Uint8Array,
    mimeType: string,
    fileName?: string,
    lastModified?: number,
  ): Promise<string> => {
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error(`An embedded project resource exceeds the ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB per-file save limit.`)
    }
    totalAttachmentBytes += bytes.byteLength
    if (totalAttachmentBytes > MAX_EXPANDED_BYTES) throw new Error('The project media exceeds the safe 1.5 GB bundle limit.')
    const id = `file-${String(nextAttachment++).padStart(6, '0')}`
    const path = `media/${id}.bin`
    attachments.push({ id, path, mimeType, size: bytes.byteLength, sha256: await sha256(bytes), ...(fileName ? { fileName } : {}), ...(lastModified !== undefined ? { lastModified } : {}) })
    files[path] = bytes
    return id
  }

  const encode = async (value: unknown, key = ''): Promise<Encoded> => {
    if (value === null) return null
    if (value === undefined) return { [REF_TAG]: 'undefined' }
    if (typeof value === 'boolean' || typeof value === 'string') {
      if (typeof value === 'string') {
        const urls = new Set<string>()
        if (value.startsWith('blob:')) urls.add(value)
        else if (value.includes('blob:')) {
          for (const match of value.matchAll(/blob:[^\s"'()]+/g)) urls.add(match[0])
        }
        if (isResourceKey(key) && /^data:/i.test(value)) {
          // Small data URLs are convenient inline; larger raster frames belong
          // in ZIP attachments so temporal Smart Patch sequences do not blow
          // past the manifest JSON size limit.
          if (value.length >= MAX_INLINE_DATA_URL_LENGTH) urls.add(value)
        } else if (isResourceKey(key) && value.startsWith('/')) {
          // App-relative URLs are part of OmniFrame's installed resources.
        } else if (isResourceKey(key) && /^https?:\/\//i.test(value)) {
          // Remote media referenced by the project must be embedded or saving
          // fails; a URL that may later disappear is not a durable project.
          urls.add(value)
        }
        if (urls.size === 0) return value
        const refs: Array<{ marker: string; id: string }> = []
        let text = value
        for (const url of urls) {
          let id = idsByUrl.get(url)
          if (!id) {
            const read = await readUrlBytes(url)
            id = await addAttachment(read.bytes, read.mimeType, fileNameFromUrl(url))
            idsByUrl.set(url, id)
          }
          if (value === url) return { [REF_TAG]: 'url', id }
          const marker = `__OMNIFRAME_MEDIA_REF_${id}__`
          text = text.split(url).join(marker)
          refs.push({ marker, id })
        }
        return { [REF_TAG]: 'text', value: text, refs: await encode(refs, 'refs') }
      }
      return value
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value
      return { [REF_TAG]: 'number', value: String(value) }
    }
    if (typeof value === 'bigint') return { [REF_TAG]: 'bigint', value: value.toString() }
    if (typeof value === 'function' || typeof value === 'symbol') return { [REF_TAG]: 'undefined' }
    if (typeof value !== 'object') return { [REF_TAG]: 'undefined' }

    const objectValue = value as object
    if (active.has(objectValue)) throw new Error('The editor state contains a cyclic object and cannot be saved as an OmniFrame project.')
    active.add(objectValue)
    try {
      if (value instanceof Blob) {
        const bytes = new Uint8Array(await value.arrayBuffer())
        const id = await addAttachment(bytes, value.type || 'application/octet-stream', value instanceof File ? value.name : undefined, value instanceof File ? value.lastModified : undefined)
        return { [REF_TAG]: value instanceof File ? 'file' : 'blob', id }
      }
      if (value instanceof ArrayBuffer) {
        const id = await addAttachment(new Uint8Array(value).slice(), 'application/octet-stream')
        return { [REF_TAG]: 'typed', id, type: 'ArrayBuffer' }
      }
      if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView
        const id = await addAttachment(bytesFromView(view), 'application/octet-stream')
        return { [REF_TAG]: 'typed', id, type: view.constructor.name }
      }
      if (value instanceof Date) return { [REF_TAG]: 'date', value: value.toISOString() }
      if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
        return { [REF_TAG]: 'image-data', width: value.width, height: value.height, data: await encode(value.data, 'data') }
      }
      if (value instanceof Map) {
        return { [REF_TAG]: 'map', entries: await encode([...value.entries()], 'entries') }
      }
      if (value instanceof Set) {
        return { [REF_TAG]: 'set', values: await encode([...value.values()], 'values') }
      }
      if (Array.isArray(value)) return await Promise.all(value.map((item) => encode(item)))
      if (!isPlainObject(objectValue)) {
        throw new Error(`The editor state contains a non-portable ${objectValue.constructor?.name || 'object'} value; convert it to project media before saving.`)
      }
      const output: Record<string, Encoded> = {}
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        if (objectValue === root && NON_DOCUMENT_KEYS.has(childKey)) continue
        if (typeof childValue === 'function' || typeof childValue === 'symbol') continue
        output[childKey] = await encode(childValue, childKey)
      }
      return output
    } finally {
      active.delete(objectValue)
    }
  }

  return encode(root)
}

async function decodeProjectState(
  value: Encoded,
  blobs: Map<string, Blob>,
  urls: Map<string, string>,
  attachmentNames: Map<string, { fileName?: string; lastModified?: number }>,
): Promise<unknown> {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return Promise.all(value.map((item) => decodeProjectState(item, blobs, urls, attachmentNames)))

  const tagged = value as Record<string, Encoded>
  const tag = tagged[REF_TAG]
  const attachmentId = typeof tagged.id === 'string' ? tagged.id : ''
  if (typeof tag === 'string') {
    if (tag === 'undefined') return undefined
    if (tag === 'number') {
      if (tagged.value === 'NaN') return NaN
      if (tagged.value === 'Infinity') return Infinity
      return -Infinity
    }
    if (tag === 'bigint') return BigInt(String(tagged.value))
    if (tag === 'date') return new Date(String(tagged.value))
    if (tag === 'url') {
      const blob = blobs.get(attachmentId)
      if (!blob) throw new Error(`The OmniFrame project references a missing media resource: ${attachmentId}`)
      let url = urls.get(attachmentId)
      if (!url) {
        url = URL.createObjectURL(blob)
        urls.set(attachmentId, url)
      }
      return url
    }
    if (tag === 'blob' || tag === 'file') {
      const blob = blobs.get(attachmentId)
      if (!blob) throw new Error(`The OmniFrame project references a missing binary resource: ${attachmentId}`)
      if (tag === 'blob') return blob
      const info = attachmentNames.get(attachmentId)
      return new File([blob], info?.fileName || `embedded-${attachmentId}`, {
        type: blob.type,
        lastModified: info?.lastModified,
      })
    }
    if (tag === 'typed') {
      const blob = blobs.get(attachmentId)
      if (!blob) throw new Error(`The OmniFrame project references a missing typed resource: ${attachmentId}`)
      const buffer = await blob.arrayBuffer()
      switch (String(tagged.type)) {
        case 'ArrayBuffer': return buffer
        case 'Int8Array': return new Int8Array(buffer)
        case 'Uint8Array': return new Uint8Array(buffer)
        case 'Uint8ClampedArray': return new Uint8ClampedArray(buffer)
        case 'Int16Array': return new Int16Array(buffer)
        case 'Uint16Array': return new Uint16Array(buffer)
        case 'Int32Array': return new Int32Array(buffer)
        case 'Uint32Array': return new Uint32Array(buffer)
        case 'Float32Array': return new Float32Array(buffer)
        case 'Float64Array': return new Float64Array(buffer)
        case 'BigInt64Array': return new BigInt64Array(buffer)
        case 'BigUint64Array': return new BigUint64Array(buffer)
        case 'DataView': return new DataView(buffer)
        default: throw new Error(`The OmniFrame project contains an unsupported binary view: ${String(tagged.type)}.`)
      }
    }
    if (tag === 'image-data') {
      const data = await decodeProjectState(tagged.data as Encoded, blobs, urls, attachmentNames)
      if (typeof ImageData === 'undefined' || !(data instanceof Uint8ClampedArray)) {
        throw new Error('This project contains ImageData unsupported by the current browser.')
      }
      const pixels = new Uint8ClampedArray(data.length)
      pixels.set(data)
      return new ImageData(pixels, Number(tagged.width), Number(tagged.height))
    }
    if (tag === 'map') {
      const entries = await decodeProjectState(tagged.entries as Encoded, blobs, urls, attachmentNames)
      return new Map(entries as [unknown, unknown][])
    }
    if (tag === 'set') {
      const values = await decodeProjectState(tagged.values as Encoded, blobs, urls, attachmentNames)
      return new Set(values as unknown[])
    }
    if (tag === 'text') {
      const refs = await decodeProjectState(tagged.refs as Encoded, blobs, urls, attachmentNames) as Array<{ marker: string; id: string }>
      let text = String(tagged.value ?? '')
      for (const ref of refs) {
        const blob = blobs.get(ref.id)
        if (!blob) throw new Error(`The OmniFrame project references a missing media resource: ${ref.id}`)
        let url = urls.get(ref.id)
        if (!url) {
          url = URL.createObjectURL(blob)
          urls.set(ref.id, url)
        }
        text = text.split(ref.marker).join(url)
      }
      return text
    }
  }

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(tagged)) {
    if (key === '__proto__') throw new Error('The OmniFrame project contains an unsafe object property.')
    Object.defineProperty(result, key, {
      value: await decodeProjectState(child, blobs, urls, attachmentNames),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return result
}

function validateManifest(value: unknown): asserts value is OmniManifest {
  if (!value || typeof value !== 'object') throw new Error('This is not a valid OmniFrame project file.')
  const manifest = value as Partial<OmniManifest>
  if (manifest.format !== PROJECT_FORMAT) throw new Error('This ZIP is not an OmniFrame `.omni` project.')
  if (manifest.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`This OmniFrame project uses schema ${manifest.schemaVersion ?? 'unknown'}, while this app supports schema ${PROJECT_SCHEMA_VERSION}.`)
  }
  if (!manifest.state || typeof manifest.state !== 'object' || Array.isArray(manifest.state)) throw new Error('The OmniFrame project has no valid editor state.')
  if (!Array.isArray(manifest.attachments) || manifest.attachments.length > MAX_ARCHIVE_ENTRIES) throw new Error('The OmniFrame project has an invalid media index.')
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  let total = 0
  for (const attachment of manifest.attachments) {
    if (!attachment || typeof attachment.id !== 'string' || !attachment.id || typeof attachment.path !== 'string' || !safeArchivePath(attachment.path)) {
      throw new Error('The OmniFrame project contains an invalid media index entry.')
    }
    if (seenIds.has(attachment.id) || seenPaths.has(attachment.path)) throw new Error('The OmniFrame project contains duplicate media references.')
    seenIds.add(attachment.id)
    seenPaths.add(attachment.path)
    if (!Number.isSafeInteger(attachment.size) || attachment.size < 0 || attachment.size > MAX_ATTACHMENT_BYTES || !/^[a-f0-9]{64}$/i.test(attachment.sha256)) {
      throw new Error(`The OmniFrame project contains invalid resource metadata for ${attachment.path}.`)
    }
    total += attachment.size
    if (total > MAX_EXPANDED_BYTES) throw new Error('The OmniFrame project exceeds the safe expanded-media limit.')
  }
}

function extractArchive(bytes: Uint8Array, wanted: Set<string>): Record<string, Uint8Array> {
  let count = 0
  let expanded = 0
  const names = new Set<string>()
  return unzipSync(bytes, {
    filter(info: UnzipFileInfo) {
      count++
      if (count > MAX_ARCHIVE_ENTRIES) throw new Error(`The project archive contains more than ${MAX_ARCHIVE_ENTRIES} files.`)
      if (!safeArchivePath(info.name)) throw new Error('The project archive contains an unsafe file path.')
      if (names.has(info.name)) throw new Error(`The project archive contains duplicate entries: ${info.name}`)
      names.add(info.name)
      if (info.compression !== 0 && info.compression !== 8) throw new Error(`The project archive uses unsupported compression for ${info.name}.`)
      if (!Number.isSafeInteger(info.originalSize) || info.originalSize < 0 || info.originalSize > MAX_ATTACHMENT_BYTES) {
        throw new Error(`The project archive has an oversized file: ${info.name}`)
      }
      expanded += info.originalSize
      if (expanded > MAX_EXPANDED_BYTES) throw new Error('The project archive exceeds the safe expanded-data limit.')
      if (info.name === MANIFEST_PATH && info.originalSize > MAX_MANIFEST_BYTES) throw new Error('The OmniFrame project manifest is too large.')
      return wanted.has(info.name)
    },
  })
}

export async function buildOmniProjectBundle(state: unknown, projectName: string): Promise<Blob> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('There is no valid editor project state to save.')
  const files: Record<string, Uint8Array> = {}
  const attachments: AttachmentRecord[] = []
  const encodedState = await encodeProjectState(state as Record<string, unknown>, attachments, files)
  const manifest: OmniManifest = {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectName: projectName.trim() || 'Untitled',
    createdAt: new Date().toISOString(),
    state: encodedState,
    attachments,
  }
  if (attachments.length + 1 > MAX_ARCHIVE_ENTRIES) throw new Error(`The project contains too many embedded resources (limit: ${MAX_ARCHIVE_ENTRIES - 1}).`)
  const manifestBytes = strToU8(JSON.stringify(manifest))
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error(`The project manifest exceeds the ${MAX_MANIFEST_BYTES / (1024 * 1024)} MB safety limit.`)
  files[MANIFEST_PATH] = manifestBytes
  let archive: Uint8Array
  try {
    archive = zipSync(files, { level: 0 })
  } catch (error) {
    throw new Error(`The OmniFrame project could not be packed: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (archive.byteLength > MAX_PROJECT_BYTES) throw new Error('The `.omni` project exceeds the safe 1 GB save limit. Remove unused media or save a smaller project copy.')
  return new Blob([archive.slice().buffer as ArrayBuffer], { type: 'application/x-omniframe-project' })
}

export async function parseOmniProjectBundle(file: File): Promise<ParsedOmniProject> {
  if (file.size > MAX_PROJECT_BYTES) throw new Error('This `.omni` project exceeds the safe 1 GB open limit.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const manifestArchive = extractArchive(bytes, new Set([MANIFEST_PATH]))
  const manifestBytes = manifestArchive[MANIFEST_PATH]
  if (!manifestBytes) throw new Error('This ZIP does not contain a valid OmniFrame project manifest.')

  let manifest: OmniManifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as OmniManifest
  } catch {
    throw new Error('The OmniFrame project manifest is malformed.')
  }
  validateManifest(manifest)

  const wanted = new Set([MANIFEST_PATH, ...manifest.attachments.map((attachment) => attachment.path)])
  const archive = extractArchive(bytes, wanted)
  const blobs = new Map<string, Blob>()
  const attachmentNames = new Map<string, { fileName?: string; lastModified?: number }>()
  for (const item of manifest.attachments) {
    const data = archive[item.path]
    if (!data || data.byteLength !== item.size) throw new Error(`The OmniFrame project is missing or has a truncated resource: ${item.path}`)
    if (await sha256(data) !== item.sha256.toLowerCase()) throw new Error(`The OmniFrame project resource failed its SHA-256 check: ${item.path}`)
    blobs.set(item.id, new Blob([data.slice().buffer as ArrayBuffer], { type: item.mimeType || 'application/octet-stream' }))
    attachmentNames.set(item.id, { fileName: item.fileName, lastModified: item.lastModified })
  }

  const urls = new Map<string, string>()
  try {
    const state = await decodeProjectState(manifest.state, blobs, urls, attachmentNames)
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('The OmniFrame project editor state is invalid.')
    const restored = state as Record<string, unknown>
    if (!Array.isArray(restored.assets) || !Array.isArray(restored.tracks) || !Array.isArray(restored.clips)) {
      throw new Error('This OmniFrame project is missing required media/timeline collections.')
    }
    return {
      projectName: typeof manifest.projectName === 'string' && manifest.projectName.trim() ? manifest.projectName.trim() : file.name.replace(/\.omni$/i, '') || 'Untitled',
      state: restored,
    }
  } catch (error) {
    for (const url of urls.values()) URL.revokeObjectURL(url)
    throw error
  }
}
