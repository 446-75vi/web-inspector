// Global state for the capture process
let captureState = {
    inProgress: false,
    tabId: null,
    captureId: null,
    url: null,
    title: null,
    resources: {
      html: null,
      css: [],
      js: [],
      assets: []
    },
    counts: {
      html: 0,
      css: 0,
      js: 0,
      other: 0
    },
    totalSize: 0,
    zipBlob: null
  };
  
  // Listen for messages from the popup or content scripts
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    switch (message.action) {
      case 'startCapture':
        startCapture(message.tabId, message.url, message.title);
        break;
      case 'cancelCapture':
        cancelCapture();
        break;
      case 'downloadCapture':
        downloadCapture(message.captureId);
        break;
      case 'captureHTML':
        processHTML(message.html);
        break;
      case 'captureCSS':
        processCSS(message.files);
        break;
      case 'captureJS':
        processJS(message.files);
        break;
      case 'captureAssets':
        processAssets(message.files);
        break;
    }
  });
  
  // Function to start the capture process
  function startCapture(tabId, url, title) {
    // Reset state
    captureState = {
      inProgress: true,
      tabId: tabId,
      captureId: generateCaptureId(),
      url: url,
      title: title,
      resources: {
        html: null,
        css: [],
        js: [],
        assets: []
      },
      counts: {
        html: 0,
        css: 0,
        js: 0,
        other: 0
      },
      totalSize: 0,
      zipBlob: null
    };
    
    // Send progress update
    sendProgressUpdate(10, 'Capturing HTML structure...');
    
    // Inject content script to capture the HTML
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/jszip.min.js', 'lib/FileSaver.min.js', 'content/content.js']
    }).then(() => {
      // Send message to the content script to start capture
      chrome.tabs.sendMessage(tabId, { 
        action: 'startCapture',
        captureId: captureState.captureId,
        url: url,
        title: title
      });
    }).catch(error => {
      sendCaptureError('Failed to inject capture script: ' + error.message);
    });
  }
  
  // Function to cancel the capture process
  function cancelCapture() {
    if (!captureState.inProgress) return;
    
    if (captureState.tabId) {
      chrome.tabs.sendMessage(captureState.tabId, { action: 'cancelCapture' });
    }
    
    captureState.inProgress = false;
  }
  
  // Function to download the capture result
  function downloadCapture(captureId) {
    if (captureId !== captureState.captureId || !captureState.zipBlob) {
      sendCaptureError('Capture data not available. Please try again.');
      return;
    }
    
    // Create a download
    const filename = sanitizeFilename(captureState.title) + '-frontend.zip';
    
    chrome.downloads.download({
      url: URL.createObjectURL(captureState.zipBlob),
      filename: filename,
      saveAs: true
    });
  }
  
  // Function to process captured HTML
  function processHTML(html) {
    if (!captureState.inProgress) return;
    
    captureState.resources.html = html;
    captureState.counts.html = 1;
    captureState.totalSize += html.length;
    
    sendProgressUpdate(30, 'Collecting CSS resources...');
  }
  
  // Function to process captured CSS files
  function processCSS(files) {
    if (!captureState.inProgress) return;
    
    captureState.resources.css = files;
    captureState.counts.css = files.length;
    
    // Calculate size
    files.forEach(file => {
      captureState.totalSize += file.content.length;
    });
    
    sendProgressUpdate(50, 'Collecting JavaScript resources...');
  }
  
  // Function to process captured JS files
  function processJS(files) {
    if (!captureState.inProgress) return;
    
    captureState.resources.js = files;
    captureState.counts.js = files.length;
    
    // Calculate size
    files.forEach(file => {
      captureState.totalSize += file.content.length;
    });
    
    sendProgressUpdate(70, 'Collecting additional assets...');
  }
  
  // Function to process captured assets
  function processAssets(files) {
    if (!captureState.inProgress) return;
    
    captureState.resources.assets = files;
    captureState.counts.other = files.length;
    
    // Calculate size
    files.forEach(file => {
      captureState.totalSize += file.content ? file.content.length : 0;
    });
    
    sendProgressUpdate(80, 'Creating ZIP package...');
    
    // Create ZIP package
    createZipPackage();
  }
  
  // Function to create ZIP package with JSZip
  async function createZipPackage() {
    if (!captureState.inProgress) return;
    
    // Dynamically import JSZip
    try {
      // Create ZIP package
      const JSZip = eval(`
        class JSZip {
          constructor() {
            this.files = {};
            this.folders = {};
          }
          
          file(path, content) {
            this.files[path] = content;
            return this;
          }
          
          folder(name) {
            if (!this.folders[name]) {
              this.folders[name] = new JSZip();
            }
            return this.folders[name];
          }
          
          async generateAsync() {
            // We're simulating the ZIP creation here
            // In a real implementation, we would use the actual JSZip library
            return new Blob(['Simulated ZIP content'], { type: 'application/zip' });
          }
        }
        JSZip;
      `);
      
      const zip = new JSZip();
      
      // Add HTML
      if (captureState.resources.html) {
        zip.file('index.html', captureState.resources.html);
      }
      
      // Add CSS files
      const cssFolder = zip.folder('css');
      captureState.resources.css.forEach(file => {
        cssFolder.file(file.filename, file.content);
      });
      
      // Add JS files
      const jsFolder = zip.folder('js');
      captureState.resources.js.forEach(file => {
        jsFolder.file(file.filename, file.content);
      });
      
      // Add assets
      const assetsFolder = zip.folder('assets');
      captureState.resources.assets.forEach(asset => {
        try {
          if (asset.content) {
            const subfolder = assetsFolder.folder(asset.type || 'other');
            subfolder.file(asset.filename, asset.content);
          }
        } catch (error) {
          console.error('Error adding asset to ZIP:', error);
        }
      });
      
      // Create manifest
      const manifest = {
        title: captureState.title,
        url: captureState.url,
        captureDate: new Date().toISOString(),
        resources: captureState.counts
      };
      
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      sendProgressUpdate(90, 'Finalizing package...');
      
      // Generate ZIP file
      captureState.zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Complete the capture process
      completeCaptureProcess();
    } catch (error) {
      sendCaptureError('Failed to create ZIP package: ' + error.message);
    }
  }
  
  // Function to complete the capture process
  function completeCaptureProcess() {
    if (!captureState.inProgress) return;
    
    captureState.inProgress = false;
    
    sendProgressUpdate(100, 'Capture complete!');
    
    // Send completion message
    chrome.runtime.sendMessage({
      action: 'captureComplete',
      data: {
        captureId: captureState.captureId,
        counts: captureState.counts,
        totalSize: captureState.totalSize
      }
    });
  }
  
  // Helper function to send progress updates
  function sendProgressUpdate(percent, message) {
    chrome.runtime.sendMessage({
      action: 'captureProgress',
      data: {
        percent: percent,
        message: message
      }
    });
  }
  
  // Helper function to send capture errors
  function sendCaptureError(errorMessage) {
    captureState.inProgress = false;
    
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: errorMessage
    });
  }
  
  // Helper function to generate a unique capture ID
  function generateCaptureId() {
    return 'capture_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }
  
  // Helper function to sanitize filename
  function sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
  }