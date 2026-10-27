import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import workerd from 'workerd'

const cwd = import.meta.dirname
await build({
  absWorkingDir: cwd,
  entryPoints: ['worker.js'],
  outfile: 'dist/worker.js',
  bundle: true,
  format: 'esm',
  external: ['./addon.wasm'],
  logLevel: 'warning'
})

const child = spawn(workerd.default, ['serve', 'workerd.capnp'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
child.stdout.on('data', chunk => { log += chunk })
child.stderr.on('data', chunk => { log += chunk })

// GET /?n=N creates N wrapped objects; n=0 destroys the context. Returns the finalized count.
async function get (n) {
  const response = await fetch(`http://127.0.0.1:8787/?n=${n}`)
  return Number(await response.text())
}

try {
  // The first request also waits for workerd to start.
  for (let i = 0; ; i++) {
    try { await get(1); break } catch (error) {
      if (i === 100) throw error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  // A second request lets GC cleanup run outside a request context.
  await get(10000)
  const created = 1 + 10000
  const finalized = await get(0)

  console.log(`created=${created} finalizedAfterDestroy=${finalized}`)
  assert.match(log, /Disallowed operation called within global scope/, 'no workerd timer error: not reproduced')
  assert.ok(finalized < created, 'all finalizers ran: not reproduced')
  console.log('Reproduced: finalizers are stuck after the GC callback failed to schedule a timer')
} finally {
  child.kill()
}
