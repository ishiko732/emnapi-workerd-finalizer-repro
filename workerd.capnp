using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [(name = "main", worker = (
    modules = [
      (name = "worker.js", esModule = embed "dist/worker.js"),
      (name = "addon.wasm", wasm = embed "addon.wasm")
    ],
    compatibilityDate = "2026-10-01"
  ))],
  sockets = [(name = "http", address = "127.0.0.1:8787", http = (), service = "main")]
);
