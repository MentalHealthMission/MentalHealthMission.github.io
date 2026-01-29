---
layout: default
title: "Visualisation"
permalink: /visualisation/
---

<style>
@media (max-width: 768px) {
  .page__content {
    padding: 0 !important;
  }
  
  #visualization-container {
    padding: 0 !important;
    height: calc(100vh - 100px) !important;
  }
}
</style>

<div id="visualization-container" style="padding: 0.5rem 0.5rem 0 0.5rem; margin: 0 auto; width: 100%; max-width: 100%; height: calc(100vh - 160px); box-sizing: border-box;">
  <iframe
    id="webvowl-iframe"
    src="{{ '/assets/webvowl/index.html' | relative_url }}"
    width="100%"
    height="100%"
    style="border: 1px solid #ddd; display: block; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
    frameborder="0"
  ></iframe>
</div>

<script>
// Close mobile menu on load
document.addEventListener('DOMContentLoaded', function() {
  if (window.innerWidth <= 768) {
    var toggleButton = document.querySelector('.greedy-nav__toggle');
    var hiddenLinks = document.querySelector('.hidden-links');
    
    if (hiddenLinks && hiddenLinks.classList.contains('hidden')) {
      // Menu is already closed
    } else if (toggleButton) {
      toggleButton.click();
    }
  }
});

// Wait for iframe to load and center ontology
document.getElementById('webvowl-iframe').addEventListener('load', function() {
  setTimeout(function() {
    try {
      var iframe = document.getElementById('webvowl-iframe');
      var iframeWindow = iframe.contentWindow;
      
      // Try multiple WebVOWL methods to center the graph
      if (iframeWindow.graph) {
        // Method 1: Use reset zoom/center function
        if (iframeWindow.graph.reset) {
          iframeWindow.graph.reset();
        }
        // Method 2: Use options to focus
        if (iframeWindow.graph.options && iframeWindow.graph.options().focusInspectedElement) {
          iframeWindow.graph.options().focusInspectedElement(true);
        }
        // Method 3: Trigger pause button (often centers the view)
        var pauseButton = iframeWindow.document.querySelector('#pause-button');
        if (pauseButton) {
          pauseButton.click();
          setTimeout(function() { pauseButton.click(); }, 100);
        }
      }
    } catch(e) {
      console.log('Could not auto-center: ', e);
    }
  }, 1500);
});
</script>
