import assert from 'node:assert/strict'
import { parseGiphyResults, parseKlipyResults, safeGiphyFileName } from '../src/lib/giphy.ts'

const found = parseGiphyResults({ data: [
  { id: 'abc', title: 'Reaction: wow!', url: 'https://giphy.com/gifs/abc', images: { fixed_width: { webp: 'https://media.test/preview.webp' }, original: { mp4: 'https://media.test/original.mp4', width: '480', height: '270' } } },
  { id: 'missing-video', title: 'Invalid', images: { original: { url: 'https://media.test/a.gif' } } },
] })
assert.equal(found.length, 1)
assert.deepEqual(found[0], { id: 'abc', title: 'Reaction: wow!', pageUrl: 'https://giphy.com/gifs/abc', previewUrl: 'https://media.test/preview.webp', mp4Url: 'https://media.test/original.mp4', width: 480, height: 270 })
assert.equal(safeGiphyFileName(found[0]), 'Reaction-wow-abc.mp4')
assert.deepEqual(parseGiphyResults(null), [])
const klipy = parseKlipyResults({ data: { data: [
  { id: 'sun-abc', title: 'Sun letters', url: 'https://klipy.com/gifs/sun-abc', file: { hd: { mp4: { url: 'https://cdn.klipy.test/sun.mp4', width: 640, height: 360 } }, sm: { webp: { url: 'https://cdn.klipy.test/sun.webp' } } } },
] } })
assert.deepEqual(klipy, [{ id: 'sun-abc', title: 'Sun letters', pageUrl: 'https://klipy.com/gifs/sun-abc', previewUrl: 'https://cdn.klipy.test/sun.webp', mp4Url: 'https://cdn.klipy.test/sun.mp4', width: 640, height: 360 }])
assert.deepEqual(parseKlipyResults({ data: { data: [{ id: 'missing-video', file: { sm: { webp: { url: 'https://cdn.test/a.webp' } } } }] } }), [])
console.log('PASS GIPHY and Klipy payload validation, MP4 selection, and safe file naming')
