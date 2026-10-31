import assert from 'node:assert/strict'
import fs from 'node:fs'
import {VideoEncoder,makeCanvas} from '../tools/mcp/core.mjs'
fs.mkdirSync('.cache',{recursive:true})
const encoder=new VideoEncoder({w:32,h:18,fps:30,out:'.cache/nonexistent-encoder-test-dir/output.mp4'})
encoder.addCanvas(makeCanvas(32,18))
await assert.rejects(encoder.finish(),/ffmpeg exit|closed|EPIPE/)
const empty=new VideoEncoder({w:32,h:18,fps:30,out:'.cache/empty-encoder-test.mp4'})
await assert.rejects(empty.finish(),/no frames/)
console.log('PASS encoder failure propagates without hanging; empty export terminates child')
