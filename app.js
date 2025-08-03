/* ===== Lucky Spin widget – full bundle (v17) ===== */
(() => {
  /* ---------- cfg из URL ---------- */
  const url = new URL(location.href);
  const cfgParam = url.searchParams.get('cfg');
  const DEF = {
    wheelWeights:[200,50,200,40,200,30,5,1],
    appleRig:3,
    crashMin:1.5, crashMax:5, crashStep:0.05, crashInterval:200, crashZeroProb:0.05
  };
  const CONFIG = cfgParam
        ? {...DEF, ...JSON.parse(atob(cfgParam.replace(/-/g,'+').replace(/_/g,'/')
                 .padEnd(cfgParam.length+(4-cfgParam.length%4)%4,'=')))}
        : DEF;

  /* ---------- Telegram helpers ---------- */
  const tg = window.Telegram?.WebApp || {expand(){},ready(){},sendData:console.log,showAlert:alert};
  tg.expand(); tg.ready();

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);
  const stakeInp   = $('stakeInput');
  const balanceEl  = $('balance');
  const gameSel    = $('gameSelect');
  const actionBtn  = $('actionBtn');

  /* stake buttons */
  const add1Btn    = $('stakeAdd1');
  const sub1Btn    = $('stakeSub1');
  const mul2Btn    = $('stakeMul2');
  const div2Btn    = $('stakeDiv2');
  const minBtn     = $('stakeMin');
  const maxBtn     = $('stakeMax');

  const bombPick  = $('bombPick');

  /* ---------- заполнение селектов ---------- */
  for(let i=1;i<=20;i++){ const o=document.createElement('option');o.value=i;o.textContent=i;bombPick.appendChild(o);}
  bombPick.value=5;

  /* ---------- URL-параметры ---------- */
  let   balance  = +url.searchParams.get('bal')  || 0;
  const baseCost = +url.searchParams.get('cost') || 1;

  /* ---------- helpers ---------- */
  const fmt=n=>n.toFixed(2);
  const fmtCoins = n => `${fmt(n)} 🪙`;
  const stake = () => Math.max(1, +stakeInp.value||1)*baseCost;
  const drawBalance = () => balanceEl.textContent = `Баланс: ${isNaN(balance)?'…':fmt(balance)} 🪙`;
  const setStake = v => { stakeInp.value=Math.max(1,Math.floor(v)); drawBalance(); };

  drawBalance();

  /* stake btns */
  add1Btn.onclick =_=> setStake(+stakeInp.value+1);
  sub1Btn.onclick =_=> setStake(+stakeInp.value-1);
  mul2Btn.onclick =_=> setStake(+stakeInp.value*2);
  div2Btn.onclick =_=> setStake(+stakeInp.value/2);
  minBtn .onclick=_=> setStake(1);
  maxBtn .onclick=_=> setStake(balance);
  stakeInp.oninput=drawBalance;

  /* ---------- переключение игр ---------- */
  const views={wheel:$('wheelGame'),apple:$('appleGame'),crash:$('crashGame')};
  gameSel.onchange=e=>{Object.values(views).forEach(v=>v.classList.remove('active'));
                       views[e.target.value].classList.add('active');};

  /* ===================================================================== *
   * 1) WHEEL                                                              *
   * ===================================================================== */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'],
        mult  =[0,2,0,5,0,3,10,55],
        colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];

  const pickByWeight=w=>{let s=w.reduce((a,b)=>a+b,0),r=Math.random()*s,a=0;
                         for(let i=0;i<w.length;i++){a+=w[i];if(r<a)return i;}return 7;};

  const wheel=new Winwheel({
    canvasId:'canvas',numSegments:8,outerRadius:140,
    textFontSize:20,textFillStyle:'#fff',
    segments:labels.map((t,i)=>({text:t,fillStyle:colors[i]})),
    animation:{type:'spinToStop',duration:8,spins:7,callbackFinished:() => {
    const idx = wheel.getIndicatedSegmentNumber() - 1;   // 0..7
    balance += mult[idx] * curStake;
    drawBalance();
    enablePlay();
  }}
  });
  (()=>{const c=$('canvas').getContext('2d');c.fillStyle='#ffea00';
        c.beginPath();c.moveTo(138,8);c.lineTo(142,8);c.lineTo(140,26);c.fill();})();

  function startWheel(){ disablePlay('Крутится…');
    wheel.stopAnimation(false); wheel.rotationAngle=0; wheel.draw();
    const stop = pickByWeight(CONFIG.wheelWeights)+1;
    wheel.animation.stopAngle = wheel.getRandomForSegment(stop);
    wheel.startAnimation();
  }

  /* ===================================================================== *
   * 2) APPLE OF FORTUNE                                                   *
   * ===================================================================== */
  const field   = $('appleField'),
        cashBtn = $('appleCashBtn');

  let cells      = [],            // div-элементы клеток
      bombsReal  = new Set(),     // реальные бомбы (🐛)
      bombsShow  = new Set(),     // какие покажем при проигрыше
      bombsShown = 0,             // число, выбранное ребёнком
      opened     = 0,             // сколько уже открыто
      appleMul   = 1.0,           // текущий множитель
      appleOver  = false;         // игра закончилась?

  /* ---------- превью-поле: просто 25 зелёных яблок ---------- */
  function drawApplePreview () {
    field.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const d = document.createElement('div');
      d.className  = 'cell';
      d.innerHTML  = '<span>🍏</span>';
      field.appendChild(d);
    }
    field.classList.add('blocked');        // клики отключены
  }
  drawApplePreview();                      // ← при загрузке

  /* ---------- старт раунда ---------- */
  function prepareApple () {
    field.innerHTML = '';
    field.classList.remove('blocked');

    cells     = [];
    bombsReal.clear();
    bombsShow.clear();
    opened    = 0;
    appleMul  = 1.0;
    appleOver = false;

    bombsShown = +bombPick.value;                          // видимое кол-во
    const total = Math.min(24, bombsShown + CONFIG.appleRig);

    /* реальные бомбы */
    while (bombsReal.size < total)
      bombsReal.add(Math.floor(Math.random() * 25));

    /* какие из них покажем при проигрыше */
    bombsShow = new Set([...bombsReal].sort(() => 0.5 - Math.random())
                                     .slice(0, bombsShown));

    cashBtn.style.display  = 'none';
    cashBtn.textContent    = `Забрать ${fmtCoins(curStake)}`;

    /* поле 5×5 */
    for (let i = 0; i < 25; i++) {
      const d   = document.createElement('div');
      d.className = 'cell';
      d.innerHTML = '<span>🍏</span>';
      d.onclick   = () => openApple(i);
      field.appendChild(d);
      cells.push(d);
    }
  }

  /* ---------- клик по клетке ---------- */
  function openApple (idx) {
    if (appleOver || cells[idx].classList.contains('open')) return;

    cells[idx].classList.add('open');

    /* 🐛 — ПРОИГРЫШ */
    if (bombsReal.has(idx)) {
      if (!bombsShow.has(idx)) {                  // «лишняя» бомба
        const [f] = bombsShow;
        bombsShow.delete(f);
        bombsShow.add(idx);
      }
      bombsShow.forEach(i => {
        cells[i].classList.add('open');
        cells[i].innerHTML = '<span>🐛</span>';
      });
      appleGameEnd();
      setTimeout(() => finishRound(0, 'appleLoss'), 600);
      return;
    }

    /* 🍏 — УСПЕХ */
    opened++;

    /* ------ новый множитель: честный + маржа --------
       S — безопасных клеток осталось
       T — клеток всего осталось
       p = S / T
       k0 = 1 / p
       k  = k0 * (1 - edge)                               */
    const S    = 25 - bombsReal.size - opened;
    const T    = 25 - opened;
    const edge = 0.15;                       // 15 % комиссия казино
    const factor = (T / S) * (1 - edge);

    appleMul = +(appleMul * factor).toFixed(2);

    cells[idx].innerHTML = '<span>🍎</span>';
    cashBtn.textContent  = `Забрать ${fmtCoins(curStake * appleMul)}`;
    cashBtn.style.display = 'block';
  }

  /* ---------- «Забрать» ---------- */
  cashBtn.onclick = () => {
    if (appleOver) return;
    balance += curStake * appleMul;
    drawBalance();

    bombsShow.forEach(i => {
      cells[i].classList.add('open');
      cells[i].innerHTML = '<span>🐛</span>';
    });

    appleGameEnd();
    finishRound(0, 'appleWin');
  };

  /* ---------- финиш ---------- */
  const appleGameEnd = () => {
    appleOver = true;
    field.classList.add('blocked');
    cashBtn.style.display = 'none';
  };

  /* ===================================================================== *
   * 3) CRASH                                                              *
   * ===================================================================== */
  const crashScr=$('crashScreen'), crashBtn=$('crashCashBtn');
  let crashT=null, crashMul=1, crashLimit=2, zeroCrash=false, dec=2;
  const fmtM=v=>`x${v.toFixed(dec)}`;

  function startCrash(){
    zeroCrash=Math.random()<CONFIG.crashZeroProb;
    if(zeroCrash){
      crashScr.textContent='0×'; crashBtn.style.display='none';
      setTimeout(()=>{crashScr.textContent='💥 CRASH 0×'; finishRound(0,'crashZero');},800);
      return;
    }
    crashMul=1;
    crashLimit=+(CONFIG.crashMin+Math.random()*(CONFIG.crashMax-CONFIG.crashMin)).toFixed(2);
    dec=Math.min(3,Math.max(2,(CONFIG.crashStep.toString().split('.')[1]||'').length));
    crashScr.textContent=fmtM(crashMul); 
    crashBtn.textContent=`Забрать ${fmtCoins(curStake * crashMul)}`;
    crashBtn.style.display='block';

    const factor=1+CONFIG.crashStep;
    crashT=setInterval(()=>{
      crashMul=+(crashMul*factor).toFixed(dec);
      crashScr.textContent=fmtM(crashMul);
      crashBtn.textContent=`Забрать ${fmtCoins(curStake * crashMul)}`;
      if(crashMul>=crashLimit){
        clearInterval(crashT); crashBtn.style.display='none';
        crashScr.textContent='💥 CRASH'; finishRound(0,'crashLoss');
      }
    },CONFIG.crashInterval);
  }

  crashBtn.onclick=_=>{
    if(zeroCrash) return;
    clearInterval(crashT); crashBtn.style.display='none';
    balance+=stake()*crashMul; drawBalance(); finishRound(0,'crashWin');
  };

  /* ===================================================================== *
   *   «Играть!» / итог раунда                                             *
   * ===================================================================== */
  let curStake=1;
  const disablePlay=t=>{actionBtn.disabled=true;actionBtn.textContent=t;};
  const enablePlay =_=>{actionBtn.disabled=false;actionBtn.textContent='Играть!';};

  actionBtn.onclick=_=>{
    if(balance<stake()){tg.showAlert('Недостаточно средств');return;}
    curStake=stake(); balance-=curStake; drawBalance();
    tg.sendData(JSON.stringify({type:'bet',stake:curStake}));

    switch(gameSel.value){
      case 'wheel': startWheel();break;
      case 'apple': prepareApple(); disablePlay('Открой яблочко'); break;
      case 'crash': startCrash();  disablePlay('Идёт раунд…'); break;
    }
  };

  function finishRound(_,kind){ enablePlay(); tg.sendData(JSON.stringify({type:kind})); }
})();
