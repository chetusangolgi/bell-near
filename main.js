const { app, BrowserWindow, session, screen, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const express = require('express');
const getPort = require('get-port');

let serverInstance;

/**
 * Creates and starts a local Express server to host the application files.
 * This mimics the behavior of `python -m http.server` and is required
 * for the Teachable Machine library to load models correctly.
 */
async function initialize() {
  // **RELIABILITY FIX:** Force the audio sample rate to match the model's expectation.
  // This switch tells the underlying Chromium engine to request audio at 44.1kHz.
  app.commandLine.appendSwitch('force-webaudio-audiosource-samplerate', '44100');

  // **AUDIO CONTEXT FIX:** Allow audio context to start without user gesture
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

  // **MICROPHONE FIX:** Enable media stream features
  app.commandLine.appendSwitch('enable-features', 'MediaStreamTrackUseConfigMaxFrameRate');

  // **MICROPHONE ALWAYS ON:** Disable permission prompts and enable auto-grant
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  app.commandLine.appendSwitch('enable-usermedia-screen-capturing');

  // **SECURITY FIX:** Treat localhost as secure origin
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://localhost');

  const expressApp = express();
  // Serve all files in the 'app' directory
  expressApp.use(express.static(path.join(__dirname, 'app')));

  const port = await getPort();

  // Create a promise that resolves when the server is successfully started
  const serverReadyPromise = new Promise(resolve => {
    serverInstance = expressApp.listen(port, () => {
      resolve(port); // Resolve the promise with the port number
    });
  });

  // Wait for the server to be ready
  const readyPort = await serverReadyPromise;

  // Once the server is running, create the application window
  createWindows(readyPort);
}

/**
 * Creates the main application windows.
 * @param {number} port The port the internal server is running on.
 */
function createWindows(port) {
  // Get all available displays
  const displays = screen.getAllDisplays();

  // Use display 2 if available (index 1), otherwise use primary display
  const display1 = displays.length > 1 ? displays[0] : screen.getPrimaryDisplay();
  const display2 = displays.length > 1 ? displays[1] : screen.getPrimaryDisplay();

  const { x: x1, y: y1, width: width1, height: height1 } = display1.bounds;

  const window1 = new BrowserWindow({
    x: x1,
    y: y1,
    width: width1,
    height: height1,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'app', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable media access
      enableRemoteModule: false,
      // Allow audio autoplay
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const { x: x2, y: y2, width: width2, height: height2 } = display2.bounds;

  const window2 = new BrowserWindow({
    x: x2,
    y: y2,
    width: width2,
    height: height2,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'app', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable media access
      enableRemoteModule: false,
      // Allow audio autoplay
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // Load the application from the local server
  window1.loadURL(`http://localhost:${port}`);
  window2.loadURL(`http://localhost:${port}/index1.html`);

  // Remove the default menu bar
  window1.setMenu(null);
  window2.setMenu(null);

  // Automatically approve microphone permission requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      return callback(true);
    }
    return callback(false);
  });

  // Grant media permissions by default
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
        return true;
      }
      return false;
    });
  }
  
  ipcMain.handle('get-video-path', (event, { screen, type }) => {
    const isDev = process.env.NODE_ENV !== 'production';
    console.log('isDev:', isDev);
    console.log('app.getPath(exe):', app.getPath('exe'));
    const basePath = 'C:\\';
    console.log('basePath:', basePath);

    let videoPath;
    if (screen === 1) {
      if (type === 'default') {
        videoPath = path.join(basePath, 'default1', 'video.mp4');
      } else { // trigger
        videoPath = path.join(basePath, 'trigger1', 'video.mp4');
      }
    } else { // screen 2
      if (type === 'default') {
        videoPath = path.join(basePath, 'default2', 'video.mp4');
      } else { // trigger
        videoPath = path.join(basePath, 'trigger2', 'video.mp4');
      }
    }
    console.log('videoPath:', videoPath);
    return videoPath;
  });  // Ensure the server is shut down when the app quits
app.on('will-quit', () => {
  if (serverInstance) {
    serverInstance.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initialize();
  }
});

// Start the server and create the window when Electron is ready
app.whenReady().then(() => {
  // Register a custom protocol to serve local video files
  protocol.registerFileProtocol('local-video', (request, callback) => {
    const url = request.url.substr('local-video://'.length);
    callback({ path: path.normalize(decodeURI(url)) });
  });

  initialize();
});