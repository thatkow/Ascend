(function () {
  const loader = document.getElementById('pageLoader');

  if (!loader) {
    return;
  }

  function removeLoader() {
    document.body.classList.add('page-loaded');

    window.setTimeout(() => {
      loader.remove();
    }, 250);
  }

  if (document.readyState === 'complete') {
    removeLoader();
  } else {
    window.addEventListener('load', removeLoader, { once: true });
  }
})();
