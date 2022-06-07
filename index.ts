import { contextBridge, ipcMain, ipcRenderer } from "electron";
import "./global";

const $ipc: Record<string, Function | Namespace> = {};

type Namespace = Record<string, Function>;

export function register<T>(namespace: Namespace): void;
export function register<T>(namespace: string, functions: Namespace): void;
export function register<T>(
  namespace: string | Namespace,
  functions?: Namespace
): void {
  if (typeof namespace === "object") {
    functions = namespace;
    namespace = "";
  }

  for (const [name, fn] of Object.entries(functions!)) {
    const channel = namespace ? `${namespace}:${name}` : name;
    ipcMain.handle(channel, (event, ...args) => fn(...args));
  }
}

export function expose<T>(namespace: Namespace | string[]): void;
export function expose<T>(
  namespace: string,
  functions: Namespace | string[]
): void;
export function expose<T>(
  namespace: string | Namespace | string[],
  functions?: Namespace | string[]
): void {
  if (typeof namespace === "object") {
    functions = namespace;
    namespace = "";
  }

  for (const [name, fn] of Object.entries(functions!)) {
    const channel = namespace ? `${namespace}:${name}` : name;
    const invoker = (...args: any[]) => ipcRenderer.invoke(channel, ...args);
    if (namespace) {
      $ipc[namespace] = { ...$ipc[namespace], [name]: invoker };
    } else {
      $ipc[name] = invoker;
    }
  }

  contextBridge.exposeInMainWorld("$ipc", $ipc);
}

type Callback = (...args: any[]) => any;
export type ConnectResult<T extends Record<string, Callback>> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promise<ReturnType<T[K]>>;
};

export function connect<T extends Record<string, Callback>>(
  namespace = ""
): ConnectResult<T> {
  const functions = namespace ? window.$ipc[namespace] : window.$ipc;
  return functions as unknown as ConnectResult<T>;
}

export default {
  register,
  expose,
  connect,
};
