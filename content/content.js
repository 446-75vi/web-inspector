// State variables
let captureInProgress = false;
let captureId = null;
let baseUrl = '';

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.action) {
    case 'startCapture':
      startCapture(message.captureId, message.url);
      break;
    case 'cancelCapture':
      cancelCapture();
      break;
  }
});

// Function to start the capture process
async function startCapture(id, url) {
  if (captureInProgress) return;
  
  captureInProgress = true;
  captureId = id;
  baseUrl = url;
  
  try {
    // Step 1: Capture HTML
    const html = captureHTML();
    chrome.runtime.sendMessage({
      action: 'captureHTML',
      html: html
    });
    
    // Step 2: Capture CSS
    const cssFiles = await captureCSS();
    chrome.runtime.sendMessage({
      action: 'captureCSS',
      files: cssFiles
    });
    
    // Step 3: Capture JavaScript
    const jsFiles = await captureJS();
    chrome.runtime.sendMessage({
      action: 'captureJS',
      files: jsFiles
    });
    
    // Step 4: Capture assets (basic implementation)
    const assets = await captureAssets();
    chrome.runtime.sendMessage({
      action: 'captureAssets',
      files: assets
    });
    
  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: 'Error during capture: ' + error.message
    });
    
    captureInProgress = false;
  }
}

// Function to cancel the capture process
function cancelCapture() {
  captureInProgress = false;
  captureId = null;
}

// Function to capture HTML
function captureHTML() {
  // Get DOCTYPE
  const doctype = document.doctype;
  let doctypeString = '';
  
  if (doctype) {
    doctypeString = '<!DOCTYPE ' +
      doctype.name +
      (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
      (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
  }
  
  // Get HTML content
  const htmlContent = document.documentElement.outerHTML;
  
  // Combine DOCTYPE and HTML
  return doctypeString + htmlContent;
}

// Function to capture CSS
async function captureCSS() {
  const cssFiles = [];
  
  // Get inline styles
  const styleElements = document.querySelectorAll('style');
  styleElements.forEach((style, index) => {
    cssFiles.push({
      filename: `inline-style-${index}.css`,
      content: style.textContent,
      isInline: true
    });
  });
  
  // Get external stylesheets
  const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
  for (const link of linkElements) {
    const href = link.getAttribute('href');
    if (!href) continue;
    
    try {
      const absoluteUrl = new URL(href, document.baseURI).href;
      
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      
      const cssContent = await response.text();
      
      cssFiles.push({
        filename: getFilenameFromUrl(absoluteUrl, 'css'),
        content: cssContent,
        url: absoluteUrl,
        isInline: false
      });
    } catch (error) {
      console.error('Failed to fetch CSS:', href, error);
    }
  }
  
  return cssFiles;
}

// Function to capture JavaScript
async function captureJS() {
  const jsFiles = [];
  
  // Get inline scripts (excluding extension scripts)
  const scriptElements = document.querySelectorAll('script:not([src])');
  scriptElements.forEach((script, index) => {
    // Skip empty scripts or those that appear to be extension related
    if (!script.textContent || 
        script.textContent.includes('chrome-extension://') ||
        script.hasAttribute('data-extension-id')) {
      return;
    }
    
    jsFiles.push({
      filename: `inline-script-${index}.js`,
      content: script.textContent,
      isInline: true
    });
  });
  
  // Get external scripts
  const externalScripts = document.querySelectorAll('script[src]');
  for (const script of externalScripts) {
    const src = script.getAttribute('src');
    if (!src || src.includes('chrome-extension://')) continue;
    
    try {
      const absoluteUrl = new URL(src, document.baseURI).href;
      
      // Skip if it's a third-party script from a different domain
      // to avoid CORS issues (in real implementation, we'd handle this better)
      if (!isSameOrigin(absoluteUrl, baseUrl)) {
        jsFiles.push({
          filename: getFilenameFromUrl(absoluteUrl, 'js'),
          content: `// External script from ${absoluteUrl}\n// Note: Content not available due to CORS restrictions`,
          url: absoluteUrl,
          isInline: false,
          isExternal: true
        });
        continue;
      }
      
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      
      const jsContent = await response.text();
      
      jsFiles.push({
        filename: getFilenameFromUrl(absoluteUrl, 'js'),
        content: jsContent,
        url: absoluteUrl,
        isInline: false
      });
    } catch (error) {
      console.error('Failed to fetch JS:', src, error);
    }
  }
  
  return jsFiles;
}

// Function to capture assets (basic implementation)
async function captureAssets() {
  // This is a simplified implementation
  // In a real extension, we would capture images, fonts, etc.
  return [];
}

// Helper function to get filename from URL
function getFilenameFromUrl(url, defaultExt) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let filename = pathname.split('/').pop();
    
    // If no filename or it has no extension, create a default
    if (!filename || !filename.includes('.')) {
      const timestamp = Date.now();
      filename = `file-${timestamp}.${defaultExt}`;
    }
    
    // Clean the filename
    filename = filename.replace(/[^a-z0-9.]/gi, '_');
    
    return filename;
  } catch (e) {
    const timestamp = Date.now();
    return `file-${timestamp}.${defaultExt}`;
  }
}

// Helper function to check if URLs have the same origin
function isSameOrigin(url1, url2) {
  try {
    const origin1 = new URL(url1).origin;
    const origin2 = new URL(url2).origin;
    return origin1 === origin2;
  } catch (e) {
    return false;
  }
}