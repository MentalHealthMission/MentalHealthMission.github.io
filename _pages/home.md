---
title: "A Living Resource for Digital Markers"
layout: splash
permalink: /
hidden: true

header:
  overlay_color: "#000"
  overlay_filter: "0.5"
  overlay_image: /assets/images/home-image.jpg
  actions:
    - label: "<i class='fa-brands fa-github'></i> GitHub Repository"
      url: "https://github.com/MentalHealthMission/MHM-ontology"
  caption: "Photo credit: [**Unsplash**](https://unsplash.com)"
excerpt: >
  Facilitating reproducible research in digital mental health.<br />
intro: 
  - excerpt: "This project is suported by the *National Institute for Health and Care Research (NIHR) Mental Health Translational Research Collaboration (MH-TRC) Mission*."

feature_row:
  - image_path: /assets/images/undraw_documentation.png
    alt: "learn"
    title: "Learn"
    excerpt: "Discover how to use the digital markers ontology in your projects."
    url: "https://github.com/MentalHealthMission/MHM-ontology/tree/main/docs"
    btn_class: "btn--primary"
    btn_label: "Documentation"
  - image_path: /assets/images/undraw_file-search.png
    alt: "search"
    title: "Search"
    excerpt: "Navigate the digital markers library and search for digital markers of interest."
    url: "#test-link"
    btn_class: "btn--primary"
    btn_label: "Library (Soon)"
  - image_path: /assets/images/undraw_visualise.png
    alt: "visualise"
    title: "Visualise"
    excerpt: "Interact with the visualisation map to explore the ODIM-MH."
    url: "#test-link"
    btn_class: "btn--primary"
    btn_label: "Visualisation (Soon)"

use_case_1:
  - image_path: /assets/images/undraw_watch-application.png
    alt: "use case: connect"
    title: "Use Case: CONNECT Study"
    excerpt: 'The CONNECT project is a research study that uses digital markers collected from smartphones and wearable devices, such as Fitbit, to detect changes in the mental health of people experiencing psychosis. ODIM-MH aims to support CONNECT by defining standardized markers related to sleep, physical activity, social behavior, and other relevant domains. The ontology can also help standardize the pre-processing of raw digital data, transforming it into meaningful features. For example, raw geolocation data can be converted into measures such as the amount of time spent at home. These features can then be used in predictive models, such as models designed to predict relapse, making the results more robust and reproducible in the future.'
    url: "https://www.connectdigitalstudy.com/"
    btn_label: "Read More"
    btn_class: "btn--primary"

use_case_2:
  - image_path: /assets/images/undraw_phone.png
    alt: "use case 2"
    title: "Second Use Case"
    excerpt: 'Processus ordinatus sequitur fluxum primarium, ubi elementa corelis synchronizantur per nodos activi.
Configuratio statica permittit validatio parametri ante initium operandi.
Interfacia logica transit data securata inter stratum applicativum et fundamentum executionis.
Monitorium continuatum detectat anomalia minora et optimizat responsum temporale.'
    url: "#test-link"
    btn_label: "Read More"
    btn_class: "btn--primary"
---

{% include feature_row id="intro" type="center" %}

{% include feature_row %}

{% include feature_row id="use_case_1" type="right" %}

{% include feature_row id="use_case_2" type="left" %}

<div>
  <div style="width: 200px" class="align-left">
    <img src="/assets/images/manchester.png" alt="manchester">
  </div>
  <div style="width: 350px" class="align-right">
    <img src="/assets/images/nihr.jpg" alt="nihr">
  </div>
</div>
