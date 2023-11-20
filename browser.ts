import type { ConnectResult } from "./index";

export function connect<T>(namespace = ""): ConnectResult<T> {
  const functions = namespace ? window.$ipc[namespace] : window.$ipc;
  return functions as unknown as ConnectResult<T>;
}

export default {
  connect,
};
