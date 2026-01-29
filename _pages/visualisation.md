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
    
    if (hiddenLinks && !hiddenLinks.classList.contains('hidden')) {
      if (toggleButton) toggleButton.click();
    }
  }
});

// Center the graph after iframe loads
document.getElementById('webvowl-iframe').addEventListener('load', function() {
  setTimeout(function() {
    try {
      var iframe = document.getElementById('webvowl-iframe');
      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // WebVOWL 1.1.4 - click the reset/center button
      var resetButton = iframeDoc.querySelector('#reset-button');
      
      if (resetButton) {
        resetButton.click();
        console.log('Graph centered via reset button');
      }
    } catch(e) {
      console.log('Could not auto-center: ', e);
    }
  }, 2500); // Longer delay for WebVOWL 1.1.4 to fully load
});
</script>
