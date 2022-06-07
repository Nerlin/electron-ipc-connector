# electron-ipc-connector

This is a module to reduce Electron boilerplate needed to expose functions from the main process to renderer processes.

## Install

`npm install electron-ipc-renderer`


## Usage

*main.js*

```typescript
import { register } from "electron-ipc-connector";
import fs from "fs/promises";
import path from "path";

export async function createMainWindow() {
  // Create the main window for your application
  const mainWindow = new BrowserWindow({
    minWidth: 1024,
    minHeight: 400,
    webPreferences: {
      // Enable context isolation and disable node integration for security
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      
      // 
      preload: path.resolve(path.join(__dirname, "preload.js")),
      webSecurity: true
    },
  });
  
  // Before loading the renderer code, 
  // register all callbacks that you want to expose from the main process.
  
  // Keep in mind name collisions.
  // It's not recommended to register and expos whole NodeJS modules for security reasons.
  register(fs);
  register(path);
  
  // You can register functions for specific namespaces to avoid name collisions.
  register("my-namespace", {
    helloWorld
  });
  
  // Start loading the renderer process.
  // This will run the preload script.
  await mainWindow.loadURL(`file://${__dirname}/public/index.html`);
}

function helloWorld() {
  return "Hello, world!";
}
```

*preload.js*

```typescript
import { expose } from "electron-ipc-connector";
import fs from "fs/promises";
import path from "path";
import { helloWorld } from "./main";

// You have to call `expose` once in the preload script with all functions and namespaces 
// that you want to use from the renderer process.
expose({
  fs,
  path,
  "my-namespace": {
    helloWorld
  }
})
```

*app.js*

```typescript
import { connect } from "electron-ipc-connector";

// Get functions to communicate with my-namespace in the main process.
// This callback returns a promise with resolved values 
// from `helloWorld` function declared in `main.js`.
const { helloWorld } = connect("my-namespace");

document.addEventListener("DOMContentLoaded", async () => {
  const message = await helloWorld();
  
  // Prints "Hello, world!"
  console.log(message);
});
```