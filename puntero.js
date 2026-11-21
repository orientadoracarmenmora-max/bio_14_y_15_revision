(() => {
 const superficie = document.querySelector('main');
 const barra = document.querySelector('#barra-puntero');
 const panel = document.querySelector('#ajustes-puntero');
 const activar = document.querySelector('#activar-puntero');
 const abrirAjustes = document.querySelector('#abrir-ajustes-puntero');
 const lienzo = document.querySelector('#capa-puntero');
 const ctx = lienzo.getContext('2d');
 const clave = 'geologia-puntero';
 const ajustes = {modo:'dot', estilo:'fine', borrado:'auto', color:'#E13469', ancho:16, opacidad:90, duracion:1.8};
 const tonos = [['Amarillo vainilla','#FFE582'],['Rosa pastel','#FFACCA'],['Melocotón pastel','#FFC395'],['Menta pastel','#A9EBC2'],['Azul cielo','#A6DDFC'],['Lila pastel','#D7B9FC']];
 try {
  const anteriores = JSON.parse(localStorage.getItem(clave) || '{}');
  for (const campo of Object.keys(ajustes)) {
   if (typeof anteriores[campo] === typeof ajustes[campo]) ajustes[campo] = anteriores[campo];
  }
 } catch {}
 panel.innerHTML = `<fieldset><legend>Modo</legend>
 <label><input name="modo" type="radio" value="dot"> Punto</label>
 <label><input name="modo" type="radio" value="line"> Trazo</label></fieldset>
 <label>Estilo del rastro <select name="estilo"><option value="fine">Láser fino</option><option value="solid">Continuo</option><option value="dots">Punteado</option><option value="dashes">Discontinuo</option><option value="glow">Luminoso</option><option value="marker">Subrayador</option></select></label>
 <label>Cómo se borra <select name="borrado"><option value="auto">Según el estilo</option><option value="smooth">Suave, todo a la vez</option><option value="tail">Desde el principio, como una cola</option><option value="thin">Se afina hasta desaparecer</option><option value="cut">De golpe</option></select></label>
 <label>Color libre <input name="color" type="color"></label>
 <fieldset><legend>Tonos pastel</legend><div class="paleta-puntero">${tonos.map(([nombre,color])=>`<button type="button" aria-label="${nombre}" title="${nombre}" data-tono="${color}" style="--tono:${color}"></button>`).join('')}</div></fieldset>
 <label>Tamaño <input name="ancho" type="range" min="4" max="45" step="1"><output data-valor="ancho"></output></label>
 <label>Opacidad <input name="opacidad" type="range" min="10" max="100" step="1"><output data-valor="opacidad"></output></label>
 <label>Duración del rastro <input name="duracion" type="range" min=".2" max="8" step=".1"><output data-valor="duracion"></output></label>
 <div class="muestra-puntero"><span>Texto de ejemplo del subrayador</span></div>
 <p>Haz clic o apoya el lápiz para señalar. Con el teclado, elige dónde con las flechas y pulsa Intro para marcar. Escape borra el rastro.</p>`;

 let activo = false;
 let cuadro = 0;
 let punto;
 let trazos = [];
 let trazo;
 let teclado;
 let gesto;
 let suprimirClic = false;
 const duracion = () => ajustes.duracion * 1000;
 const limitar = (n,min=0,max=1) => Math.max(min,Math.min(max,n));
 function actualizarAjustes() {
  for (const campo of panel.querySelectorAll('[name]')) {
   const valor = ajustes[campo.name];
   if (campo.type === 'radio') campo.checked = campo.value === valor;
   else if (campo.type === 'checkbox') campo.checked = valor;
   else campo.value = valor;
  }
  for (const [nombre,unidad] of [['ancho','px'],['opacidad','%'],['duracion','s']]) {
   panel.querySelector(`[data-valor="${nombre}"]`).value = ajustes[nombre]+' '+unidad;
  }
  panel.querySelectorAll('[data-tono]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tono.toLowerCase()===ajustes.color.toLowerCase())));
  const muestra = panel.querySelector('.muestra-puntero');
  muestra.style.setProperty('--color-muestra',ajustes.color);
  muestra.style.setProperty('--altura-muestra',ajustes.ancho+'px');
  muestra.style.setProperty('--opacidad-muestra',ajustes.opacidad/100);
  lienzo.classList.toggle('multiplicar',ajustes.modo==='line' && ajustes.estilo==='marker');
 }
 function cambiar(nombre,valor) {
  ajustes[nombre] = valor;
  try {localStorage.setItem(clave,JSON.stringify(ajustes));} catch {}
  limpiar();
  actualizarAjustes();
 }
 panel.addEventListener('input',e=>{
  const c = e.target;
  if (!c.name) return;
  cambiar(c.name,c.type==='checkbox'?c.checked:c.type==='range'?Number(c.value):c.value);
 });
 panel.addEventListener('click',e=>{
  const tono=e.target.closest('[data-tono]');
  if(tono) cambiar('color',tono.dataset.tono);
 });
 function limpiar() {
  cancelAnimationFrame(cuadro);
  cuadro=0;
  trazos=[];
  trazo=punto=teclado=undefined;
  if(gesto && superficie.hasPointerCapture(gesto.id)) superficie.releasePointerCapture(gesto.id);
  gesto=undefined;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,lienzo.width,lienzo.height);
 }
 function activarPuntero(valor) {
  activo=valor;
  activar.setAttribute('aria-pressed',String(activo));
  superficie.classList.toggle('puntero-activo',activo);
  lienzo.hidden=!activo;
  limpiar();
  if(activo) superficie.focus({preventScroll:true});
 }
 activar.onclick=()=>activarPuntero(!activo);
 function mostrarAjustes(mostrar) {
  panel.hidden=!mostrar;
  abrirAjustes.setAttribute('aria-expanded',String(mostrar));
 }
 abrirAjustes.onclick=()=>mostrarAjustes(panel.hidden);
 document.addEventListener('click',e=>{
  if(!panel.hidden && !barra.contains(e.target)) mostrarAjustes(false);
 });
 function pedirCuadro() {
  if(!cuadro) cuadro=requestAnimationFrame(dibujar);
 }
 function linea(puntos,alpha,factor,distancia) {
  if(alpha<=0 || factor<=0) return;
  const ancho=ajustes.ancho;
  const estilo=ajustes.estilo;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.strokeStyle=ajustes.color;
  ctx.lineWidth=(estilo==='fine'?Math.max(1.5,ancho*.36):ancho)*factor;
  ctx.lineCap=estilo==='marker'?'square':'round';
  ctx.lineJoin='round';
  if(estilo==='fine'||estilo==='glow'){
   ctx.shadowColor=ajustes.color;
   ctx.shadowBlur=ancho*factor*(estilo==='fine'?.35:1);
  }
  if(estilo==='dots'||estilo==='dashes'){
   ctx.setLineDash([estilo==='dots'?.15:ancho*1.65,ancho*1.7]);
   ctx.lineDashOffset=-distancia;
  }
  ctx.beginPath();
  ctx.moveTo(puntos[0].x,puntos[0].y);
  if(puntos.length===1) ctx.lineTo(puntos[0].x+.01,puntos[0].y);
  for(const p of puntos.slice(1)) ctx.lineTo(p.x,p.y);
  ctx.stroke();
  if(estilo==='fine'){
   ctx.shadowBlur=0;
   ctx.strokeStyle='#fff';
   ctx.lineWidth=Math.max(.5*factor,ctx.lineWidth*.40);
   ctx.stroke();
  }
  ctx.restore();
 }
 function dibujar(ahora) {
  cuadro=0;
  const caja=lienzo.getBoundingClientRect();
  if(!caja.width || !caja.height) return;
  const ratio=Math.min((devicePixelRatio||1)*(window.visualViewport?.scale||1),3);
  const ancho=Math.max(1,Math.round(caja.width*ratio));
  const alto=Math.max(1,Math.round(caja.height*ratio));
  if(lienzo.width!==ancho || lienzo.height!==alto) {
   lienzo.width=ancho;
   lienzo.height=alto;
  }
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,ancho,alto);
  // El lápiz y getBoundingClientRect usan las mismas coordenadas de pantalla.
  // Convierte esas coordenadas al espacio real del lienzo, incluso con zoom.
  const escalaX=ancho/caja.width, escalaY=alto/caja.height;
  ctx.setTransform(escalaX,0,0,escalaY,-caja.left*escalaX,-caja.top*escalaY);
  const r=superficie.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.left,r.top,r.width,r.height);
  ctx.clip();
  const opacidad=ajustes.opacidad/100;
  const efecto=ajustes.borrado==='auto'?(ajustes.estilo==='fine'?'smooth':'tail'):ajustes.borrado;
  for(const paso of trazos){
   const {puntos,ultimo}=paso;
   if(efecto==='tail'){
    while(puntos.length>1 && ahora-puntos[1].tiempo>=duracion()) puntos.shift();
    const grupos=new Map();
    for(let n=0;n<puntos.length;n++){
     const p=puntos[n];
     const alpha=Math.round(16*limitar((1-(ahora-p.tiempo)/duracion())/.45))/16;
     if(!alpha) continue;
     const previo=puntos[Math.max(0,n-1)];
     const grupo=grupos.get(alpha);
     if(grupo) grupo.puntos.push(p);
     else grupos.set(alpha,{puntos:previo===p?[p]:[previo,p],distancia:previo.distancia});
    }
    for(const [alpha,g] of grupos) linea(g.puntos,opacidad*alpha,1,g.distancia);
   }else{
    const edad=paso===trazo && gesto ? 0 : ahora-ultimo;
    const restante=limitar(1-edad/duracion());
    const alpha=efecto==='cut'?Number(restante>0):limitar(restante/.7);
    linea(puntos,opacidad*alpha,efecto==='thin'?alpha:1,0);
   }
  }
  trazos=trazos.filter(paso=>(paso===trazo && gesto)||ahora-paso.ultimo<duracion());
  if(trazo&&!trazos.includes(trazo)) trazo=undefined;
  if(punto){
   const restante=punto.fijo?1:limitar(1-(ahora-punto.tiempo)/duracion());
   ctx.globalAlpha=opacidad*limitar(restante/.3);
   ctx.fillStyle=ajustes.color;
   ctx.shadowColor=ajustes.color;
   ctx.shadowBlur=8;
   ctx.strokeStyle='#fff';
   ctx.lineWidth=1.5;
   ctx.beginPath();
   ctx.arc(punto.x,punto.y,ajustes.ancho/2,0,Math.PI*2);
   ctx.fill();
   ctx.stroke();
   if(!restante) punto=undefined;
  }
  ctx.restore();
  if(trazos.length || (punto&&!punto.fijo)) pedirCuadro();
 }
 function colocar(x,y,fijo=false) {
  const tiempo=performance.now();
  if(ajustes.modo==='dot') punto={x,y,tiempo,fijo};
  else {
   if(!trazo || (!gesto && tiempo-trazo.ultimo>=duracion())){
    trazo={puntos:[],ultimo:tiempo};
    trazos.push(trazo);
   }
   const anterior=trazo.puntos.at(-1);
   const distancia=anterior?anterior.distancia+Math.hypot(x-anterior.x,y-anterior.y):0;
   if(!anterior || x!==anterior.x || y!==anterior.y) trazo.puntos.push({x,y,tiempo,distancia});
   trazo.ultimo=tiempo;
  }
  pedirCuadro();
 }
 function salir() {
  trazo=undefined;
  if(punto?.fijo) {
   punto.fijo=false;
   punto.tiempo=performance.now();
   pedirCuadro();
  }
 }
 const controles='a,button,input,textarea,select,summary,label,[contenteditable]';
 superficie.addEventListener('pointerdown',e=>{
  if(!activo || gesto || e.button!==0 || e.target.closest(controles)) return;
  e.preventDefault();
  superficie.focus({preventScroll:true});
  gesto={id:e.pointerId};
  suprimirClic=true;
  superficie.setPointerCapture(e.pointerId);
  colocar(e.clientX,e.clientY,true);
 });
 superficie.addEventListener('pointermove',e=>{
  if(!activo || gesto?.id!==e.pointerId) return;
  const caja=superficie.getBoundingClientRect();
  if(e.clientX<caja.left||e.clientX>=caja.right||e.clientY<caja.top||e.clientY>=caja.bottom){salir();return;}
  colocar(e.clientX,e.clientY,true);
 });
 superficie.addEventListener('pointerleave',salir);
 for(const tipo of ['pointerup','pointercancel','lostpointercapture']) superficie.addEventListener(tipo,e=>{
  if(gesto?.id!==e.pointerId) return;
  gesto=undefined;
  salir();
  setTimeout(()=>{suprimirClic=false;},0);
 });
 superficie.addEventListener('click',e=>{
  if(suprimirClic){e.preventDefault();e.stopPropagation();}
 },true);
 superficie.addEventListener('keydown',e=>{
  if(!activo||e.target!==superficie) return;
  const movimientos={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
  const delta=movimientos[e.key];
  const marcar = e.key === 'Enter' || e.key === ' ';
  if(!delta&&!marcar) return;
  e.preventDefault();
  const r=superficie.getBoundingClientRect();
  const x0=Math.max(r.left,0),y0=Math.max(r.top,0);
  const x1=Math.min(r.right,innerWidth),y1=Math.min(r.bottom,innerHeight);
  teclado ||= {x:(x0+x1)/2,y:(y0+y1)/2};
  if(delta) teclado={x:limitar(teclado.x+delta[0],x0,x1),y:limitar(teclado.y+delta[1],y0,y1)};
  if(marcar) {
   colocar(teclado.x,teclado.y);
   trazo=undefined;
  }
 });
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(!panel.hidden) {
   mostrarAjustes(false);
   abrirAjustes.focus({preventScroll:true});
  }
  if(activo) limpiar();
 });
 window.addEventListener('blur',salir);
 for(const evento of ['resize','scroll','hashchange','beforeprint']) window.addEventListener(evento,limpiar);
 for(const evento of ['resize','scroll']) window.visualViewport?.addEventListener(evento,limpiar);
 barra.removeAttribute('hidden');
 actualizarAjustes();
})();
