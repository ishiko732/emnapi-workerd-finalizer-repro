# Emnapi finalizers in workerd

Native finalizers never run, not even after `Context.destroy()`, once a GC
callback has tried to schedule a timer outside a workerd request context.

## Run

```sh
npm ci
npm test
```

`npm test` bundles `worker.js`, starts a local workerd on `127.0.0.1:8787`,
sends three requests, and stops workerd. It **succeeds only when the bug is
reproduced**:

```text
created=10001 finalizedAfterDestroy=0
Reproduced: finalizers are stuck after the GC callback failed to schedule a timer
```

workerd also logs:

```text
Uncaught Error: Disallowed operation called within global scope. ... setting a
timeout ... are not allowed within global scope.
```

Versions: `@emnapi/core` / `@emnapi/runtime` **2.0.0-beta.2**, `workerd`
**1.20261027.1**, compatibility date **2026-10-01** (no `nodejs_compat`).

## Files

- `addon.c`: `make()` returns an object wrapped with a finalizer that only
  increments a counter, exported as `finalized_count()`.
- `addon.wasm`: prebuilt `addon.c`.
- `worker.js`: `GET /?n=N` calls `make()` N times; `n=0` destroys the context.
  Both return the finalized count.
- `repro.js`: the automated reproduction.

At least two requests must run before the destroy: GC cleanup only fails when it
runs outside a request context.

## Cause

```text
FinalizationRegistry callback (no request context)
  -> Env.invokeFinalizerFromGC
  -> NodeEnv.enqueueFinalizer
  -> ctx.features.setImmediate -> setTimeout   // workerd throws
```

`enqueueFinalizer` sets `finalizationScheduled = true` and calls `ref()` before
scheduling. When scheduling throws, neither is undone. Later finalizers are
never scheduled, and the retained reference keeps `destroy()` from draining the
queue.

## Rebuild addon.wasm (optional)

With wasi-sdk (built here with clang 18.1.2):

```sh
E=node_modules/emnapi
$WASI_SDK_PATH/bin/clang --target=wasm32-wasi -O2 -I $E/include/node \
  addon.c $E/lib/wasm32-wasip1/libemnapi.a -mexec-model=reactor \
  -Wl,--export-table -Wl,--growable-table \
  -Wl,--export=malloc -Wl,--export=free \
  -Wl,--export=napi_register_wasm_v1 \
  -Wl,--export=node_api_module_get_api_version_v1 \
  -Wl,--export=emnapi_create_env -Wl,--export=emnapi_delete_env \
  -Wl,--export=finalized_count -Wl,--allow-undefined -o addon.wasm
```

SHA-256 of the supplied binary:
`8ac580d16673cc24e93cc542ef8060a1529749c1a4505798ba38bbd208cdc42c`
