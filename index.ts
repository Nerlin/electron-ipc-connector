import { contextBridge, ipcMain, ipcRenderer } from "electron";

const $ipc: Record<string, Function | Namespace> = {};

type Namespace = Record<string, Function>;

export function register(namespace: Namespace): void;
export function register(namespace: string, functions: Namespace): void;
export function register(
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

export function expose<T extends Namespace>(
  namespace: Namespace | (keyof T)[]
): void;
export function expose<T extends Namespace>(
  namespace: string,
  functions: Namespace | (keyof T)[]
): void;
export function expose<T extends Namespace>(
  namespace: string | Namespace | (keyof T)[],
  functions?: Namespace | (keyof T)[]
): void {
  if (typeof namespace === "object") {
    functions = namespace;
    namespace = "";
  }

  for (const name of Object.keys(functions!)) {
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
  [K in keyof T]: (
    ...args: Parameters<T[K]>
  ) => ReturnType<T[K]> extends PromiseLike<infer R>
    ? ReturnType<T[K]>
    : Promise<ReturnType<T[K]>>;
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
