import wasm from './addon.wasm'
import { instantiateAddonSync } from '@emnapi/core'
import { createContext } from '@emnapi/runtime'

const context = createContext()
const { addonModule, instance } = instantiateAddonSync(wasm, {
  context,
  beforeInit ({ instance }) { instance.exports._initialize() }
})

export default {
  fetch (request) {
    const n = Number(new URL(request.url).searchParams.get('n'))
    for (let i = 0; i < n; i++) addonModule.exports.make()
    if (!n) context.destroy()
    return new Response(String(instance.exports.finalized_count()))
  }
}
