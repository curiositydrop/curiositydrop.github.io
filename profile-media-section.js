import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const profileId = new URLSearchParams(location.search).get('id');

function youtubeId(url = '') {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return match?.[1] || '';
}
function vimeoId(url = '') {
  const match = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] || '';
}
function embedUrl(url = '') {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}`;
  return '';
}
function renderItem(item) {
  const card = document.createElement('article');
  card.className = 'profile-media-item';
  if (item.type === 'image' && item.url) {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.caption || 'Profile media image';
    img.loading = 'lazy';
    card.appendChild(img);
  } else if (item.type === 'video' && item.url) {
    const src = embedUrl(item.url);
    if (!src) return null;
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = item.caption || 'Profile video';
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    card.appendChild(frame);
  } else return null;
  if (item.caption) {
    const caption = document.createElement('p');
    caption.textContent = item.caption;
    card.appendChild(caption);
  }
  return card;
}

if (profileId) {
  const style = document.createElement('style');
  style.textContent = `
    #profile-content{width:calc(100% - 12px)!important;max-width:760px!important;min-width:0!important;padding:0!important;margin:0 auto!important;box-sizing:border-box!important}
    #profile-content>.profile-card{width:100%!important;max-width:100%!important;min-width:0!important;border-radius:14px!important;box-sizing:border-box!important}
    .profile-media-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px;min-width:0;width:100%}
    .profile-media-item{width:100%;max-width:680px;min-width:0;margin:0 auto;overflow:hidden;border:1px solid #333;border-radius:12px;background:#080808;text-align:center}
    .profile-media-item img,.profile-media-item iframe{display:block;width:100%;max-width:100%;border:0;aspect-ratio:16/9;object-fit:cover;margin:0 auto}
    .profile-media-item p{margin:0;padding:10px 12px;color:#ddd;font-weight:700;text-align:center;overflow-wrap:anywhere}
    @media(min-width:760px){.profile-media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  const content = document.getElementById('profile-content');
  const section = document.createElement('section');
  section.className = 'profile-card';
  section.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Media</h2><a id="open-media-library" class="auth-button auth-button-secondary" href="profile-setup.html">Manage My Media</a></div><div id="profile-media-grid" class="profile-media-grid"></div><p id="profile-media-status" class="profile-side-note">Loading media…</p>`;
  content?.appendChild(section);

  const grid = section.querySelector('#profile-media-grid');
  const status = section.querySelector('#profile-media-status');
  const manage = section.querySelector('#open-media-library');
  onAuthStateChanged(auth, user => { manage.hidden = user?.uid !== profileId; });

  getDoc(doc(db, 'profiles', profileId)).then(snapshot => {
    if (!snapshot.exists()) throw new Error('missing-profile');
    const data = snapshot.data();
    let items = Array.isArray(data.mediaItems) ? [...data.mediaItems] : [];
    if (!items.length && Array.isArray(data.additionalMedia)) {
      items = data.additionalMedia.map(item => ({
        type: 'video',
        url: typeof item === 'string' ? item : item.url,
        caption: typeof item === 'string' ? '' : (item.title || item.caption || '')
      }));
    }
    if (!items.length && data.legacyPage === 'burning-time.html') {
      items = [
        { type: 'video', url: 'https://www.youtube.com/watch?v=o_a3zRmXjf0', caption: 'Burning Time — More Video' },
        { type: 'video', url: 'https://www.youtube.com/watch?v=mAAIqAtM9lU', caption: 'Burning Time — More Video' },
        { type: 'video', url: 'https://www.youtube.com/watch?v=Es5BP4jGlcc', caption: 'Burning Time — More Video' },
        { type: 'video', url: 'https://www.youtube.com/watch?v=hg3FNy3xgGo', caption: 'Burning Time — More Video' }
      ];
    }
    grid.replaceChildren();
    items.forEach(item => { const node = renderItem(item); if (node) grid.appendChild(node); });
    status.hidden = grid.children.length > 0;
    status.textContent = 'No additional media has been added yet.';
  }).catch(error => {
    console.error(error);
    status.textContent = 'Media could not be loaded.';
  });
}