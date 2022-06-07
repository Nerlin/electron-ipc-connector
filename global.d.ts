import { Namespace } from "./index";

declare global {
  export interface Window {
    $ipc: Record<string, Function | Namespace>;
  }

  export const $ipc: Record<string, Function | Namespace>;
}
