---
title: null
layout: single
permalink: /visualisation/
---

<div id="ontology-graph"
     style="width:100%; height:800px; border:1px solid #e5e5e5;">
</div>

<!-- WebVOWL CSS -->
<link rel="stylesheet"
      href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">

<!-- Local D3 -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>

<!-- WebVOWL JS -->
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>

<script>
document.addEventListener("DOMContentLoaded", function () {
    webvowl.app().initialize({
        canvasSelector: "#ontology-graph",
        jsonUrl: "{{ '/assets/webvowl/data/ontology.json' | relative_url }}"
    });
});
</script>
