// Iframe + preview-safe service worker registration.
// Lovable previews run inside an iframe and on id-preview hosts; never register there.
(function () {
  try {
    var inIframe = false;
    try { inIframe = window.self !== window.top; } catch (e) { inIframe = true; }
    var host = window.location.hostname;
    var isPreview = host.includes("id-preview--") || host.includes("lovableproject.com") || host.includes("lovable.app");

    if (inIframe || isPreview) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (r) { r.unregister(); });
        }).catch(function () {});
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      });
    }
  } catch (e) {}
})();
