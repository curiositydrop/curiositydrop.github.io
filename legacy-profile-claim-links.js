const path=location.pathname.toLowerCase();
const directoryType=path.endsWith('/bands.html')?'band':path.endsWith('/musicians.html')?'musician':path.endsWith('/venues.html')?'venue':'';

function fieldText(card,label){
  const paragraphs=[...card.querySelectorAll('p')];
  const match=paragraphs.find(p=>String(p.textContent||'').toLowerCase().startsWith(label.toLowerCase()));
  if(!match)return '';
  return String(match.textContent||'').replace(new RegExp(`^${label}`,'i'),'').trim();
}

function absoluteAsset(src){
  if(!src)return '';
  try{return new URL(src,location.href).href}catch{return src}
}

function addClaimLink(card){
  if(!directoryType||card.classList.contains('firebase-profile-card')||card.querySelector('.claim-profile-link'))return;
  const view=card.querySelector('a.button[href]');
  const name=card.querySelector('h3')?.textContent?.trim();
  if(!view||!name)return;
  const href=view.getAttribute('href')||'';
  if(!href||href.startsWith('profile.html'))return;

  const image=card.querySelector('img')?.getAttribute('src')||'';
  const params=new URLSearchParams({
    page:href,
    name,
    type:directoryType,
    image:absoluteAsset(image),
    location:fieldText(card,directoryType==='venue'?'Town:':'Location:'),
    genre:fieldText(card,'Genre:')||fieldText(card,'Style:'),
    instruments:fieldText(card,'Instrument:'),
    venueType:fieldText(card,'Type:')
  });

  const claim=document.createElement('a');
  claim.className='claim-profile-link';
  claim.href=`claim-profile.html?${params.toString()}`;
  claim.textContent='Is this yours? Claim this profile';
  claim.style.display='block';
  claim.style.marginTop='10px';
  claim.style.fontSize='.85rem';
  claim.style.fontWeight='800';
  claim.style.color='#0ccfbd';
  card.appendChild(claim);
}

function install(){
  document.querySelectorAll('.profile-grid .profile-card').forEach(addClaimLink);
}

install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});