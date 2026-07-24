const intro = document.querySelector('.community-intro');

if (intro && !document.getElementById('community-sponsor-hero')) {
  const sponsors = [
    {
      image: 'ff796046372b48681a359daff6375626.jpeg',
      name: 'Rock Rage Radio',
      url: 'sponsors.html'
    },
    {
      image: 'IMG_0908.jpeg',
      name: 'The Plowzone Radio Show',
      url: 'sponsors.html'
    },
    {
      image: 'IMG_0699.jpeg',
      name: 'Gone Rogue Records',
      url: 'sponsors.html'
    },
    {
      image: '9A3AD6D7-8C0C-4C27-BE09-A19C2F0834AE.png',
      name: 'New Leaf Painting Company',
      url: 'sponsors.html'
    }
  ];

  const style = document.createElement('style');
  style.id = 'community-sponsor-hero-styles';
  style.textContent = `
    .community-hero-row{
      display:grid;
      grid-template-columns:minmax(0,3fr) minmax(0,2fr);
      gap:10px;
      align-items:stretch;
      margin-bottom:8px;
    }
    .community-hero-row .community-intro{
      min-width:0;
      margin:0!important;
      padding:13px 14px;
      border:1px solid #2f625e;
      border-radius:14px;
      background:linear-gradient(145deg,#171717,#111);
      box-shadow:0 7px 18px rgba(0,0,0,.24);
      display:flex;
      flex-direction:column;
      justify-content:center;
    }
    .community-hero-row .community-intro .profile-meta{
      margin:0 0 4px;
      font-size:.67rem;
      line-height:1.15;
    }
    .community-hero-row .community-intro h1{
      margin:0 0 5px;
      font-size:clamp(1.35rem,4vw,2rem);
      line-height:1.05;
    }
    .community-hero-row .community-intro .auth-subtitle{
      margin:0;
      color:#c8c8c8;
      font-size:.78rem;
      line-height:1.32;
    }
    .community-sponsor-hero{
      position:relative;
      min-width:0;
      min-height:112px;
      overflow:hidden;
      border:1px solid #2f625e;
      border-radius:14px;
      background:radial-gradient(circle at center,rgba(12,207,189,.14),transparent 72%),linear-gradient(145deg,#171717,#0d0d0d);
      box-shadow:0 7px 18px rgba(0,0,0,.24);
      color:inherit;
      text-decoration:none;
    }
    .community-sponsor-kicker{
      position:absolute;
      z-index:5;
      top:8px;
      left:9px;
      right:9px;
      color:#0ccfbd;
      font-size:.55rem;
      font-weight:900;
      letter-spacing:.09em;
      line-height:1.15;
      text-transform:uppercase;
      text-align:center;
    }
    .community-sponsor-hero-slide{
      position:absolute;
      inset:0;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:4px;
      padding:27px 8px 8px;
      box-sizing:border-box;
      opacity:0;
      transition:opacity .4s ease;
      pointer-events:none;
      text-align:center;
    }
    .community-sponsor-hero-slide.is-active{
      opacity:1;
      pointer-events:auto;
    }
    .community-sponsor-hero-slide img{
      display:block;
      width:100%;
      height:58px;
      object-fit:contain;
      border-radius:7px;
    }
    .community-sponsor-hero-name{
      display:block;
      max-width:100%;
      overflow:hidden;
      color:#fff;
      font-size:.68rem;
      font-weight:900;
      line-height:1.1;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .community-sponsor-hero-view{
      color:#0ccfbd;
      font-size:.6rem;
      font-weight:900;
      line-height:1;
    }
    @media(max-width:560px){
      .community-hero-row{
        grid-template-columns:minmax(0,3fr) minmax(0,2fr);
        gap:7px;
      }
      .community-hero-row .community-intro{
        padding:10px 11px;
      }
      .community-hero-row .community-intro .profile-meta{
        font-size:.56rem;
      }
      .community-hero-row .community-intro h1{
        margin-bottom:4px;
        font-size:1.18rem;
      }
      .community-hero-row .community-intro .auth-subtitle{
        font-size:.67rem;
        line-height:1.25;
      }
      .community-sponsor-hero{
        min-height:106px;
      }
      .community-sponsor-kicker{
        top:7px;
        left:5px;
        right:5px;
        font-size:.47rem;
        letter-spacing:.05em;
      }
      .community-sponsor-hero-slide{
        padding:25px 6px 7px;
      }
      .community-sponsor-hero-slide img{
        height:53px;
      }
      .community-sponsor-hero-name{
        font-size:.58rem;
      }
      .community-sponsor-hero-view{
        font-size:.54rem;
      }
    }
  `;
  document.head.appendChild(style);

  const row = document.createElement('section');
  row.className = 'community-hero-row';
  intro.parentNode.insertBefore(row, intro);
  row.appendChild(intro);

  intro.querySelector('.profile-meta')?.replaceChildren(document.createTextNode('WELCOME TO'));
  const heading = intro.querySelector('h1');
  if (heading) heading.textContent = 'BANDtroductions Social';
  const subtitle = intro.querySelector('.auth-subtitle');
  if (subtitle) subtitle.textContent = 'Music community. No algorithms. No politics. Just music.';

  const slot = document.createElement('a');
  slot.id = 'community-sponsor-hero';
  slot.className = 'community-sponsor-hero';
  slot.href = sponsors[0].url;
  slot.setAttribute('aria-label', `Social platform supported by ${sponsors[0].name}`);

  const kicker = document.createElement('span');
  kicker.className = 'community-sponsor-kicker';
  kicker.textContent = 'Social supported by';
  slot.appendChild(kicker);

  const slides = sponsors.map((sponsor, index) => {
    const slide = document.createElement('span');
    slide.className = `community-sponsor-hero-slide${index === 0 ? ' is-active' : ''}`;

    const image = document.createElement('img');
    image.src = sponsor.image;
    image.alt = sponsor.name;
    image.loading = index === 0 ? 'eager' : 'lazy';

    const name = document.createElement('span');
    name.className = 'community-sponsor-hero-name';
    name.textContent = sponsor.name;

    const view = document.createElement('span');
    view.className = 'community-sponsor-hero-view';
    view.textContent = 'View Sponsor →';

    slide.append(image, name, view);
    slot.appendChild(slide);
    return slide;
  });

  row.appendChild(slot);

  let activeIndex = 0;
  window.setInterval(() => {
    slides[activeIndex].classList.remove('is-active');
    activeIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.add('is-active');
    slot.href = sponsors[activeIndex].url;
    slot.setAttribute('aria-label', `Social platform supported by ${sponsors[activeIndex].name}`);
  }, 5000);
}
