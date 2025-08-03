/* Lucky Spin widget — читает cfg из URL, без визуальной настройки */
(()=>{
  const tg=window.Telegram?.WebApp||{expand(){},ready(){},showAlert:alert};
  tg.expand();tg.ready();

  /* ---------- cfg из URL ---------- */
  const url=new URL(location.href);
  const cfg=url.searchParams.get('cfg')
           ? JSON.parse(atob(url.searchParams.get('cfg')))
           : {wheelWeights:[200,50,200,40,200,30,5,1],appleRig:3,crashMax:5};

  const $=id=>document.getElementById(id);

  /* баланс / ставка */
  let balance=+url.searchParams.get('bal')||0;
  const fmt   = n => n.toFixed(2);
  const balEl = $('#balance');            // ← кэшируем ссылку
  const draw  = () => { if (balEl) balEl.textContent = fmt(balance); };
  draw();

  /* ---------- выбор игры ---------- */
  const sel = $('#gameSelect');
  if (sel) {
    const views = {wheel:$('#wheelGame'), apple:$('#appleGame'), crash:$('#crashGame')};
    sel.onchange = e => {
      Object.values(views).forEach(v => v?.classList.remove('active'));
      views[e.target.value]?.classList.add('active');
    };
  }

  /* ---------- wheel ---------- */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'],
        mult  =[0,2,0,5,0,3,10,55],
        colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];

  const pick=w=>{
    const s=w.reduce((a,b)=>a+b,0); let r=Math.random()*s,a=0;
    for(let i=0;i<w.length;i++){a+=w[i];if(r<a)return i;}return 7;
  };

  const wheel=new Winwheel({
    canvasId:'canvas',numSegments:labels.length,outerRadius:160,
    textFontSize:22,textFillStyle:'#fff',
    segments:labels.map((t,i)=>({text:t,fillStyle:colors[i]})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:i=>{
      balance+=mult[i.text-1]*bet;draw();
    }}
  });
  // стрелка
  (()=>{const c=$('canvas').getContext('2d');c.fillStyle='#ffea00';
        c.beginPath();c.moveTo(158,8);c.lineTo(162,8);c.lineTo(160,28);c.fill();})();

  /* ---------- apple ---------- */
  const field=$('#appleField'),
        bombSel=$('#bombPick'),
        cashBtn=$('#appleCashBtn');
  if (bombSel) {
    for(let i=1;i<=20;i++) {
      const o = document.createElement('option');
      o.value=i;
      o.textContent=i;
      bombSel.appendChild(o);
    }
    bombSel.value=5;
  }
  

  /* ---------- crash ---------- */
  const crashScr=$('#crashScreen'),crashBtn=$('#crashCashBtn');

  /* ---------- play ---------- */
  let bet=1;
  const actionBtn = $('#actionBtn');
  if (actionBtn) {
    actionBtn.onclick=()=>{
    bet=+$('#stakeInput').value||1;
    if(balance<bet){tg.showAlert('Недостаточно средств');return;}
    balance-=bet;draw();
    const g=$('#gameSelect').value;

    if(g==='wheel'){
      wheel.stopAnimation(false);wheel.rotationAngle=0;wheel.draw();
      const idx=pick(cfg.wheelWeights);
      wheel.animation.stopAngle=wheel.getRandomForSegment(idx+1);
      wheel.startAnimation();

    }else if(g==='apple'){
      field.innerHTML='';cashBtn.style.display='none';
      let appleMul=1,opened=0,bombsReal=new Set(),bombsShow=new Set();
      const shown=+bombSel.value,total=Math.min(24,shown+cfg.appleRig);
      while(bombsReal.size<total)bombsReal.add(Math.floor(Math.random()*25));
      bombsShow=new Set([...bombsReal].sort(()=>0.5-Math.random()).slice(0,shown));

      const cells=[];
      for(let i=0;i<25;i++){
        const d=document.createElement('div');d.className='cell';d.textContent='🍏';
        d.onclick=()=>open(i);field.appendChild(d);cells.push(d);
      }
      function open(i){
        if(cells[i].classList.contains('open'))return;
        cells[i].classList.add('open');
        if(bombsReal.has(i)){
          if(!bombsShow.has(i)){bombsShow.delete([...bombsShow][0]);bombsShow.add(i);}
          bombsShow.forEach(j=>{cells[j].classList.add('open');cells[j].textContent='🐛';});
          return;
        }
        opened++;appleMul=+(1+opened*0.2).toFixed(2);
        cells[i].textContent='🍎';
        cashBtn.textContent=`Забрать ×${appleMul.toFixed(2)}`;
        cashBtn.style.display='block';
      }
      cashBtn.onclick=()=>{balance+=bet*appleMul;draw();cashBtn.style.display='none';};

    }else{
      let cm=1,limit=+(1.5+Math.random()*(cfg.crashMax-1.5)).toFixed(2);
      crashScr.textContent='x1.00';crashBtn.textContent='Забрать x1.00';crashBtn.style.display='block';
      const t=setInterval(()=>{
        cm=+(cm+0.05).toFixed(2);
        crashScr.textContent=`x${cm.toFixed(2)}`;
        crashBtn.textContent  =`Забрать x${cm.toFixed(2)}`;
        if(cm>=limit){clearInterval(t);crashBtn.style.display='none';crashScr.textContent='💥 CRASH';}
      },200);
      crashBtn.onclick=()=>{clearInterval(t);balance+=bet*cm;draw();crashBtn.style.display='none';};
    }
  };
  }
  
})();
