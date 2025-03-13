// src/main.js

// 1) Import the <rh-tag> and <rh-icon> custom elements from @rhds/elements.
//    This ensures both elements are defined for use in your HTML.
import '@rhds/tokens/css/global.css';
import '@rhds/elements/rh-icon/rh-icon.js';
import '@rhds/elements/rh-tag/rh-tag.js';

// 2) Simple console message so you know the bundle is loaded.
console.log('Bundle loaded.');

// 3) Wait for the HTML DOM to be fully parsed before attaching event listeners.
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded; attaching click handlers.');

  // 4) Attach event listeners for table rows with the "clickable" class.
  //    This toggles visibility of the *next* row (e.g., process details).
  document.querySelectorAll('.clickable').forEach((row) => {
    row.addEventListener('click', () => {
      const nextRow = row.nextElementSibling;
      if (nextRow) {
        nextRow.classList.toggle('hidden');
      }
    });
  });

  // 5) Provide a global "toggleGroup()" function so your HTML can call it
  //    to expand/collapse sub-tables by ID.
  window.toggleGroup = function toggleGroup(groupId) {
    const groupTable = document.getElementById(groupId);
    if (groupTable) {
      groupTable.classList.toggle('hidden');
    }
  };
});