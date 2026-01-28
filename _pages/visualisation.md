---
permalink: /visualisation/
layout: default
title: null
---

<div class="iframe-wrapper">
  <iframe 
    src="{{ '/assets/webvowl/index.html' | relative_url }}"
    title="ODIM-MH Ontology Visualization"
    frameborder="0"
    allowfullscreen>
  </iframe>
</div>

<style>
.iframe-wrapper {
  position: relative;
  width: 100%;
  height: 75vh;
  min-height: 500px;
  margin: 2rem auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.iframe-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

@media (max-width: 768px) {
  .iframe-wrapper {
    height: 60vh;
    min-height: 400px;
  }
}
</style>
