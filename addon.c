#include <node_api.h>

static int finalized;
int finalized_count(void) { return finalized; }

static void finalize(napi_env env, void *data, void *hint) { finalized++; }

static napi_value make(napi_env env, napi_callback_info info) {
  napi_value object;
  napi_create_object(env, &object);
  napi_wrap(env, object, NULL, finalize, NULL, NULL);
  return object;
}

NAPI_MODULE_INIT() {
  napi_value fn;
  napi_create_function(env, "make", NAPI_AUTO_LENGTH, make, NULL, &fn);
  napi_set_named_property(env, exports, "make", fn);
  return exports;
}
