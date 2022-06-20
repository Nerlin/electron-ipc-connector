import type { IpcMainInvokeEvent } from "electron";

let registry: Registry = {};
let attached = false;

type Callback = (...args: any[]) => any;
type Namespace = Record<string, Callback>;
type Registry = Record<string, Callback | Namespace>;
type RegisteredNames = Array<FunctionName | [NamespaceName, FunctionName[]]>;
type FunctionName = string;
type NamespaceName = string;

export function register(namespace: Namespace): void;
export function register(namespace: string, functions: Namespace): void;
export function register(
  namespace: string | Namespace,
  functions?: Namespace
): void {
  if (typeof namespace === "object") {
    functions = namespace;
    namespace = "";

    registry = {...registry, ...functions};
  } else if (functions) {
    registry[namespace] = functions;
  }

  const { ipcMain } = require("electron");
  for (const [name, fn] of Object.entries(functions!)) {
    if (typeof fn !== "function") {
      continue;
    }
    const channel = namespace ? `${namespace}:${name}` : name;
    ipcMain.handle(
      channel,
      (event: IpcMainInvokeEvent, ...args: Parameters<typeof fn>) => fn(...args)
    );
  }

  if (!attached) {
    ipcMain.on("$ipc-sync", (event) => {
      const names: RegisteredNames = [];
      for (const [name, value] of Object.entries(registry)) {
        if (typeof value === "object") {
          const namespace: string[] = [];
          for (const [fnName, fn] of Object.entries(value)) {
            if (typeof fn === "function") {
              namespace.push(fnName);
            }
          }
          names.push([name, namespace]);
        } else {
          names.push(name);
        }
      }
      event.returnValue = JSON.stringify(names);
    });
    attached = true;
  }
}

export function expose(): void {
  const { contextBridge, ipcRenderer } = require("electron");

  const json = ipcRenderer.sendSync("$ipc-sync");
  const names: RegisteredNames = JSON.parse(json);
  const ipc: Registry = {};

  for (const name of names) {
    if (typeof name === "string") {
      exposeFn(ipc, name);
    } else if (typeof name === "object") {
      const [namespace, functions] = name;
      for (const fnName of functions) {
        exposeFn(ipc, fnName, namespace);
      }
    }
  }

  contextBridge.exposeInMainWorld("$ipc", ipc);
}


function exposeFn(ipc: Registry, name: string, namespace?: string) {
  const channel = namespace ? `${namespace}:${name}` : name;
  const { ipcRenderer } = require("electron");

  const invoker = (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  if (namespace) {
    ipc[namespace] = { ...ipc[namespace], [name]: invoker };
  } else {
    ipc[name] = invoker;
  }
}

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
