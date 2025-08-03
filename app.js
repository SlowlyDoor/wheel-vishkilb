/* ===== Casino Widget logic (v2) ===== */
(() => {
  const url  = new URL(location.href);
  const CONFIG  = url.searchParams.get('cfg')
             ? JSON.parse(atob(url.searchParams.get('cfg')))
             : { wheelWeights:[200,50,200,40,200,30,5,1], appleRig:3, crashMax:5 };


  /* ---------- Telegram helpers ---------- */
  const tg = window.Telegram?.WebApp || {expand(){},ready(){},sendData:console.log,showAlert:alert};
  tg.expand(); tg.ready();

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);
  const stakeInp  = $('stakeInput');
  const balanceEl = $('balance');
  const gameSel   = $('gameSelect');
  const actionBtn = $('actionBtn');
  const plusStake = $('plusStake');
  const minusStake= $('minusStake');
  const bombPick  = $('bombPick');

  /* заполняем селект 1-20 */
  for(let i=1;i<=20;i++){
    const o=document.createElement('option');o.value=i;o.textContent=i;bombPick.appendChild(o);
  }
  bombPick.value = 5;            // дефолт

  /* ---------- URL-params ---------- */
  let   balance   = +url.searchParams.get('bal')  || 0;
  const baseCost  = +url.searchParams.get('cost') || 1;

  /* ---------- helpers ---------- */
  const stake = () => Math.max(1, +stakeInp.value || 1) * baseCost;
  const fmt   = n => n.toFixed(2);
  const drawBalance = () =>
      balanceEl.textContent = `Баланс: ${isNaN(balance)?'…':fmt(balance)} 🪙`;
  drawBalance();

  /* +/- кнопки ставки */
  plusStake.onclick  = _=>{ stakeInp.stepUp(); };
  minusStake.onclick = _=>{ stakeInp.stepDown(); };
  stakeInp.oninput   = drawBalance;

  /* ---------- переключение игр ---------- */
  const views = {wheel:$('wheelGame'),apple:$('appleGame'),crash:$('crashGame')};
  gameSel.onchange = e=>{
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views[e.target.value].classList.add('active');
  };

  /* ===================================================================== *
   * 1) WHEEL                                                              *
   * ===================================================================== */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'];
  const mult  =[ 0  , 2  , 0  , 5 , 0  , 3 , 10 , 55 ];
  const colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff',
                '#ffea00','#d400ff','#ffea00'];

  const pickByWeight = w=>{
    const s=w.reduce((a,b)=>a+b,0);
    let r=Math.random()*s,a=0;
    for(let i=0;i<w.length;i++){ a+=w[i]; if(r<a) return i; }
    return w.length-1;
  };

  const wheel = new Winwheel({
    canvasId:'canvas',numSegments:labels.length,outerRadius:160,
    textFontSize:22,textFillStyle:'#fff',textOutlineWidth:0,lineWidth:0,
    segments:labels.map((t,i)=>({fillStyle:colors[i],text:t})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:onWheelStop}
  });
  const ctx=$('canvas').getContext('2d');
  const drawPointer=()=>{
    ctx.save();ctx.fillStyle='#ffea00';
    ctx.beginPath();ctx.moveTo(158,8);ctx.lineTo(162,8);ctx.lineTo(160,28);
    ctx.closePath();ctx.filter='drop-shadow(0 0 6px #ffea00)';ctx.fill();ctx.restore();
  }; drawPointer();

  /* --------------------------------------------------------------------- */
  let curStake=1;
  function startWheel(){
    disablePlay('Крутится…');
    wheel.stopAnimation(false);wheel.rotationAngle=0;wheel.draw();drawPointer();
    const stopSeg = pickByWeight(CONFIG.wheelWeights)+1;
    wheel.animation.stopAngle = wheel.getRandomForSegment(stopSeg);
    wheel.startAnimation();
  }
  function onWheelStop(){
    const idx = wheel.getIndicatedSegmentNumber()-1;
    finishRound(mult[idx]*curStake,'wheel');
  }

  /* ===================================================================== *
   * 2) APPLE OF FORTUNE                                                   *
   * ===================================================================== */
  const field   = $('appleField');
  const cashBtn = $('appleCashBtn');
  let apples=[], bombsReal=new Set(), bombsDisplay=new Set(), bombsShown=0, opened=0, appleMul=1;
  function prepareApple(){
    field.innerHTML='';
    apples=[]; bombsReal.clear(); bombsDisplay.clear();
    opened=0; appleMul=1;

    bombsShown = +bombPick.value;                                  // видимое кол-во
    const targetBombs = Math.min(24, bombsShown + CONFIG.appleRig);// реальное кол-во

    /* --- распределяем бомбы --- */
    while (bombsReal.size < targetBombs)         
      bombsReal.add(Math.floor(Math.random()*25));

    // выбираем, какие из них игрок увидит при проигрыше
    const shuffled = [...bombsReal].sort(() => 0.5 - Math.random());
    bombsDisplay = new Set(shuffled.slice(0, bombsShown));
    cashBtn.style.display='none';cashBtn.textContent='Забрать ×1.00';

    for(let i=0;i<25;i++){
      const c=document.createElement('div');
      c.className='cell';c.textContent='🍏';
      c.onclick=()=>openApple(i);
      field.appendChild(c);apples.push(c);
    }
  }

  function openApple(idx){
    if(apples[idx].classList.contains('open')) return;

    apples[idx].classList.add('open');

    if (bombsReal.has(idx)) {               // ► проиграли
      /* ▸ гарантируем, что увидим ровно bombsShown штук */
      if (!bombsDisplay.has(idx)) {         // «лишняя» бомба спровоцировала поражение
        // заменяем случайную из отображаемых
        const [first] = bombsDisplay;       // берём любой
        bombsDisplay.delete(first);
        bombsDisplay.add(idx);
      }

      bombsDisplay.forEach(i=>{
        apples[i].classList.add('open');
        apples[i].textContent = '🐛';
      });

      gsap.to(apples[idx], {scale:1.2,yoyo:true,repeat:3,duration:0.15});
      cashBtn.style.display='none';
      setTimeout(()=>finishRound(0,'appleLoss'),600);
      return;
    }

    opened++;
    appleMul = +(1 + opened*0.2).toFixed(2);
    apples[idx].textContent='🍎';
    cashBtn.textContent=`Забрать ×${appleMul.toFixed(2)}`;
    cashBtn.style.display='block';
  }
  cashBtn.onclick = _=> finishRound(curStake*appleMul,'appleWin');

  /* ===================================================================== *
   * 3) CRASH                                                              *
   * ===================================================================== */
  const crashScreen=$('crashScreen');
  const crashBtn   =$('crashCashBtn');
  let crashTimer=null, crashMul=1, crashLimit=2;

  function startCrash(){
    crashMul=1;
    crashLimit = +(CONFIG.crashMin + Math.random()*(CONFIG.crashMax-CONFIG.crashMin)).toFixed(2);
    crashScreen.textContent='x1.00';
    crashBtn.textContent   ='Забрать x1.00';
    crashBtn.style.display='block';

    crashTimer=setInterval(()=>{
      crashMul = +(crashMul + CONFIG.crashStep).toFixed(2);
      crashScreen.textContent=`x${crashMul.toFixed(2)}`;
      crashBtn.textContent   =`Забрать x${crashMul.toFixed(2)}`;

      if(crashMul>=crashLimit){
        clearInterval(crashTimer);
        crashBtn.style.display='none';
        gsap.to(crashScreen,{scale:1.3,yoyo:true,repeat:3,duration:0.15,onComplete:()=>{
          crashScreen.textContent='💥 CRASH';
          finishRound(0,'crashLoss');
        }});
      }
    },CONFIG.crashInterval);
  }
  crashBtn.onclick=_=>{
    clearInterval(crashTimer);
    crashBtn.style.display='none';
    finishRound(curStake*crashMul,'crashWin');
  };

  /* ===================================================================== *
   *  Кнопка «Играть!» / итог раунда                                       *
   * ===================================================================== */
  function disablePlay(txt){actionBtn.disabled=true;actionBtn.textContent=txt}
  function enablePlay(){actionBtn.disabled=false;actionBtn.textContent='Играть!'}

  actionBtn.onclick=_=>{
    if(balance<stake()){tg.showAlert('Недостаточно средств');return;}

    curStake=stake();
    balance-=curStake;drawBalance();
    tg.sendData(JSON.stringify({type:'bet',stake:curStake}));

    switch(gameSel.value){
      case 'wheel': startWheel();   break;
      case 'apple': prepareApple(); disablePlay('Открой яблочко'); break;
      case 'crash': startCrash();   disablePlay('Идёт раунд…');    break;
    }
  };

  function finishRound(payout,kind){
    payout = +payout.toFixed(2);
    balance = +(balance + payout).toFixed(2);
    drawBalance();
    tg.sendData(JSON.stringify({type:kind,stake:curStake,payout}));
    enablePlay();
  }
})();
