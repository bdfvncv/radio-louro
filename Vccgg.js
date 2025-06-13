// rádio-jogador.js

// Cole aqui os links diretos do Cloudinary:
const MUSIC_URLS = [
  // "https://res.cloudinary.com/seu_usuario/video/upload/musicas/sua-musica_id.mp3",
];

const TIME_URLS = [
  // "https://res.cloudinary.com/seu_usuario/video/upload/hora_certa/hora-certa_id.mp3",
];

const AD_URLS = [
  // "https://res.cloudinary.com/seu_usuario/video/upload/avisos/aviso_id.mp3",
];

const ALBUM_URLS = {
  natal: [
    // "https://res.cloudinary.com/seu_usuario/video/upload/natal/musica_natal_id.mp3",
  ],
  pascoa: [
    // ...
  ],
  saojoao: [
    // ...
  ],
};

const audio = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const volumeSlider = document.getElementById("volumeSlider");
const nowPlaying = document.getElementById("nowPlaying");
const trackInfo = document.getElementById("trackInfo");

let queue = [], current = 0, tocadas = {}, activeAlbum = localStorage.getItem("activeAlbum") || null;

function buildQueue() {
  queue = []; let i=0, m=0,t=0,a=0,al=0;
  while(i<100){
    if(i>0 && i%6===0 && AD_URLS.length) queue.push({url:AD_URLS[a++%AD_URLS.length],label:"Aviso"});
    else if(i>0 && i%3===0 && TIME_URLS.length) queue.push({url:TIME_URLS[t++%TIME_URLS.length],label:"Hora Certa"});
    else {
      if(activeAlbum && ALBUM_URLS[activeAlbum]?.length && Math.random()<0.3)
        queue.push({url:ALBUM_URLS[activeAlbum][al++%ALBUM_URLS[activeAlbum].length],label:activeAlbum.toUpperCase()});
      else queue.push({url:MUSIC_URLS[m++%MUSIC_URLS.length],label:"Música"});
    }
    i++;
  }
  current=0;
}

function playCurrent(){
  if(!queue.length){ nowPlaying.textContent="Sem faixas"; return; }
  const item=queue[current];
  audio.src=item.url;
  nowPlaying.textContent=item.label;
  const nome=item.url.split("/").pop();
  tocadas[nome]=(tocadas[nome]||0)+1;
  localStorage.setItem("tocadas",JSON.stringify(tocadas));
  updateReport();
  audio.play(); playBtn.textContent="⏸️";
}

function nextTrack(){
  current=(current+1)%queue.length;
  if(current===0) buildQueue();
  playCurrent();
}

function togglePlay(){
  if(audio.paused){ audio.play(); playBtn.textContent="⏸️"; }
  else{ audio.pause(); playBtn.textContent="▶️";}
}

function updateVolume(){
  audio.volume=volumeSlider.value/100;
}

window.resetarRelatorio=()=>{
  tocadas={}; localStorage.removeItem("tocadas"); updateReport();
};

window.selectAlbum=(alb)=>{
  activeAlbum=alb==="none"?null:alb;
  localStorage.setItem("activeAlbum",activeAlbum);
  buildQueue(); updateAlbumDisplay(); playCurrent();
};

function updateAlbumDisplay(){
  const c=document.getElementById("albumCover"),
        n=document.getElementById("nowPlaying");
  if(activeAlbum) c.textContent=activeAlbum==="natal"?"🎄":activeAlbum==="pascoa"?"🐰":"🌽";
  else c.textContent="🎵";
}

function updateReport(){
  const rep=document.getElementById("relatorio");
  rep.innerHTML="";
  for(const f in tocadas){
    const li=document.createElement("li");
    li.textContent=`${f} – ${tocadas[f]}x`;
    rep.appendChild(li);
  }
}

// Admin / navegação
window.showAdminLogin=()=>{ document.getElementById("playerContainer").style.display="none"; document.getElementById("loginContainer").style.display="block";}
window.showPlayer=()=>{ document.getElementById("playerContainer").style.display="block"; document.getElementById("loginContainer").style.display="none"; document.getElementById("adminPanel").style.display="none";}
window.adminLogin=()=>{
  if(document.getElementById("adminPassword").value==="admin123"){
    document.getElementById("loginContainer").style.display="none";
    document.getElementById("adminPanel").style.display="block";
  } else document.getElementById("loginError").textContent="Senha incorreta!";
};

audio.addEventListener("ended",nextTrack);
playBtn.addEventListener("click",togglePlay);
volumeSlider.addEventListener("input",updateVolume);

// Inicialização
document.addEventListener("DOMContentLoaded",()=>{
  tocadas=JSON.parse(localStorage.getItem("tocadas")||"{}");
  buildQueue(); updateAlbumDisplay(); updateReport(); playCurrent();
});
