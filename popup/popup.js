document.addEventListener('DOMContentLoaded', function() {
    const captureBtn = document.getElementById('captureBtn');
    const status = document.getElementById('status');
    
    captureBtn.addEventListener('click', function() {
      // Show processing status
      status.textContent = 'Processing...';
      status.className = '';
      
      // Get the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        // Execute script to get page content
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: getPageContent
        }).then(results => {
          // The results come back as an array of injections
          const pageContent = results[0].result;
          
          // Create HTML file download
          const blob = new Blob([pageContent.html], {type: 'text/html'});
          const url = URL.createObjectURL(blob);
          
          // Generate filename from page title or URL
          const title = tabs[0].title || 'webpage';
          const filename = sanitizeFilename(title) + '.html';
          
          // Trigger download
          chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
          });
          
          // Show success message
          status.textContent = 'Download started!';
          status.className = 'success';
        }).catch(error => {
          // Show error message
          status.textContent = 'Error: ' + error.message;
          status.className = 'error';
          console.error(error);
        });
      });
    });
    
    // Function to sanitize filename
    function sanitizeFilename(filename) {
      return filename
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
    }
  });
  
  // This function runs in the context of the page
  function getPageContent() {
    // Get DOCTYPE
    const doctype = document.doctype;
    let doctypeString = '';
    
    if (doctype) {
      doctypeString = '<!DOCTYPE ' +
        doctype.name +
        (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
        (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
    }
    
    // Get complete HTML
    const htmlContent = document.documentElement.outerHTML;
    
    // Return the complete page content
    return {
      html: doctypeString + htmlContent
    };
  }