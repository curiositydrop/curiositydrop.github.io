'use strict';
const toast = document.getElementById('toast');
let timer;
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => toast.hidden = true, 1800);
});
