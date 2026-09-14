import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lossless PNG -> WebP encoder, delegating to Pillow/libwebp.
 *
 * This is the historical pipeline, kept verbatim on the Python side: the RGB of
 * every fully transparent pixel is zeroed, then the image is written with
 * libwebp's `exact` flag. `exact` is load-bearing rather than cosmetic -- with
 * it off, libwebp re-spreads colour into transparent pixels, so a source with
 * 39k dirty-but-invisible pixels decodes back with 395k of them. That colour is
 * what GPU edge sampling bleeds into visible neighbours as fringing.
 *
 * Partial alpha (`0 < alpha < 255`) is never touched; dimensions are never
 * resampled. libwebp's `method=6` search makes each encode single-threaded and
 * CPU-bound, so throughput comes from running many worker processes rather than
 * from concurrency inside one encode.
 */

const workerScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'encode-lossless-webp-worker.py')
const python = process.env.PYTHON_PATH || 'python'
const maxWorkers = Number(process.env.SIDEM_WEBP_WORKERS || Math.max(1, Math.min(8, os.cpus().length - 2)))

let nextJobId = 1
const idle = []
const busy = new Set()
const waiters = []
let spawned = 0

class Worker {
  constructor() {
    this.child = spawn(python, ['-u', workerScript], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.pending = new Map()
    this.buffer = ''
    this.stderr = ''
    this.dead = null

    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', chunk => this.#onStdout(chunk))
    this.child.stderr.setEncoding('utf8')
    this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk).slice(-4000) })
    this.child.on('error', error => this.#fail(error))
    this.child.on('close', code => this.#fail(new Error(`WebP worker exited with code ${code}${this.stderr ? `\n${this.stderr}` : ''}`)))
  }

  #onStdout(chunk) {
    this.buffer += chunk
    let newline
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline)
      this.buffer = this.buffer.slice(newline + 1)
      if (!line.trim()) continue
      let message
      try { message = JSON.parse(line) } catch { this.#fail(new Error(`Unparseable WebP worker output: ${line.slice(0, 200)}`)); return }
      const entry = this.pending.get(message.id)
      if (!entry) continue
      this.pending.delete(message.id)
      if (message.ok) entry.resolve(message)
      else entry.reject(new Error(`Failed to encode ${entry.source}: ${message.error}`))
    }
  }

  #fail(error) {
    if (this.dead) return
    this.dead = error
    for (const entry of this.pending.values()) entry.reject(error)
    this.pending.clear()
    const index = idle.indexOf(this)
    if (index >= 0) idle.splice(index, 1)
    busy.delete(this)
    spawned--
  }

  encode(job) {
    if (this.dead) return Promise.reject(this.dead)
    return new Promise((resolve, reject) => {
      this.pending.set(job.id, { resolve, reject, source: job.source })
      this.child.stdin.write(JSON.stringify(job) + '\n', error => { if (error) reject(error) })
    })
  }

  shutdown() {
    try { this.child.stdin.end() } catch { /* already gone */ }
    try { this.child.kill() } catch { /* already gone */ }
  }
}

async function acquire() {
  if (idle.length) {
    const worker = idle.pop()
    busy.add(worker)
    return worker
  }
  if (spawned < maxWorkers) {
    spawned++
    const worker = new Worker()
    busy.add(worker)
    return worker
  }
  // Every worker is busy; wait for one to come back rather than oversubscribing.
  await new Promise(resolve => { waiters.push(resolve) })
  return acquire()
}

function release(worker) {
  busy.delete(worker)
  if (worker.dead) { if (waiters.length) waiters.shift()(); return }
  const waiter = waiters.shift()
  if (waiter) { busy.add(worker); waiter(worker); return }
  idle.push(worker)
}

export async function encodeLosslessWebp({ source, target }) {
  const worker = await acquire()
  const id = nextJobId++
  try {
    const result = await worker.encode({ id, source, target })
    return { width: result.width, height: result.height, alphaClearedPixels: result.alphaClearedPixels }
  } finally {
    release(worker)
  }
}

/** Stops every worker. Scripts must call this or Node will not exit. */
export function shutdownEncoderPool() {
  for (const worker of [...idle, ...busy]) worker.shutdown()
  idle.length = 0
  busy.clear()
  spawned = 0
}

process.on('exit', shutdownEncoderPool)

/**
 * Runs jobs through a fixed pool. Each lossless encode is one single-threaded
 * worker process, so this limit is the real parallelism knob.
 */
export async function runPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}
