(function () {
  var trigger = document.getElementById('menu-trigger');
  var drawer = document.getElementById('menu-drawer');
  var overlay = document.querySelector('.menu-overlay');

  function openMenu() {
    trigger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    overlay.classList.add('open');
    // Focus the first focusable element in the drawer
    var first = drawer.querySelector('select, input, button, a');
    if (first) first.focus();
  }

  function closeMenu() {
    trigger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    trigger.focus();
  }

  function isOpen() {
    return trigger.getAttribute('aria-expanded') === 'true';
  }

  trigger.addEventListener('click', function () {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      closeMenu();
    }
  });

  // Trap focus within drawer when open
  drawer.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusable = drawer.querySelectorAll('select, input, button, a, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
