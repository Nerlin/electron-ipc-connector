import type { IpcMainInvokeEvent, IpcRendererEvent } from "electron";
import EventEmitter from "events";

let registry: Registry = {};
let attached = false;

type Callback = (...args: any[]) => any;
type Namespace = Record<string, Callback | EventEmitter>;
type Registry = Record<string, Callback | EventEmitter | Namespace>;
type RendererRegistry = Record<string, Callback | IpcEventEmitter | RendererNamespace>;
type RendererNamespace = Record<string, Callback | IpcEventEmitter>;

interface IpcEventEmitter {
  on(event: string, listener: Callback): RemoveEventListener;
  once(event: string, listener: Callback): RemoveEventListener;
}
type RemoveEventListener = () => void;

type RegisteredNames = Array<RegisteredFunction | RegisteredEvents | RegisteredNamespace>;
type RegisteredFunction = { type: "function"; name: string };
type RegisteredEvents = { type: "events"; name: string };
type RegisteredNamespace = {
  type: "namespace";
  name: string;
  values: Array<RegisteredFunction | RegisteredEvents>;
};

export function register(namespace: Namespace): void;
export function register(namespace: string, functions: Namespace): void;
export function register(namespace: string | Namespace, functions?: Namespace): void {
  if (typeof namespace === "object") {
    functions = namespace;
    namespace = "";

    registry = { ...registry, ...functions };
  } else if (functions) {
    registry[namespace] = functions;
  }

  for (const [name, entry] of Object.entries(functions!)) {
    if (entry instanceof EventEmitter) {
      registerEventEmitter(entry, name, namespace);
    }

    if (typeof entry !== "function") {
      continue;
    }

    registerHandler(entry, name, namespace);
  }

  if (!attached) {
    attachExposer();
    attached = true;
  }
}

function registerEventEmitter(entry: EventEmitter, name: string, namespace?: string): void {
  const originalEmit = entry.emit.bind(entry);
  entry.emit = (eventName: string, ...args: any[]) => {
    const eventChannel = createEventChannel(eventName, name, namespace);
    sendEvent(eventChannel, ...args);

    return originalEmit(eventName, ...args);
  };
}

function createEventChannel(eventName: string, entryName: string, namespace?: string): string {
  const channel = createHandlerChannel(entryName, namespace);
  return `${channel}::${eventName}`;
}

function sendEvent(channel: string, ...args: any[]): void {
  const { webContents } = require("electron");
  for (const webContent of webContents.getAllWebContents()) {
    webContent.send(channel, ...args);
  }
}

function registerHandler(entry: Callback, name: string, namespace?: string): void {
  const { ipcMain } = require("electron");

  const channel = createHandlerChannel(name, namespace);
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: Parameters<typeof entry>) => entry(...args));
}

function createHandlerChannel(fnName: string, namespace?: string): string {
  return namespace ? `${namespace}:${fnName}` : fnName;
}

function attachExposer() {
  const { ipcMain } = require("electron");
  ipcMain.on("$ipc-sync", (event) => {
    const names: RegisteredNames = [];
    for (const [name, value] of Object.entries(registry)) {
      if (value instanceof EventEmitter) {
        names.push({ type: "events", name });
      } else if (typeof value === "object") {
        const namespace: Array<RegisteredFunction | RegisteredEvents> = [];
        for (const [fnName, fn] of Object.entries(value)) {
          if (typeof fn === "function") {
            namespace.push({ type: "function", name: fnName });
          } else {
            namespace.push({ type: "events", name: fnName });
          }
        }
        names.push({ type: "namespace", name, values: namespace });
      } else {
        names.push({ type: "function", name });
      }
    }
    event.returnValue = JSON.stringify(names);
  });
}

export function expose(): void {
  const { contextBridge, ipcRenderer } = require("electron");

  const json = ipcRenderer.sendSync("$ipc-sync");
  const entries: RegisteredNames = JSON.parse(json);
  const ipc: RendererRegistry = {};

  for (const entry of entries) {
    if (entry.type === "function") {
      exposeFn(ipc, entry.name);
    } else if (entry.type === "events") {
      exposeEvents(ipc, entry.name);
    } else if (entry.type === "namespace") {
      for (const namespaceEntry of entry.values) {
        if (namespaceEntry.type === "function") {
          exposeFn(ipc, namespaceEntry.name, entry.name);
        } else if (namespaceEntry.type === "events") {
          exposeEvents(ipc, namespaceEntry.name, entry.name);
        }
      }
    }
  }

  contextBridge.exposeInMainWorld("$ipc", ipc);
}

function exposeFn(ipc: RendererRegistry, name: string, namespace?: string) {
  const channel = namespace ? `${namespace}:${name}` : name;
  const { ipcRenderer } = require("electron");

  const invoker = (...args: any[]) => ipcRenderer.invoke(channel, ...args);
  if (namespace) {
    ipc[namespace] = { ...ipc[namespace], [name]: invoker };
  } else {
    ipc[name] = invoker;
  }
}

function exposeEvents(ipc: RendererRegistry, name: string, namespace?: string) {
  const { ipcRenderer } = require("electron");

  const emitter: IpcEventEmitter = {
    on: (eventName: string, listener: Callback) => {
      const proxy = (event: IpcRendererEvent, ...args: any[]) => listener(...args);

      ipcRenderer.on(createEventChannel(eventName, name, namespace), proxy);
      return () => {
        ipcRenderer.off(createEventChannel(eventName, name, namespace), proxy);
      };
    },
    once: (eventName: string, listener: Callback) => {
      const proxy = (event: IpcRendererEvent, ...args: any[]) => listener(...args);

      ipcRenderer.once(createEventChannel(eventName, name, namespace), proxy);
      return () => {
        ipcRenderer.off(createEventChannel(eventName, name, namespace), proxy);
      };
    },
  };
  if (namespace) {
    ipc[namespace] = { ...ipc[namespace], [name]: emitter };
  } else {
    ipc[name] = emitter;
  }
}

export type ConnectResult<T> = {
  [K in keyof T]: T[K] extends EventEmitter
    ? IpcEventEmitter
    : T[K] extends Callback
    ? (
        ...args: Parameters<T[K]>
      ) => ReturnType<T[K]> extends PromiseLike<infer R> ? ReturnType<T[K]> : Promise<ReturnType<T[K]>>
    : never;
};

export function connect<T>(namespace = ""): ConnectResult<T> {
  const functions = namespace ? window.$ipc[namespace] : window.$ipc;
  return functions as unknown as ConnectResult<T>;
}

export default {
  register,
  expose,
  connect,
};
