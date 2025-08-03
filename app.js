/* ===== Lucky Spin widget – full bundle (v17) ===== */
(() => {

  const supa = supabase.createClient(
    'https://paervwnoqseumvxmvhru.supabase.co',       
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZXJ2d25vcXNldW12eG12aHJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyMDUyNywiZXhwIjoyMDY5Nzk2NTI3fQ.4ycLy1DetjmYePpJ3OULWPbk3UKFGcrZXvMN_T5tZBk'
  );
  /* ---------- cfg из URL ---------- */
  const uid = new URL(location.href).searchParams.get('uid');
  let balance = 0, CONFIG = {};
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
  const baseCost = 1;
  /* инициализация */
  (async () => {
    const [{ data: user }, { data: cfg }] = await Promise.all([
       supa.from('users').select('balance').eq('telegram_id', uid).single(),
       supa.from('casino_cfg').select('*').eq('id', 1).single()
    ]);
    balance = user ? +user.balance : 0;
    CONFIG  = cfg;
    drawBalance();
  })();

  supa.channel('bal_' + uid)
    .on('postgres_changes',{event:'UPDATE',table:'users',filter:`telegram_id=eq.${uid}`},
       payload => { balance = +payload.new.balance; drawBalance(); })
    .subscribe();


  /* ---------- заполнение селектов ---------- */
  for(let i=1;i<=20;i++){ const o=document.createElement('option');o.value=i;o.textContent=i;bombPick.appendChild(o);}
  bombPick.value=5;

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

  const pickByWeight = w => {
    let s = w.reduce((a,b) => a + b ,0), 
        r = Math.random()*s,
        a = 0;
        for(let i=0;i<w.length;i++) {
          a += w[i];
          if (r < a)
            return i;
        }
        return 7;
      };

  const wheel=new Winwheel({
    canvasId:'canvas',numSegments:8,outerRadius:140,
    textFontSize:20,textFillStyle:'#fff',
    segments:labels.map((t,i)=>({text:t,fillStyle:colors[i]})),
    animation:{type:'spinToStop',duration:8,spins:7,
    callbackFinished:() => {
    const idx = wheel.getIndicatedSegmentNumber() - 1;   // 0..7
    const win = mult[idx] * curStake;
    balance += win;
    drawBalance();
    enablePlay();
    finishRound(win, 'wheel'); 
  }}
  });
  (()=>{const c=$('canvas').getContext('2d');c.fillStyle='#ffea00';
        c.beginPath();c.moveTo(138,8);c.lineTo(142,8);c.lineTo(140,26);c.fill();})();

  function startWheel(){ 
    disablePlay('Крутится…');
    wheel.stopAnimation(false); wheel.rotationAngle=0; wheel.draw();
    const stop = pickByWeight(CONFIG.wheelWeights)+1;
    wheel.animation.stopAngle = wheel.getRandomForSegment(stop);
    wheel.startAnimation();
  }

  /* ===================================================================== *
   * 2) APPLE OF FORTUNE                                                   *
   * ===================================================================== */
  const field=$('appleField'), 
        cashBtn=$('appleCashBtn');
  let cells=[], bombsReal=new Set(), bombsShow=new Set(),
    bombsShown=0, opened=0, appleMul=1, appleOver=false;

  /* ---------- превью-поле: просто 25 зелёных яблок ---------- */
  function drawApplePreview(){
    field.innerHTML='';
    for(let i=0;i<25;i++){
      const d=document.createElement('div');
      d.className='cell'; d.innerHTML='<span>🍏</span>';
      field.appendChild(d);
    }
    field.classList.add('blocked');        // клики отключены
  }
  drawApplePreview();                      // ← вызываем один раз при загрузке


  function prepareApple(){
    curStake = stake();
    field.innerHTML=''; field.classList.remove('blocked');
    cells=[]; bombsReal.clear(); bombsShow.clear(); opened=0; appleMul=1; appleOver=false;

    bombsShown=+bombPick.value;
    const total=Math.min(24,bombsShown+CONFIG.appleRig);
    while(bombsReal.size<total) bombsReal.add(Math.floor(Math.random()*25));
    bombsShow=new Set([...bombsReal].sort(()=>0.5-Math.random()).slice(0,bombsShown));

    cashBtn.style.display='none'; 
    cashBtn.textContent=`Забрать ${fmtCoins(curStake * appleMul)}`;
    for(let i=0;i<25;i++){
      const d=document.createElement('div');
      d.className='cell';
      d.innerHTML = '<span>🍏</span>';
      d.onclick=()=>openApple(i); field.appendChild(d); cells.push(d);}
  }

  function openApple(i){
    if(appleOver || cells[i].classList.contains('open')) return;
    cells[i].classList.add('open');

    if(bombsReal.has(i)){                       /* проигрыш */
      if(!bombsShow.has(i)){const [f]=bombsShow; bombsShow.delete(f); bombsShow.add(i);}
      bombsShow.forEach(j=>{cells[j].classList.add('open');
        cells[j].innerHTML = '<span>🐛</span>';});
      appleGameEnd(); setTimeout(()=>finishRound(0,'appleLoss'),600); return;
    }
    opened++;
    /* --- новый “математический” фактор --- */
    const S   = 25 - bombsReal.size - opened + CONFIG.appleRig; // безопасно осталось
    const T   = 25 - opened;                  // всего осталось
    const p   = S / T;
    const edge = CONFIG.edge;                        // маржа казино (15 %)
    const factor = (1 / p) * (1 - edge);
    appleMul = +(appleMul * factor).toFixed(2);
    cells[i].innerHTML='<span>🍎</span>';
    cashBtn.textContent=`Забрать ${fmtCoins(curStake * appleMul)}`;
    cashBtn.style.display='block';
  }

  cashBtn.onclick=_=>{
    if(appleOver) return;
    balance+=curStake*appleMul; drawBalance();
    bombsShow.forEach(i=>{cells[i].classList.add('open');cells[i].innerHTML='<span>🐛</span>';});
    appleGameEnd(); 
    finishRound(curStake * appleMul,'appleWin');
  };
  const appleGameEnd=_=>{appleOver=true; field.classList.add('blocked'); cashBtn.style.display='none';};

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
    balance+=stake()*crashMul; drawBalance(); finishRound(curStake * crashMul,'crashWin');
  };

  /* ===================================================================== *
   *   «Играть!» / итог раунда                                             *
   * ===================================================================== */
  let curStake=1;
  const disablePlay=t=>{actionBtn.disabled=true;actionBtn.textContent=t;};
  const enablePlay =_=>{actionBtn.disabled=false;actionBtn.textContent='Играть!';};

  actionBtn.onclick=_=>{
    if(balance<stake()){tg.showAlert('Недостаточно средств');return;}
    curStake=stake(); 
    balance-=curStake; 
    drawBalance();
    tg.sendData(JSON.stringify({type:'bet',stake:curStake}));

    switch(gameSel.value){
      case 'wheel': startWheel();break;
      case 'apple': prepareApple(); disablePlay('Открой яблочко'); break;
      case 'crash': startCrash();  disablePlay('Идёт раунд…'); break;
    }
  };

  async function finishRound(payout, kind) {
  enablePlay();

  // 1. Отправка ставки
  await supa.from('bets').insert({
    user_id: uid,
    game: kind,
    stake: curStake,
    payout: payout
  });

  // 2. Вручную обновить баланс
  await supa.from('users')
    .update({ balance: balance + payout - curStake })
    .eq('telegram_id', uid);

  // 3. Перечитать актуальный баланс
  const { data: u } = await supa
    .from('users')
    .select('balance')
    .eq('telegram_id', uid)
    .single();

  balance = +u.balance;
  drawBalance();
}

})();
