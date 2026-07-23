const bannerInput=document.getElementById('banner-image-file');
const avatarInput=document.getElementById('image-file');
const status=document.getElementById('setup-status');

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('That image could not be opened.'))};
    image.src=url;
  });
}

function canvasBlob(canvas,type='image/webp',quality=.86){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be processed.')),type,quality));
}

async function processImage(file,kind){
  if(!file?.type?.startsWith('image/'))throw new Error('Please choose an image file.');
  if(file.size>20*1024*1024)throw new Error('Please choose an image smaller than 20 MB.');
  const image=await loadImage(file);
  const avatar=kind==='avatar';
  const width=avatar?700:1600;
  const height=avatar?700:900;
  const sourceRatio=image.naturalWidth/image.naturalHeight;
  const targetRatio=width/height;
  let sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight;
  if(sourceRatio>targetRatio){sw=image.naturalHeight*targetRatio;sx=(image.naturalWidth-sw)/2}
  else if(sourceRatio<targetRatio){sh=image.naturalWidth/targetRatio;sy=(image.naturalHeight-sh)/2}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{alpha:false});
  context.drawImage(image,sx,sy,sw,sh,0,0,width,height);
  const blob=await canvasBlob(canvas);
  const base=(file.name||kind).replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-');
  return new File([blob],`${base}-${kind}.webp`,{type:'image/webp',lastModified:Date.now()});
}

function setPreview(id,file){
  const preview=document.getElementById(id);if(!preview)return;
  const url=URL.createObjectURL(file);const image=document.createElement('img');image.src=url;image.alt='Processed profile image preview';image.onload=()=>URL.revokeObjectURL(url);preview.replaceChildren(image);
}

async function handle(input,kind,previewId){
  const original=input.files?.[0];if(!original)return;
  input.disabled=true;if(status)status.textContent=kind==='avatar'?'Cropping and optimizing avatar…':'Cropping and optimizing banner…';
  try{
    const processed=await processImage(original,kind);
    const transfer=new DataTransfer();transfer.items.add(processed);input.files=transfer.files;
    setPreview(previewId,processed);
    input.dataset.processed='true';
    if(status)status.textContent=`${kind==='avatar'?'Avatar':'Banner'} ready — reduced to ${Math.max(1,Math.round(processed.size/1024))} KB.`;
  }catch(error){console.error(error);if(status)status.textContent=error.message||'The image could not be processed.';input.value='';}
  finally{input.disabled=false;}
}

bannerInput?.addEventListener('change',()=>handle(bannerInput,'banner','banner-preview'),{capture:true});
avatarInput?.addEventListener('change',()=>handle(avatarInput,'avatar','avatar-preview'),{capture:true});