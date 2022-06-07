import { contextBridge, ipcMain, ipcRenderer } from "electron";

const $ipc: Registry = {};

type Namespace = Record<string, Function>;
type Registry = Record<string, Function | Namespace>;

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
    if (typeof fn !== "function") {
      continue;
    }
    const channel = namespace ? `${namespace}:${name}` : name;
    ipcMain.handle(channel, (event, ...args) => fn(...args));
  }
}

export function expose<T extends Namespace>(functions: (keyof T)[] | Namespace): void;
export function expose<T extends Registry>(functions: T): void;
export function expose<T>(
  functions: (keyof T)[] | Namespace | T
): void {
  if (functions instanceof Array) {
    for (const name of functions) {
      exposeFn(String(name));
    }
  } else {
    for (const [name, value] of Object.entries(functions)) {
      if (typeof value === "object") {
        for (const [fnName, fn] of Object.entries(value)) {
          if (typeof fn === "function") {
            exposeFn(fnName, name);
          }
        }
      } else if (typeof value === "function") {
        exposeFn(name);
      }
    }
  }

  contextBridge.exposeInMainWorld("$ipc", $ipc);
}

function exposeFn(name: string, namespace?: string) {
  const channel = namespace ? `${namespace}:${name}` : name;
  const invoker = (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  if (namespace) {
    $ipc[namespace] = { ...$ipc[namespace], [name]: invoker };
  } else {
    $ipc[name] = invoker;
  }
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
