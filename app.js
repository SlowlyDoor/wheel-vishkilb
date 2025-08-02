/* app.js – логика прежняя, добавлены лишь спец-эффекты */
(() => {
  /* ----- Telegram Web-App ----- */
  const tg = window.Telegram?.WebApp || { expand(){}, ready(){}, sendData:console.log, showAlert:alert };
  tg.expand(); tg.ready();

  /* ----- параметры ----- */
  const url = new URL(location.href);
  let balance = +url.searchParams.get('bal') || 0;
  const baseCost = +url.searchParams.get('cost') || 1;

  /* ----- элементы DOM ----- */
  const sel      = id => document.getElementById(id);
  const gameSel  = sel('gameSelect');
  const stakeInp = sel('stakeInput');
  const balanceEl= sel('balance');
  const btn      = sel('actionBtn');
  const views    = {wheel:sel('wheelGame'),coin:sel('coinGame'),dice:sel('diceGame')};

  /* ставки/баланс */
  const stake = () => Math.max(1, +stakeInp.value || 1) * baseCost;
  const draw  = () => balanceEl.textContent = `Баланс: ${isNaN(balance)?'…':balance} 🪙`;
  stakeInp.addEventListener('input',draw); draw();

  /* смена игры */
  gameSel.addEventListener('change', e=>{
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views[e.target.value].classList.add('active');
  });

  /* ---------- 1) Колесо ---------- */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'];
  const mult  =[ 0  , 2  , 0  , 5 , 0  , 3 , 10 , 55 ];
  const colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];
  const wheel = new Winwheel({
    canvasId:'canvas',numSegments:labels.length,outerRadius:160,
    textFontSize:22,textFillStyle:'#fff',textOutlineWidth:0,lineWidth:0,
    segments:labels.map((t,i)=>({fillStyle:colors[i],text:t})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:onStop}
  });
  const ctx=sel('canvas').getContext('2d');
  const drawPointer=()=>{
    ctx.save();
    ctx.fillStyle='#ffea00';
    ctx.beginPath();ctx.moveTo(158,8);ctx.lineTo(162,8);ctx.lineTo(160,28);
    ctx.closePath();ctx.filter='drop-shadow(0 0 6px #ffea00)';ctx.fill();ctx.restore();
  }; drawPointer();

  function startWheel(){
    btn.disabled=true;btn.textContent='Крутится…';
    wheel.stopAnimation(false);wheel.rotationAngle=0;wheel.draw();drawPointer();
    wheel.animation.stopAngle = wheel.getRandomForSegment(Math.floor(Math.random()*labels.length)+1);
    wheel.startAnimation();
  }
  function onStop(){
    const idx=wheel.getIndicatedSegmentNumber()-1;
    complete(mult[idx]*curStake,'spin');
  }

  /* ---------- 2) Монетка ---------- */
  const coinEl=sel('coin');
  let coinBusy=false;
  function flipCoin(){
    if(coinBusy)return;coinBusy=true;
    coinEl.classList.remove('flip');void coinEl.offsetWidth; // reset anim
    coinEl.classList.add('flip');
    setTimeout(()=>{
      const heads=Math.random()<.5;
      coinEl.textContent=heads?'🪙':'💰';
      complete(heads?2*curStake:0,'coin');
      coinBusy=false;
    },600);
  }

  /* ---------- 3) Кубик ---------- */
  const diceEl=sel('dice');
  const faces=['⚀','⚁','⚂','⚃','⚄','⚅'];
  let diceBusy=false;
  function rollDice(){
    if(diceBusy)return;diceBusy=true;
    diceEl.style.transform = `rotateX(${360+Math.random()*720}deg) rotateY(${360+Math.random()*720}deg)`;
    setTimeout(()=>{
      const n=Math.floor(Math.random()*6);
      diceEl.textContent=faces[n];
      complete((n+1)*curStake,'dice');
      diceBusy=false;
    },1000);
  }

  /* ---------- старт по кнопке ---------- */
  let curStake=1;
  btn.onclick=_=>{
    if(coinBusy||diceBusy)return;
    curStake=stake();
    if(balance<curStake){tg.showAlert('Недостаточно средств');return;}
    balance-=curStake;draw();

    {'wheel':startWheel,'coin':flipCoin,'dice':rollDice}[gameSel.value]();
  };

  /* ---------- финализировать раунд ---------- */
  function complete(payout,type){
    balance+=payout;draw();
    tg.sendData(JSON.stringify({type,stake:curStake,payout}));
    btn.disabled=false;btn.textContent='Играть!';
  }
})();
