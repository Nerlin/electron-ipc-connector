# electron-ipc-connector

This is a module to reduce Electron boilerplate needed to expose functions from the main process to renderer processes.

## Install

`npm install electron-ipc-connector`


## Usage

*main.js*

```typescript
import { register } from "electron-ipc-connector";
import fs from "fs/promises";
import path from "path";
import EventEmitter from "events";

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
  
  // You can also pass EventEmitter instances instead of functions.
  // The renderer process can subscribe to these emitters using `on` and `once` methods.
  const events = new EventEmitter();
  register("my-events", events);
  
  // This will notify all `my-message` listeners in the renderer process.
  events.emit("my-message", "Hello, listener!");
  
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

// You have to call `expose` once in the preload script to 
// attach registered functions and event emitters to the renderer process.
expose()
```

*app.js*

```typescript
import { connect } from "electron-ipc-connector/browser";

// Get functions to communicate with my-namespace in the main process.
// This callback returns a promise with resolved values 
// from `helloWorld` function declared in `main.js`.
const { helloWorld } = connect("my-namespace");

document.addEventListener("DOMContentLoaded", async () => {
  const message = await helloWorld();
  
  // Prints "Hello, world!"
  console.log(message);
});


// Get event emitters to subscribe to main process events.
// This returns an object with `on` and `once` methods which results can
// be used to remove the attached event handler.
const events = connect("my-events");

let stopListening;

const startButton = document.querySelector("#start");
startButton.addEventListener("click", () => {
  // Attaches an event handler to `my-message` event:
  // When the `emit` method will be called in the main process,
  // this will notify all attached listeners in the renderer process.
  // Returns a callback which can be used to stop listening to events.
  stopListening = events.on("my-message", (message) => {
    console.log(event);
  });
});

const stopButton = document.querySelector("#stop");
stopButton.addEventListener("click", () => {
  stopListening();
});
```