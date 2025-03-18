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
          func: getPageContent
        }).then(results => {
          // The results come back as an array of injections
          if (results && results[0] && results[0].result) {
            const pageContent = results[0].result;
            
            // Create JSON file download
            const jsonString = JSON.stringify(pageContent, null, 2);
            const blob = new Blob([jsonString], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            // Generate filename from page title or URL
            const title = tabs[0].title || 'webpage';
            const filename = sanitizeFilename(title) + '.json';
            
            // Trigger download
            chrome.downloads.download({
              url: url,
              filename: filename,
              saveAs: true
            });
            
            // Show success message
            status.textContent = 'Download started!';
            status.className = 'success';
          } else {
            status.textContent = 'Error: No data returned from page';
            status.className = 'error';
          }
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
    try {
      // Function to recursively extract element data with basic info only
      function extractElementData(element, depth = 0) {
        if (!element) return null;
        
        // Basic element data
        const elementData = {
          tagName: element.tagName ? element.tagName.toLowerCase() : 'text',
          nodeType: element.nodeType,
          depth: depth
        };
        
        // Add classes if present
        if (element.className && typeof element.className === 'string' && element.className.trim()) {
          elementData.classes = element.className.split(' ').filter(c => c.trim().length > 0);
        } else {
          elementData.classes = [];
        }
        
        // Add ID if present
        if (element.id) {
          elementData.id = element.id;
        }
        
        // Text content for text nodes
        if (element.nodeType === 3 && element.textContent && element.textContent.trim()) {
          elementData.textContent = element.textContent.trim();
        }
        
        // Get basic attributes
        if (element.attributes && element.attributes.length) {
          elementData.attributes = {};
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr.name !== 'class' && attr.name !== 'id') {
              elementData.attributes[attr.name] = attr.value;
            }
          }
        }
        
        // Process children
        if (element.childNodes && element.childNodes.length) {
          elementData.children = [];
          for (let i = 0; i < element.childNodes.length; i++) {
            const childNode = element.childNodes[i];
            
            // Skip empty text nodes
            if (childNode.nodeType === 3 && (!childNode.textContent || !childNode.textContent.trim())) {
              continue;
            }
            
            const childData = extractElementData(childNode, depth + 1);
            if (childData) {
              elementData.children.push(childData);
            }
          }
        }
        
        return elementData;
      }
      
      // Extract meta information
      function extractMetaInfo() {
        const metaInfo = {
          title: document.title || '',
          url: window.location.href || '',
          metaTags: {}
        };
        
        // Extract meta tags
        try {
          const metaTags = document.querySelectorAll('meta');
          metaTags.forEach(tag => {
            if (tag.name) {
              metaInfo.metaTags[tag.name] = tag.content;
            } else if (tag.getAttribute('property')) {
              metaInfo.metaTags[tag.getAttribute('property')] = tag.content;
            }
          });
        } catch (e) {
          metaInfo.metaTagsError = e.toString();
        }
        
        return metaInfo;
      }
      
      // Extract class stats
      function extractClassStats() {
        const classData = {};
        
        try {
          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(' ').filter(c => c.trim().length > 0);
              classes.forEach(cls => {
                if (!classData[cls]) {
                  classData[cls] = { count: 0, elements: [] };
                }
                classData[cls].count++;
                if (!classData[cls].elements.includes(el.tagName.toLowerCase())) {
                  classData[cls].elements.push(el.tagName.toLowerCase());
                }
              });
            }
          });
        } catch (e) {
          return { error: e.toString() };
        }
        
        return classData;
      }
      
      // Extract resource information
      function extractResources() {
        const resources = {
          scripts: [],
          styles: [],
          images: []
        };
        
        try {
          // Scripts
          const scripts = document.querySelectorAll('script[src]');
          scripts.forEach(script => {
            resources.scripts.push(script.src);
          });
          
          // Styles
          const styles = document.querySelectorAll('link[rel="stylesheet"]');
          styles.forEach(style => {
            resources.styles.push(style.href);
          });
          
          // Images
          const images = document.querySelectorAll('img[src]');
          images.forEach(img => {
            resources.images.push(img.src);
          });
        } catch (e) {
          return { error: e.toString() };
        }
        
        return resources;
      }
      
      // Build the result object with basic page data
      const pageData = {
        meta: extractMetaInfo(),
        classStats: extractClassStats(),
        resources: extractResources()
      };
      
      // Add the DOM structure (this is the most complex part)
      try {
        pageData.domStructure = extractElementData(document.documentElement);
      } catch (e) {
        pageData.domError = e.toString();
      }
      
      return pageData;
    } catch (mainError) {
      // Return error information if something goes wrong
      return {
        error: mainError.toString(),
        stack: mainError.stack
      };
    }
  }