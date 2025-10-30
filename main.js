const { app, BrowserWindow, session, screen, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const express = require('express');
const getPort = require('get-port');

let serverInstance;

// Store display identifier to window mapping
const displayWindowMap = new Map();

// Configuration: Map display identifiers to video folder names
// Use display ID or resolution to distinguish between identical monitors
//
// YOUR DISPLAYS:
// Display ID 1133551107: QG241Y - 1920x1080 (landscape) at x:0, y:0
// Display ID 2528732444: QG241Y - 1080x1920 (portrait) at x:1920, y:-425
//
// Add your folder names below:
const DISPLAY_VIDEO_CONFIG = {
  // Option 1: Use Display ID (Most Stable - Recommended)
  // '1133551107': 'your_folder_name_here',    // Landscape monitor
  // '2528732444': 'your_folder_name_here',    // Portrait monitor

  // Option 2: Use resolution (works since your monitors have different resolutions)
  // '1920x1080': 'your_folder_name_here',     // Landscape
  // '1080x1920': 'your_folder_name_here',     // Portrait

  // Option 3: Use position
  // 'x0_y0': 'your_folder_name_here',         // Landscape
  // 'x1920_y-425': 'your_folder_name_here',   // Portrait
};

// Configuration: Map display identifiers to audio device names
// Leave empty to auto-detect or specify exact audio device names
const DISPLAY_AUDIO_CONFIG = {
  // Option 1: Use Display ID (Most Stable - Recommended)
  // '1133551107': 'UT222Q',              // Match audio device name from Windows
  // '2528732444': 'Acer UT220HQL',       // Match audio device name from Windows

  // Option 2: Use resolution
  // '1920x1080': 'UT222Q',
  // '1080x1920': 'Acer UT220HQL',

  // If left empty, the system will try to match display audio automatically
};

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

  console.log('=== Available Displays ===');
  displays.forEach((display, index) => {
    console.log(`Display ${index}:`);
    console.log(`  ID: ${display.id}`);
    console.log(`  Label: ${display.label}`);
    console.log(`  Bounds: ${JSON.stringify(display.bounds)}`);
    console.log(`  Size: ${display.size.width}x${display.size.height}`);
    console.log(`  Internal: ${display.internal}`);
  });

  // Use display 2 if available (index 1), otherwise use primary display
  const display1 = displays.length > 1 ? displays[0] : screen.getPrimaryDisplay();
  const display2 = displays.length > 1 ? displays[1] : screen.getPrimaryDisplay();

  // Create unique identifiers for each display
  // Priority: 1) Display ID (most stable), 2) Resolution, 3) Position
  const getDisplayIdentifier = (display) => {
    // Return multiple possible identifiers for matching
    return {
      id: String(display.id),
      resolution: `${display.size.width}x${display.size.height}`,
      position: `x${display.bounds.x}_y${display.bounds.y}`,
      label: display.label || 'Unknown'
    };
  };

  const display1Identifiers = getDisplayIdentifier(display1);
  const display2Identifiers = getDisplayIdentifier(display2);

  console.log(`\nCreating windows for:`);
  console.log(`  Window 1 -> ID:${display1Identifiers.id}, ${display1Identifiers.label}, ${display1Identifiers.resolution}, ${display1Identifiers.position}`);
  console.log(`  Window 2 -> ID:${display2Identifiers.id}, ${display2Identifiers.label}, ${display2Identifiers.resolution}, ${display2Identifiers.position}`);

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

  // Store the mapping of window to display identifiers
  displayWindowMap.set(window1.webContents.id, display1Identifiers);
  displayWindowMap.set(window2.webContents.id, display2Identifiers);

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
  
  // Add IPC handler to get display identifiers for a window
  ipcMain.handle('get-display-name', (event) => {
    const webContentsId = event.sender.id;
    const displayIdentifiers = displayWindowMap.get(webContentsId);
    console.log(`Window ${webContentsId} identifiers:`, displayIdentifiers);
    return displayIdentifiers;
  });

  ipcMain.handle('get-video-path', (event, { displayName, type, videoNumber }) => {
    const basePath = 'C:\\';
    const fs = require('fs');

    // displayName is actually the full identifiers object
    const identifiers = displayName;

    // Try to match configuration in priority order: ID -> Resolution -> Position -> Label
    let folderName;

    if (DISPLAY_VIDEO_CONFIG[identifiers.id]) {
      folderName = DISPLAY_VIDEO_CONFIG[identifiers.id];
      console.log(`Matched display by ID: ${identifiers.id} -> ${folderName}`);
    } else if (DISPLAY_VIDEO_CONFIG[identifiers.resolution]) {
      folderName = DISPLAY_VIDEO_CONFIG[identifiers.resolution];
      console.log(`Matched display by resolution: ${identifiers.resolution} -> ${folderName}`);
    } else if (DISPLAY_VIDEO_CONFIG[identifiers.position]) {
      folderName = DISPLAY_VIDEO_CONFIG[identifiers.position];
      console.log(`Matched display by position: ${identifiers.position} -> ${folderName}`);
    } else if (DISPLAY_VIDEO_CONFIG[identifiers.label]) {
      folderName = DISPLAY_VIDEO_CONFIG[identifiers.label];
      console.log(`Matched display by label: ${identifiers.label} -> ${folderName}`);
    } else {
      // Default: use display ID directly as folder name (no prefix)
      folderName = identifiers.id;
      console.log(`No config found, using Display ID as folder name: ${folderName}`);
    }

    // Construct the video path based on type
    let videoPath;
    if (type === 'default') {
      videoPath = path.join(basePath, `${folderName}_default`, 'video.mp4');
    } else { // trigger
      if (videoNumber) {
        // For numbered trigger videos: video1.mp4, video2.mp4, etc.
        videoPath = path.join(basePath, `${folderName}_trigger`, `video${videoNumber}.mp4`);

        // Check if file exists before returning
        if (!fs.existsSync(videoPath)) {
          console.log(`Video path for display ID:${identifiers.id} (${type}, video${videoNumber}): NOT FOUND`);
          return null; // Return null if file doesn't exist
        }
      } else {
        // Fallback to old behavior if no videoNumber specified
        videoPath = path.join(basePath, `${folderName}_trigger`, 'video.mp4');
      }
    }

    console.log(`Video path for display ID:${identifiers.id} (${type}${videoNumber ? ', video'+videoNumber : ''}): ${videoPath}`);
    return videoPath;
  });

  // Add IPC handler to get preferred audio device for a window
  ipcMain.handle('get-audio-device', (event) => {
    const webContentsId = event.sender.id;
    const displayIdentifiers = displayWindowMap.get(webContentsId);

    if (!displayIdentifiers) {
      console.log(`No display identifiers found for window ${webContentsId}`);
      return null;
    }

    // First check if there's a manual configuration
    let audioDeviceName = null;

    if (DISPLAY_AUDIO_CONFIG[displayIdentifiers.id]) {
      audioDeviceName = DISPLAY_AUDIO_CONFIG[displayIdentifiers.id];
      console.log(`Matched audio device by ID: ${displayIdentifiers.id} -> ${audioDeviceName}`);
    } else if (DISPLAY_AUDIO_CONFIG[displayIdentifiers.resolution]) {
      audioDeviceName = DISPLAY_AUDIO_CONFIG[displayIdentifiers.resolution];
      console.log(`Matched audio device by resolution: ${displayIdentifiers.resolution} -> ${audioDeviceName}`);
    } else if (DISPLAY_AUDIO_CONFIG[displayIdentifiers.position]) {
      audioDeviceName = DISPLAY_AUDIO_CONFIG[displayIdentifiers.position];
      console.log(`Matched audio device by position: ${displayIdentifiers.position} -> ${audioDeviceName}`);
    } else if (DISPLAY_AUDIO_CONFIG[displayIdentifiers.label]) {
      audioDeviceName = DISPLAY_AUDIO_CONFIG[displayIdentifiers.label];
      console.log(`Matched audio device by label: ${displayIdentifiers.label} -> ${audioDeviceName}`);
    } else {
      // AUTO-DETECT: Return display identifiers for dynamic matching in renderer
      console.log(`Auto-detecting audio device for display: ${displayIdentifiers.label}`);
      audioDeviceName = 'AUTO:' + displayIdentifiers.label;
    }

    return audioDeviceName;
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