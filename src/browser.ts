import type { ConnectResult } from "./index";
import type EventEmitter from "events";

type Callback = (...args: any[]) => any;
type Namespace = Record<string, Callback | EventEmitter>;

export function connect<T>(namespace = ""): ConnectResult<T> {
  const functions = namespace ? window.$ipc[namespace] : window.$ipc;
  return functions as unknown as ConnectResult<T>;
}

declare global {
  export interface Window {
    $ipc: Record<string, Function | Namespace>;
  }

  export const $ipc: Record<string, Function | Namespace>;
}

export default {
  connect,
};
