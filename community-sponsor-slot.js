const feed = document.getElementById('feed');

if (feed) {
  const sponsors = [
    {
      image: 'ff796046372b48681a359daff6375626.jpeg',
      name: 'Rock Rage Radio',
      text: 'Supporting independent music and the BANDtroductions community.',
      url: 'sponsors.html'
    },
    {
      image: 'IMG_0908.jpeg',
      name: 'The Plowzone Radio Show',
      text: 'Supporting independent music and the BANDtroductions community.',
      url: 'sponsors.html'
    },
    {
      image: 'IMG_0699.jpeg',
      name: 'Gone Rogue Records',
      text: 'Supporting independent music and the BANDtroductions community.',
      url: 'sponsors.html'
    },
    {
      image: '9A3AD6D7-8C0C-4C27-BE09-A19C2F0834AE.png',
      name: 'New Leaf Painting Company',
      text: 'Supporting independent music and the BANDtroductions community.',
      url: 'sponsors.html'
    },
    {
      name: 'Put your brand here',
      text: 'Reach bands, venues, musicians, and independent music fans by sponsoring BANDtroductions.',
      url: 'sponsors.html',
      callToAction: 'Become a Sponsor'
    }
  ];

  const style = document.createElement('style');
  style.textContent = `
    .community-sponsor-slot {
      position: relative;
      display: block;
      min-height: 178px;
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden;
      border: 1px solid #2f625e;
      border-radius: 14px;
      background: linear-gradient(145deg,#171717,#0d0d0d);
      box-shadow: 0 7px 18px rgba(0,0,0,.24);
      color: inherit;
      text-decoration: none;
    }
    .community-sponsor-label {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 4;
      padding: 4px 8px;
      border: 1px solid rgba(12,207,189,.55);
      border-radius: 999px;
      background: rgba(0,0,0,.78);
      color: #0ccfbd;
      font-size: .62rem;
      font-weight: 900;
      letter-spacing: .12em;
    }
    .community-sponsor-slide {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: minmax(120px, 40%) 1fr;
      align-items: center;
      gap: 18px;
      padding: 36px 18px 18px;
      opacity: 0;
      pointer-events: none;
      transition: opacity .45s ease;
      box-sizing: border-box;
    }
    .community-sponsor-slide.is-active {
      opacity: 1;
      pointer-events: auto;
    }
    .community-sponsor-slide img {
      width: 100%;
      height: 112px;
      object-fit: contain;
      border-radius: 10px;
      background: #090909;
    }
    .community-sponsor-copy h3 {
      margin: 0 0 7px;
      color: #0ccfbd;
      font-size: 1.08rem;
    }
    .community-sponsor-copy p {
      margin: 0;
      color: #c5c5c5;
      font-size: .82rem;
      line-height: 1.42;
    }
    .community-sponsor-cta {
      display: inline-block;
      margin-top: 11px;
      padding: 7px 11px;
      border-radius: 999px;
      background: #0ccfbd;
      color: #07100f;
      font-size: .75rem;
      font-weight: 900;
    }
    .community-sponsor-slide.is-promo {
      grid-template-columns: 1fr;
      text-align: center;
      background: radial-gradient(circle at center,rgba(12,207,189,.16),transparent 68%);
    }
    @media(max-width:560px){
      .community-sponsor-slot{min-height:210px}
      .community-sponsor-slide{grid-template-columns:105px 1fr;gap:12px;padding:38px 12px 14px}
      .community-sponsor-slide img{height:118px}
      .community-sponsor-copy h3{font-size:.96rem}
      .community-sponsor-copy p{font-size:.76rem}
    }
  `;
  document.head.appendChild(style);

  const slot = document.createElement('a');
  slot.className = 'community-sponsor-slot';
  slot.setAttribute('aria-label', 'Sponsored partner');

  const label = document.createElement('span');
  label.className = 'community-sponsor-label';
  label.textContent = 'SPONSORED';
  slot.appendChild(label);

  const slides = sponsors.map((sponsor, index) => {
    const slide = document.createElement('div');
    slide.className = `community-sponsor-slide${index === 0 ? ' is-active' : ''}${sponsor.image ? '' : ' is-promo'}`;

    if (sponsor.image) {
      const image = document.createElement('img');
      image.src = sponsor.image;
      image.alt = sponsor.name;
      image.loading = index === 0 ? 'eager' : 'lazy';
      slide.appendChild(image);
    }

    const copy = document.createElement('div');
    copy.className = 'community-sponsor-copy';
    const title = document.createElement('h3');
    title.textContent = sponsor.name;
    const text = document.createElement('p');
    text.textContent = sponsor.text;
    copy.append(title, text);

    if (sponsor.callToAction) {
      const cta = document.createElement('span');
      cta.className = 'community-sponsor-cta';
      cta.textContent = sponsor.callToAction;
      copy.appendChild(cta);
    }

    slide.appendChild(copy);
    slot.appendChild(slide);
    return slide;
  });

  let activeIndex = 0;
  slot.href = sponsors[0].url;

  function placeSlot() {
    const posts = [...feed.querySelectorAll('.community-post')];
    if (!posts.length) return;
    const anchor = posts[Math.min(2, posts.length - 1)];
    if (anchor.nextElementSibling !== slot) anchor.insertAdjacentElement('afterend', slot);
  }

  const observer = new MutationObserver(() => window.requestAnimationFrame(placeSlot));
  observer.observe(feed, { childList: true });
  placeSlot();

  window.setInterval(() => {
    slides[activeIndex].classList.remove('is-active');
    activeIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.add('is-active');
    slot.href = sponsors[activeIndex].url;
    slot.setAttribute('aria-label', `Sponsored partner: ${sponsors[activeIndex].name}`);
  }, 5000);
}
