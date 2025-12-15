/* ==========================
   game.js — Исправленная полная версия
   ========================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ================= ASSETS =================
const assets = {
   player: 'https://i.postimg.cc/SRw6LDRG/download-5-removebg-preview.png', // вставьте URL спрайта игрока
  enemy: 'https://i.postimg.cc/25z4xqjj/4acdbc38-c543-426d-a1eb-3fac2a7598c5-removebg-preview.png',  // вставьте URL спрайта врагов
  bg: 'https://i.postimg.cc/TPD03tqG/4bfdab83-8567-433d-bbf3-67efcd62f5eb.jpg', 
  bullet: ''  // вставьте URL спрайта пули
};

let playerImg=null, enemyImg=null, bgImg=null, bulletImg=null;
function loadImages(){
  if(assets.player){ playerImg = new Image(); playerImg.src = assets.player }
  if(assets.enemy){ enemyImg = new Image(); enemyImg.src = assets.enemy }
  if(assets.bg){ bgImg = new Image(); bgImg.src = assets.bg }
  if(assets.bullet){ bulletImg = new Image(); bulletImg.src = assets.bullet }
}
loadImages();

// ================= INPUT =================
const keys = {left:false,right:false,jumpHold:false,jumpPressed:false,shoot:false};
window.addEventListener('keydown', e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=true;
  if(e.code==='Space'){ if(!keys.jumpHold) keys.jumpPressed=true; keys.jumpHold=true }
  if(e.code==='KeyD') keys.shoot=true;
});
window.addEventListener('keyup', e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=false;
  if(e.code==='Space') keys.jumpHold=false;
  if(e.code==='KeyD') keys.shoot=false;
});

// ================= HELPERS =================
class Rect{ constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h} }
function overlap(a,b){ return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h) }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)) }

// ================= CLASSES =================
class Enemy{
  constructor(x,y,type=0){
    this.x=x; this.y=y; this.w=44; this.h=52; this.type=type; this.dead=false;
    this.hp = type===0?1:type===1?2:type===2?3:2;
    this.front = type===3;
    this.vx = (Math.random()<0.5?-1:1)*(type===2?0.6:type===3?0.6:1.0);
    this.originX = x; this.patrolRange=80;
  }
  rect(){ return new Rect(this.x,this.y,this.w,this.h) }
  update(){ this.x += this.vx; if(Math.abs(this.x - this.originX) > this.patrolRange) this.vx*=-1 }
  draw(){
    if(enemyImg && enemyImg.complete){
      ctx.drawImage(enemyImg,this.x,this.y,this.w,this.h)
    } else { ctx.fillStyle='#b44'; ctx.fillRect(this.x,this.y,this.w,this.h) }
  }
}

class Player{
  constructor(){ this.w=48; this.h=64; this.reset() }
  reset(){
    this.x=80; this.y=380; this.vx=0; this.vy=0;
    this.facing=1; this.onGround=false; this.canDouble=false; this.usedDouble=false;
    this.health=3; this.maxHealth=3; this.invuln=0; this.shootCd=0;
  }
  rect(){ return new Rect(this.x,this.y,this.w,this.h) }
  update(){
    const accel=0.9, maxSpeed=4.6;
    this.vx += (keys.left?-accel:0)+(keys.right?accel:0);
    this.vx *= 0.82; this.vx = clamp(this.vx,-maxSpeed,maxSpeed);
    if(keys.left) this.facing=-1; if(keys.right) this.facing=1;

    if(keys.jumpPressed){
      if(this.onGround){ this.vy=-13; this.onGround=false; this.usedDouble=false }
      else if(this.canDouble && !this.usedDouble){ this.vy=-12; this.usedDouble=true }
      keys.jumpPressed=false;
    }
    if(keys.jumpHold && this.vy<0) this.vy -= 0.3;

    this.vy += 0.9;
    this.x += this.vx; this.y += this.vy;
    this.x = clamp(this.x,0,W-this.w);

    if(this.y>H+500){ game.playerTakeDamage(1); respawnPlayer() }
    if(this.invuln>0) this.invuln--; if(this.shootCd>0) this.shootCd--;
  }
  draw(){
    if(playerImg && playerImg.complete){
      ctx.save();
      ctx.translate(this.x+this.w/2,this.y+this.h/2);
      ctx.scale(this.facing,1);
      ctx.drawImage(playerImg,-this.w/2,-this.h/2,this.w,this.h);
      ctx.restore();
    } else { ctx.fillStyle=this.invuln?'rgba(255,255,0,0.9)':'#1e7bd6'; ctx.fillRect(this.x,this.y,this.w,this.h) }
  }
}

class Bullet{ constructor(x,y,dir){ this.x=x; this.y=y; this.w=10; this.h=8; this.vx=dir*12; this.damage=1 }
  rect(){ return new Rect(this.x,this.y,this.w,this.h) }
  update(){ this.x += this.vx }
  draw(){ if(bulletImg && bulletImg.complete) ctx.drawImage(bulletImg,this.x,this.y,this.w,this.h); else { ctx.fillStyle='#66f'; ctx.fillRect(this.x,this.y,this.w,this.h) } }
}

class Platform{ constructor(x,y,w,h,type='normal',motion=null){ Object.assign(this,{x,y,w,h,type,motion}); this.baseX=x; this.baseY=y; this.broken=false }
  rect(){ return new Rect(this.x,this.y,this.w,this.h) }
  update(){ if(this.motion){ const t=Date.now()/1000; this.x=this.baseX+(this.motion.x||0)*Math.sin(t*(this.motion.speed||1)); this.y=this.baseY+(this.motion.y||0)*Math.cos(t*(this.motion.speed||1)); } }
  draw(){ if(this.type==='slippery') ctx.fillStyle='#9be'; else if(this.type==='breakable') ctx.fillStyle='#c64'; else ctx.fillStyle='#774'; ctx.fillRect(this.x,this.y,this.w,this.h) }
}

// ================= LEVELS =================
const LEVELS = [
  { name:'Лес Заблудших', difficulty:1, rune:'Земли', platforms:[ new Platform(0,480,960,60), new Platform(200,380,120,16), new Platform(420,320,120,16), new Platform(650,260,120,16) ], enemies:[ {x:320,y:430,type:0}, {x:540,y:430,type:0} ], items:[{type:'rune',x:700,y:200},{type:'heart',x:250,y:340}] },
  { name:'Пылающие Пещеры', difficulty:2, rune:'Огня', platforms:[ new Platform(0,480,960,60), new Platform(160,380,120,16,{x:50,y:0,speed:1}), new Platform(360,300,120,16), new Platform(560,220,120,16) ], enemies:[ {x:300,y:430,type:1}, {x:520,y:430,type:1} ], items:[{type:'rune',x:560,y:180},{type:'coin',x:200,y:340}] },
  { name:'Хрустальные Горки', difficulty:3, rune:'Льда', platforms:[ new Platform(0,480,960,60), new Platform(180,380,120,16,'slippery'), new Platform(420,320,120,16,'slippery'), new Platform(680,260,120,16,'slippery') ], enemies:[ {x:280,y:430,type:2}, {x:600,y:430,type:2} ], items:[{type:'rune',x:720,y:200},{type:'heart',x:200,y:340}], unlocks:{doubleJump:true} },
  { name:'Паровой Город', difficulty:4, rune:'Металла', platforms:[ new Platform(0,480,960,60), new Platform(150,360,120,16,'normal',{x:50,y:0,speed:1}), new Platform(380,300,120,16), new Platform(620,240,120,16) ], enemies:[ {x:260,y:420,type:3}, {x:520,y:420,type:3} ], items:[{type:'rune',x:660,y:200},{type:'coin',x:350,y:260}] },
  { name:'Парящий Храм', difficulty:5, rune:'Воздуха', platforms:[ new Platform(0,480,960,60), new Platform(200,380,120,16,'breakable'), new Platform(430,320,120,16), new Platform(680,260,120,16,'breakable') ], enemies:[ {x:320,y:430,type:2}, {x:540,y:430,type:1} ], items:[{type:'rune',x:700,y:180},{type:'heart',x:240,y:340}] }
];

// ================= GAME STATE =================
const game = {
  levelIndex:0,
  player:new Player(),
  bullets:[],
  enemies:[],
  platforms:[],
  items:[],
  coins:0,
  runes:0,
  paused:false,
  levelComplete:false // исправлено: флаг перехода уровня
};

function initLevel(i){
  game.levelIndex=i;
  const L=LEVELS[i];
  game.player.reset();
  game.player.canDouble = L.unlocks?.doubleJump || false;
  game.player.maxHealth = L.unlocks?.doubleJump?4:3;
  game.player.health = game.player.maxHealth;
  game.bullets=[];
  game.enemies=L.enemies.map(e=> new Enemy(e.x,e.y,e.type));
  game.platforms=L.platforms.map(p=> new Platform(p.x,p.y,p.w,p.h,p.type,p.motion));
  game.items=L.items.map(it=>Object.assign({},it));
  game.coins=0; game.runes=0;
  game.levelComplete=false;
  updateHUD();
  setMessage('Уровень: '+L.name,1400);
}

function updateHUD(){
  document.getElementById('hearts').innerText='❤'.repeat(game.player.health);
  document.getElementById('runes').innerText='Руны: '+game.runes;
  document.getElementById('coins').innerText='Монеты: '+game.coins;
  document.getElementById('level').innerText='Уровень '+(game.levelIndex+1)+' — '+LEVELS[game.levelIndex].name;
}

function setMessage(text,ms){
  const el=document.getElementById('message');
  el.style.display='block'; el.innerText=text;
  if(ms) setTimeout(()=>el.style.display='none',ms);
}

function shoot(){
  const p=game.player;
  if(p.shootCd>0) return;
  const bx=p.x+(p.facing>0?p.w:-12), by=p.y+p.h/2;
  game.bullets.push(new Bullet(bx,by,p.facing));
  p.shootCd=12;
}

function respawnPlayer(){ game.player.x=80; game.player.y=380; game.player.vx=0; game.player.vy=0; }

game.playerTakeDamage = function(d){
  if(this.player.invuln>0) return;
  this.player.health -= d;
  this.player.invuln=60;
  updateHUD();
  if(this.player.health<=0) gameOver();
};

function gameOver(){
  setMessage('Game Over — начинаем сначала',2000);
  setTimeout(()=>initLevel(0),1200);
}

// ================= MAIN LOOP =================
let last=0;
function loop(ts){ const dt=ts-last; last=ts; update(dt); draw(); requestAnimationFrame(loop); }

function update(dt){
  if(game.paused) return;
  const p=game.player;
  p.update();
  game.platforms.forEach(pl=>pl.update());

  // platform collisions
  p.onGround=false;
  game.platforms.forEach(pl=>{
    if(overlap(p.rect(),pl.rect())){
      if(p.vy>0 && p.y+p.h - p.vy <= pl.y+12){
        p.y=pl.y-p.h; p.vy=0; p.onGround=true; p.usedDouble=false;
        if(pl.type==='breakable') pl.broken=true;
        if(pl.type==='slippery') p.vx*=0.96;
      }
    }
    if(pl.broken){ pl.w=0 }
  });

  // shooting
  if(keys.shoot) shoot();

  // bullets update & collision
  game.bullets = game.bullets.filter(b=>{
    b.update();
    let hit=false;
    game.enemies.forEach(e=>{
      if(!e.dead && overlap(b.rect(),e.rect())){
        const hitFromFront = (e.vx>0 && b.vx<0) || (e.vx<0 && b.vx>0);
        if(!e.front || !hitFromFront) e.hp -= b.damage;
        if(e.hp<=0) e.dead=true;
        hit=true;
      }
    });
    return !hit && b.x>-50 && b.x<W+50;
  });

  game.enemies.forEach(e=>e.update());
  game.enemies = game.enemies.filter(e=>!e.dead);

  // enemy-player collision
  game.enemies.forEach(e=>{
    if(overlap(e.rect(),p.rect()) && p.invuln===0){
      p.health-=1; p.invuln=60; updateHUD();
      if(p.health<=0) gameOver();
    }
  });

  // items
  game.items = game.items.filter(it=>{
    if(overlap(new Rect(it.x,it.y,20,20),p.rect())){
      if(it.type==='heart') p.health=Math.min(p.maxHealth,p.health+1);
      if(it.type==='coin') game.coins+=1;
      if(it.type==='rune'){ game.runes+=1; setMessage('Руна собрана!') }
      updateHUD(); return false;
    }
    return true;
  });

  // level complete
  if(!game.levelComplete){
    const hasRune = game.items.some(x=>x.type==='rune');
    if(!hasRune){
      game.levelComplete=true;
      setTimeout(()=>{
        if(game.levelIndex < LEVELS.length-1){
          initLevel(game.levelIndex+1);
        } else startBoss();
      },1000);
    }
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  if(bgImg && bgImg.complete) ctx.drawImage(bgImg,0,0,W,H); else { ctx.fillStyle='#87CEEB'; ctx.fillRect(0,0,W,H) }

  game.platforms.forEach(pl=>pl.draw());
  game.items.forEach(it=>{
    if(it.type==='rune'){ ctx.fillStyle='#ff0'; ctx.fillRect(it.x,it.y,24,24) }
    else if(it.type==='heart'){ ctx.fillStyle='#f66'; ctx.fillRect(it.x,it.y,18,16) }
    else if(it.type==='coin'){ ctx.fillStyle='#ffb'; ctx.fillRect(it.x,it.y,12,12) }
  });
  game.enemies.forEach(e=>e.draw());
  game.bullets.forEach(b=>b.draw());
  game.player.draw();
}

// Boss placeholder
function startBoss(){
  setMessage('Финальный Босс: Моргрим',2000);
  setTimeout(()=>{ setMessage('Моргрим побеждён — Победа!'); },2000);
}

// Start
initLevel(0);
requestAnimationFrame(loop);
