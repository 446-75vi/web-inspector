document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const captureBtn = document.getElementById('captureBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const newCaptureBtn = document.getElementById('newCaptureBtn');
    const retryBtn = document.getElementById('retryBtn');
    
    const progressContainer = document.getElementById('progressContainer');
    const resultContainer = document.getElementById('resultContainer');
    const errorContainer = document.getElementById('errorContainer');
    
    const currentTask = document.getElementById('currentTask');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const errorMessage = document.getElementById('errorMessage');
    
    const htmlCount = document.getElementById('htmlCount');
    const cssCount = document.getElementById('cssCount');
    const jsCount = document.getElementById('jsCount');
    const otherCount = document.getElementById('otherCount');
    const totalSize = document.getElementById('totalSize');
    
    // State variables
    let captureInProgress = false;
    let captureResult = null;
    
    // Event Listeners
    captureBtn.addEventListener('click', startCapture);
    cancelBtn.addEventListener('click', cancelCapture);
    downloadBtn.addEventListener('click', downloadCapture);
    newCaptureBtn.addEventListener('click', resetUI);
    retryBtn.addEventListener('click', startCapture);
    
    // Function to start the capture process
    function startCapture() {
      if (captureInProgress) return;
      
      resetUI();
      captureInProgress = true;
      
      // Show progress container
      captureBtn.classList.add('hidden');
      progressContainer.classList.remove('hidden');
      
      // Get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const activeTab = tabs[0];
        
        // Send message to the background script to start capture
        chrome.runtime.sendMessage({
          action: 'startCapture',
          tabId: activeTab.id,
          url: activeTab.url,
          title: activeTab.title
        });
      });
    }
    
    // Function to cancel the capture process
    function cancelCapture() {
      if (!captureInProgress) return;
      
      chrome.runtime.sendMessage({ action: 'cancelCapture' });
      resetUI();
      showError('Capture canceled by user');
    }
    
    // Function to download the capture result
    function downloadCapture() {
      if (!captureResult) return;
      
      chrome.runtime.sendMessage({
        action: 'downloadCapture',
        captureId: captureResult.captureId
      });
    }
    
    // Function to reset the UI
    function resetUI() {
      captureInProgress = false;
      captureResult = null;
      
      // Hide all containers except the initial button
      progressContainer.classList.add('hidden');
      resultContainer.classList.add('hidden');
      errorContainer.classList.add('hidden');
      captureBtn.classList.remove('hidden');
      
      // Reset progress bar
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';
      currentTask.textContent = 'Starting capture...';
    }
    
    // Function to show error
    function showError(message) {
      captureBtn.classList.add('hidden');
      progressContainer.classList.add('hidden');
      resultContainer.classList.add('hidden');
      errorContainer.classList.remove('hidden');
      errorMessage.textContent = message;
    }
    
    // Function to update progress
    function updateProgress(data) {
      progressBar.style.width = data.percent + '%';
      progressPercent.textContent = data.percent + '%';
      currentTask.textContent = data.message;
    }
    
    // Function to show results
    function showResults(data) {
      captureResult = data;
      captureInProgress = false;
      
      progressContainer.classList.add('hidden');
      resultContainer.classList.remove('hidden');
      
      htmlCount.textContent = data.counts.html || 0;
      cssCount.textContent = data.counts.css || 0;
      jsCount.textContent = data.counts.js || 0;
      otherCount.textContent = data.counts.other || 0;
      
      // Format file size
      const size = formatFileSize(data.totalSize);
      totalSize.textContent = size;
    }
    
    // Function to format file size
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener(function(message) {
      switch (message.action) {
        case 'captureProgress':
          updateProgress(message.data);
          break;
        case 'captureComplete':
          showResults(message.data);
          break;
        case 'captureError':
          resetUI();
          showError(message.error);
          break;
      }
    });
  });