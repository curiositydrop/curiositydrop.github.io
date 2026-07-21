const hero = document.querySelector('.home-page .hero');

if (hero) {
  hero.classList.add('social-hero');
  hero.innerHTML = `
    <p class="social-hero-kicker">Now Featuring</p>
    <h1>BANDtroductions Social</h1>
    <p class="social-hero-lead">Your connection to local music scenes everywhere.</p>
    <p class="social-hero-copy">Discover bands, connect with musicians, find venues, and join a community built entirely around music.</p>
    <a class="social-hero-cta" href="community.html">Join Our Community →</a>
    <p class="social-hero-types">Bands. Musicians. Venues. Scene Supporters. One community.</p>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .home-page .hero.social-hero {
      padding: clamp(28px, 5vw, 46px) clamp(20px, 5vw, 44px) !important;
    }
    .social-hero-kicker {
      margin: 0 0 2px !important;
      color: #b8b8b8 !important;
      font-size: clamp(.9rem, 2.7vw, 1.05rem) !important;
      font-weight: 700;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .home-page .hero.social-hero h1 {
      margin: 0 0 10px !important;
      font-size: clamp(2rem, 6.5vw, 3.2rem) !important;
      line-height: 1.06 !important;
      white-space: nowrap;
    }
    .social-hero-lead {
      margin: 0 0 8px !important;
      color: #fff !important;
      font-size: clamp(1.15rem, 4vw, 1.55rem) !important;
      font-weight: 800;
      line-height: 1.3 !important;
    }
    .social-hero-copy {
      margin: 0 auto 14px !important;
      max-width: 680px;
      color: #d7d7d7 !important;
      font-size: clamp(1rem, 3.6vw, 1.25rem) !important;
      line-height: 1.45 !important;
    }
    .social-hero-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 8px 15px;
      border-radius: 999px;
      background: #0ccfbd;
      color: #050505;
      font-size: .88rem;
      font-weight: 900;
      text-decoration: none;
      box-shadow: 0 0 18px rgba(12, 207, 189, .24);
    }
    .social-hero-types {
      margin: 10px 0 0 !important;
      color: #999 !important;
      font-size: clamp(.82rem, 2.8vw, .98rem) !important;
      font-weight: 700;
      line-height: 1.35 !important;
    }
    @media (max-width: 520px) {
      .home-page .hero.social-hero {
        padding: 26px 20px !important;
      }
      .home-page .hero.social-hero h1 {
        font-size: clamp(1.62rem, 7vw, 2rem) !important;
      }
    }
  `;
  document.head.appendChild(style);
}
