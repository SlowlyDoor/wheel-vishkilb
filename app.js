/* === Lucky Spin widget (admin-configurable) === */
(() => {
  const tg = window.Telegram?.WebApp || {expand(){},ready(){},sendData:console.log,showAlert:alert};
  tg.expand(); tg.ready();

  /* ---------- кто админ ---------- */
  const ADMIN_ID = 1607646782;                       // ← ваш Telegram-ID
  const isAdmin  = (tg.initDataUnsafe?.user?.id || 0) === ADMIN_ID;

  /* ---------- конфиг из URL ---------- */
  const url = new URL(location.href);
  const cfg = url.searchParams.get('cfg')
             ? JSON.parse(atob(url.searchParams.get('cfg')))
             : { wheelWeights:[200,50,200,40,200,30,5,1], appleRig:3, crashMax:5 };

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);

  /* показать панель админу */
  if (isAdmin) {
    $('#settingsPanel').style.display = 'flex';
    $('#w55').value = cfg.wheelWeights[7];
    $('#rig').value = cfg.appleRig;
    $('#cmax').value = cfg.crashMax;
  }

  /* сохранить конфиг (админ) */
  $('#saveBtn')?.addEventListener('click', () => {
    cfg.wheelWeights[7] = +$('#w55').value || 1;
    cfg.appleRig        = +$('#rig').value || 0;
    cfg.crashMax        = +$('#cmax').value || 5;

    tg.sendData(JSON.stringify({type:'saveConfig', cfg}));
    $('#saveStatus').style.display = 'inline';
    setTimeout(()=>$('#saveStatus').style.display='none',2000);
  });

  /* ---------- баланс / ставка ---------- */
  const balanceEl = $('#balance');
  let   balance   = +url.searchParams.get('bal') || 0;
  const stakeInp  = $('#stakeInp');
  const fmt = n => n.toFixed(2);
  const drawBal = () => { if (balanceEl) balanceEl.textContent = fmt(balance); };
  drawBal();

  /* ---------- переключение игр ---------- */
  const views = {wheel:$('#wheelGame'), apple:$('#appleGame'), crash:$('#crashGame')};
  $('#gameSelect').onchange = e=>{
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views[e.target.value].classList.add('active');
  };

  /* ==================================================================== *
   *                               1) Wheel                               *
   * ==================================================================== */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'];
  const mult  =[0,2,0,5,0,3,10,55];
  const colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];

  const pickByWeight=w=>{
    const sum=w.reduce((a,b)=>a+b,0); let r=Math.random()*sum,acc=0;
    for(let i=0;i<w.length;i++){acc+=w[i]; if(r<acc)return i;} return w.length-1;
  };

  const wheel = new Winwheel({
    canvasId:'canvas',numSegments:labels.length,outerRadius:160,
    textFontSize:22,textFillStyle:'#fff',segments:labels.map((t,i)=>({text:t,fillStyle:colors[i]})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:onWheelStop}
  });
  (()=>{const c=$('canvas').getContext('2d');c.fillStyle='#ffea00';
        c.beginPath();c.moveTo(158,8);c.lineTo(162,8);c.lineTo(160,28);c.fill();})();

  /* ==================================================================== *
   *                              2) Apple                                *
   * ==================================================================== */
  const field   = $('#appleField');
  const bombSel = $('#bombPick');
  for(let i=1;i<=20;i++){const o=document.createElement('option');o.value=i;o.textContent=i;bombSel.appendChild(o);}
  bombSel.value=5;
  const cashBtn = $('#appleCashBtn');

  let apples=[], bombsReal=new Set(), bombsShow=new Set(), opened=0, appleMul=1;

  /* ==================================================================== *
   *                               3) Crash                               *
   * ==================================================================== */
  const crashScreen = $('#crashScreen');
  const crashBtn    = $('#crashCashBtn');
  let crashTimer=null, crashMul=1, crashLimit=2;

  /* ==================================================================== *
   *                     Кнопка «Играть!»                                 *
   * ==================================================================== */
  $('#actionBtn').onclick = () => {
    const bet = +stakeInp.value || 1;
    if (balance < bet){ tg.showAlert('Недостаточно средств'); return; }
    balance -= bet; drawBal();

    const game = $('#gameSelect').value;

    /* ---------- Wheel ---------- */
    if (game === 'wheel') {
      wheel.stopAnimation(false); wheel.rotationAngle=0; wheel.draw();
      const idx = pickByWeight(cfg.wheelWeights);
      wheel.animation.stopAngle = wheel.getRandomForSegment(idx+1);
      wheel.startAnimation();

      function onWheelStop(){
        balance += mult[idx]*bet; drawBal();
      }

    /* ---------- Apple ---------- */
    } else if (game === 'apple') {
      field.innerHTML=''; apples=[]; bombsReal.clear(); bombsShow.clear();
      opened=0; appleMul=1; cashBtn.style.display='none';

      const shown = +bombSel.value;
      const total = Math.min(24, shown + cfg.appleRig);
      while(bombsReal.size<total) bombsReal.add(Math.floor(Math.random()*25));
      bombsShow = new Set([...bombsReal].sort(()=>0.5-Math.random()).slice(0,shown));

      for(let i=0;i<25;i++){
        const d=document.createElement('div');d.className='cell';d.textContent='🍏';
        d.onclick=()=>openApple(i); field.appendChild(d); apples.push(d);
      }

      function openApple(i){
        if(apples[i].classList.contains('open')) return;
        apples[i].classList.add('open');
        if(bombsReal.has(i)){          // проигрыш
          if(!bombsShow.has(i)){ bombsShow.delete([...bombsShow][0]); bombsShow.add(i); }
          bombsShow.forEach(j=>{apples[j].classList.add('open'); apples[j].textContent='🐛';});
          return;
        }
        opened++; appleMul = +(1+opened*0.2).toFixed(2);
        apples[i].textContent='🍎';
        cashBtn.textContent=`Забрать ×${appleMul.toFixed(2)}`;
        cashBtn.style.display='block';
      }
      cashBtn.onclick = ()=>{balance+=bet*appleMul;drawBal();cashBtn.style.display='none';};

    /* ---------- Crash ---------- */
    } else {
      crashMul=1;
      crashLimit = +(1.5+Math.random()*(cfg.crashMax-1.5)).toFixed(2);
      crashScreen.textContent='x1.00'; crashBtn.textContent='Забрать x1.00'; crashBtn.style.display='block';

      crashTimer=setInterval(()=>{
        crashMul = +(crashMul+0.05).toFixed(2);
        crashScreen.textContent=`x${crashMul.toFixed(2)}`;
        crashBtn.textContent   =`Забрать x${crashMul.toFixed(2)}`;
        if(crashMul>=crashLimit){
          clearInterval(crashTimer); crashBtn.style.display='none';
          crashScreen.textContent='💥 CRASH';
        }
      },200);

      crashBtn.onclick = ()=>{clearInterval(crashTimer); balance+=bet*crashMul; drawBal(); crashBtn.style.display='none'; };
    }
  };
})();
