/* app.js – 3-в-1: колесо, монетка, кубик */
(() => {
  /* ---------- Telegram Web-App ---------- */
  const tg = window.Telegram?.WebApp
        || { expand(){}, ready(){}, sendData:console.log, showAlert:alert };
  tg.expand(); tg.ready();

  /* ---------- URL-параметры ---------- */
  const url      = new URL(location.href);
  let   balance  = parseInt(url.searchParams.get('bal')  || '0', 10);
  const baseCost = parseInt(url.searchParams.get('cost') || '1', 10);

  /* ---------- DOM ---------- */
  const balEl     = document.getElementById('balance');
  const stakeEl   = document.getElementById('stakeInput');
  const actionBtn = document.getElementById('actionBtn');
  const gameSel   = document.getElementById('gameSelect');

  /* инфо-поля */
  const infoWheel = document.getElementById('infoWheel');
  const infoCoin  = document.getElementById('infoCoin');
  const infoDice  = document.getElementById('infoDice');

  /* игровые блоки */
  const views = {
    wheel: document.getElementById('wheelGame'),
    coin : document.getElementById('coinGame'),
    dice : document.getElementById('diceGame'),
  };

  /* ---------- stake / UI ---------- */
  const stake = _ => Math.max(1, parseInt(stakeEl.value,10)||1) * baseCost;
  const drawUI = () => {
    balEl.textContent = `Баланс: ${isNaN(balance)?'…':balance} 🪙`;
    infoWheel.textContent = `Стоимость спина: ${stake()} 🪙`;
    infoCoin.textContent  = `Стоимость броска: ${stake()} 🪙`;
    infoDice.textContent  = `Стоимость броска: ${stake()} 🪙`;
  };
  drawUI();
  stakeEl.addEventListener('input',drawUI);

  /* ---------- смена игры ---------- */
  gameSel.addEventListener('change',e=>{
    const id=e.target.value;
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views[id].classList.add('active');
  });

  /* ---------- 1) Колесо ---------- */
  const segs = ['0×','2×','0×','2×','0×','2×','55×'];
  const mult = [ 0 ,  2 , 0 ,  2 , 0 ,  2 , 55 ];
  const wght = [200,100,200,100,200,100,1];
  const clr  = ['#e91e63','#3f51b5','#2196f3','#009688','#9c27b0','#f44336','#ffd700'];

  const wheel = new Winwheel({
    canvasId :'canvas',
    numSegments: segs.length,
    outerRadius: 150,
    pointerAngle:0,
    textFontSize:18,
    segments: segs.map((t,i)=>({ fillStyle:clr[i], text:t })),
    animation:{
      type:'spinToStop', duration:8, spins:8,
      callbackFinished: finishSpin
    }
  });
  /* дорисовываем клюв */
  const ctx=document.getElementById('canvas').getContext('2d');
  const drawPointer=_=>{
    ctx.save();
    ctx.fillStyle='#ffeb3b';
    ctx.beginPath(); ctx.moveTo(140,5); ctx.lineTo(160,5); ctx.lineTo(150,23);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }; drawPointer();

  /* ---------- 2) Монетка ---------- */
  const coinEl=document.getElementById('coin');
  let coinLocked=false;
  const flipCoin=()=>{
    coinLocked=true;
    coinEl.classList.toggle('flip');          // анимация CSS
    setTimeout(()=>{
      const res=Math.random()<0.5?'heads':'tails';
      coinEl.textContent=res==='heads'?'🪙':'💰';
      endRound(res==='heads'?2:0,'coinFlipResult');
      coinLocked=false;
    },600);                                   // длительность .flip
  };

  /* ---------- 3) Кубик ---------- */
  const diceEl=document.getElementById('dice');
  const diceFaces=['⚀','⚁','⚂','⚃','⚄','⚅'];
  let diceLocked=false;
  const rollDice=()=>{
    diceLocked=true;
    diceEl.style.transform=`rotateX(${360+Math.random()*360}deg) rotateY(${360+Math.random()*360}deg)`;
    setTimeout(()=>{
      const n=1+Math.floor(Math.random()*6);
      diceEl.textContent=diceFaces[n-1];
      endRound(n, 'diceRollResult');
      diceLocked=false;
    },1000);
  };

  /* ---------- Кнопка "Играть!" ---------- */
  let currentStake=1;
  actionBtn.onclick=()=>{
    if(coinLocked||diceLocked) return;
    currentStake=stake();
    if(!isNaN(balance) && balance<currentStake){ tg.showAlert('Недостаточно средств'); return; }
    if(!isNaN(balance)){ balance-=currentStake; drawUI(); }

    switch(gameSel.value){
      case 'wheel': startWheel();  break;
      case 'coin' : flipCoin();    break;
      case 'dice' : rollDice();    break;
    }
  };

  /* ----- wheel helpers ----- */
  function startWheel(){
    actionBtn.disabled=true; actionBtn.textContent='Крутится…';
    wheel.stopAnimation(false); wheel.rotationAngle=0; wheel.draw(); drawPointer();

    /* сектор по весам */
    const sum=wght.reduce((s,w)=>s+w,0);
    let r=Math.random()*sum,acc=0,idx=0;
    for(let i=0;i<wght.length;i++){ acc+=wght[i]; if(r<acc){idx=i;break;} }

    wheel.animation.stopAngle=wheel.getRandomForSegment(idx+1);
    wheel.startAnimation();
  }
  function finishSpin(){
    const idx=wheel.getIndicatedSegmentNumber()-1;
    const payout=mult[idx]*currentStake;
    endRound(payout,'spinResult');
  }

  /* ----- общий финал раунда ----- */
  function endRound(payout,type){
    if(!isNaN(balance)){ balance+=payout; drawUI(); }
    tg.sendData(JSON.stringify({type, stake:currentStake, payout}));
    actionBtn.disabled=false; actionBtn.textContent='Играть!';
  }
})();
