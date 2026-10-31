// ============================================================
// 像素机甲对战 v1.0 — 按 PRD 重写
// 逻辑分辨率 960×540, CRT 像素风, 三局两胜, AI 对手
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 960, H = 540;

// ============ 颜色常量 (PRD 规范) ============
const C = {
    bg:       '#0d0221',
    p1:       '#ff2a6d',   // 霓虹品红 — 赤焰机甲
    p2:       '#05d9e8',   // 霓虹青蓝 — 苍蓝机甲
    energy:   '#f9f871',   // 警示黄
    dark:     '#1a0a3e',
    white:    '#ffffff',
    gray:     '#8888aa',
    hudBg:    '#150734',
    ground:   '#1a0a3e',
    grid:     '#2a1a5e',
    building: '#150734',
    neon1:    '#ff2a6d',
    neon2:    '#05d9e8',
    ko:       '#f9f871',
};

// ============ 游戏配置 ============
const CFG = {
    gravity:       0.35,
    groundY:       420,
    moveSpeed:     4.4,
    jumpForce:    -13,
    maxHealth:     200,
    maxEnergy:     100,
    lightDmg:      8,
    heavyDmg:      16,
    specialDmg:    25,
    defReduction:  0.25,    // 防御保留25%伤害
    lightRange:    80,
    heavyRange:    100,
    specialRange:  130,
    roundTime:     60,      // 秒
    winsNeeded:    2,       // 三局两胜
};

// ============ 游戏状态 ============
let game = {
    screen: 'menu',        // 'menu' | 'fight' | 'roundEnd' | 'result'
    mode: 'pvp',           // 'pvp' | 'pve'
    round: 1,
    timer: CFG.roundTime,
    timerAccum: 0,
    p1Wins: 0,
    p2Wins: 0,
    roundMsg: '',
    roundMsgTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    flashAlpha: 0,
    slowMotion: false,    // 慢动作状态
    slowTimer: 0,         // 慢动作计时器
    slowFactor: 3,        // 慢动作倍率（3倍慢速）
};

// ============ 输入 ============
const keys = {};
const justPressed = {};
document.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys[k]) justPressed[k] = true;
    keys[k] = true;
    e.preventDefault();
});
document.addEventListener('keyup', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
});
function consumePress(k) {
    if (justPressed[k]) { justPressed[k] = false; return true; }
    return false;
}

// 每帧清除未消费的按键（防止累积）
function clearJustPressed() {
    for (const k in justPressed) {
        if (justPressed[k]) justPressed[k] = false;
    }
}

// ============ 像素绘制工具 ============
function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// ============ Sprite 数据 (32×40 机甲) ============
// 每个 sprite 是一个像素矩阵，每行是字符串，字符映射颜色
// 颜色映射: .=透明  B=基础色  D=深色  L=亮色  E=发光(眼/核心)  G=护盾  H=手部
const SPRITE_COLORS = { B: null, D: null, L: null, E: null, G: null, H: null };

function buildSprite(baseColor, darkColor, lightColor, eyeColor, glowColor, handColor, pose) {
    // 根据 pose 生成不同的像素矩阵
    const sprites = {
        idle: [
            '..DDDDDDDD..........',  // 0 天线
            '..DGGDDGDD..........',  // 1 天线顶部
            '..BBBBBBBBBBBB......',  // 2 头顶
            '..BDDDDDDDDDDB......',  // 3 头壳
            '..BDEEBDDEEBDB......',  // 4 眼睛
            '..BDDDDDDDDDDB......',  // 5 下巴
            '..BBBBBBBBBBBB......',  // 6 颈
            '.BBBBLLLLLLBBBB.....',  // 7 肩
            '.BBLLLLLEELLLLLB....',  // 8 胸
            '.BLLLLLLEELLLLLB....',  // 9 胸核心
            '.BLLLLLLLLLLLLLB....',  // 10 腹
            '.BBBBBBBBBBBBBB.....',  // 11 腰
            '..BBBBBBBBBBBB......',  // 12 胯
            '..BBDDDDDDDDDB......',  // 13 大腿
            '..BDDDDDDDDDDDB.....',  // 14
            '..BDDDDDDDDDDDB.....',  // 15
            '..HHDDDDDDDDHH......',  // 16 手
            '..HH..............',  // 17
            '..HH..............',  // 18
            '..BB..............',  // 19
        ],
        walk1: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.BBBBLLLLLLBBBB.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '..BBDDDDDDDDDB......',
            '.BDDDDDDDDDDDDB.....',
            '.BDDDDDDDDDDDB......',
            '.HHDDDDDDDDHH.......',
            '.HH.................',
            '.HH.................',
            '.BB.................',
        ],
        walk2: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.BBBBLLLLLLBBBB.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '.....BBDDDDDDDDDB...',
            '....BDDDDDDDDDDDB...',
            '....BDDDDDDDDDDDB...',
            '......HHDDDDDDDDHH..',
            '..................HH',
            '..................HH',
            '..................BB',
        ],
        lightAtk: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.BBBBLLLLLLBBBB.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '..BBDDDDDDDDDB......',
            '..BDDDDDDDDDDDB.....',
            '..BDDDDDDDDDDDB.....',
            '..HHDDDDDD...HHHHHHH',  // 前手伸出
            '................BEEE',  // 攻击光效
            '................BEEE',
            '..BB..............',
        ],
        heavyAtk: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.BBBBLLLLLLBBBB.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '..BBDDDDDDDDDB......',
            '..BDDDDDDDDDDDB.....',
            '..BDDDDDDDDDDDB.....',
            '..HHDDDDDD..HHHHHHHH',
            '...............BEEEE',
            '...............BEEEE',
            '..BB..........BEEEEE',
        ],
        defend: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.GGGGLLLLLLGGGG.....',  // 护盾肩
            '.GGGLLLLEELLLGGG....',
            '.GGLLLLLEELLLLG.....',
            '.GGLLLLLLLLLLLL.....',
            '.GGGGGGGGGGGGG......',
            '..GGGGGGGGGG........',
            '..GGDDDDDDDDGG......',
            '..GDDDDDDDDDDG......',
            '..GDDDDDDDDDDG......',
            '..HHDDDDDDDDHH......',
            '..HH..............',
            '..HH..............',
            '..BB..............',
        ],
        hit: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BDEEBDDEEBDB......',
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.BBBBLLLLLLBBBB.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '...BBDDDDDDDDDB.....',
            '..BDDDDDDDDDDDB.....',
            '..BDDDDDDDDDDDB.....',
            '..HHDDDDDDDDHH......',
            '..HH..............',
            '..HH..............',
            '..BB..............',
        ],
        special: [
            '..DDDDDDDD..........',
            '..DGGDDGDD..........',
            '..BBBBBBBBBBBB......',
            '..BDDDDDDDDDDB......',
            '..BEEEEEEEEEEB......',  // 全散发光
            '..BDDDDDDDDDDB......',
            '..BBBBBBBBBBBB......',
            '.EEEELEELLEELLL.....',
            '.BBLLLLLEELLLLLB....',
            '.BLLLLLLEELLLLLB....',
            '.BLLLLLLLLLLLLLB....',
            '.BBBBBBBBBBBBBB.....',
            '..BBBBBBBBBBBB......',
            '..BBDDDDDDDDDB......',
            '..BDDDDDDDDDDDB.....',
            '..BDDDDDDDDDDDB.....',
            '..HHDDDDD.HHHHHHHHHH',
            '..............EEEEEE',
            '..............EEEEEE',
            '..BB..........EEEEEE',
        ],
        ko: [
            '....................',
            '....................',
            '....................',
            '....DDDDDDDD........',
            '....BDDDDDDDB.......',
            '....BDDDDDDDB.......',
            '....BBBBBBBB........',
            '..BBLLLLLLBB........',
            '..BLLLLLLLLB........',
            '..BLLLLLLLLB........',
            '..BBBBBBBBB.........',
            '...BBBBBB...........',
            '....BBBB............',
            '....................',
            '....................',
            '....................',
            '....................',
            '....................',
            '....................',
            '....................',
        ],
    };
    return sprites[pose] || sprites.idle;
}

function drawSprite(spriteData, ox, oy, scale, facing, colorMap) {
    ctx.save();
    if (facing === -1) {
        // 水平翻转: 计算 sprite 宽度
        const spriteW = spriteData[0].length;
        ctx.translate(ox + spriteW * scale, oy);
        ctx.scale(-1, 1);
        ox = 0; oy = 0;
    }
    for (let row = 0; row < spriteData.length; row++) {
        const line = spriteData[row];
        for (let col = 0; col < line.length; col++) {
            const ch = line[col];
            if (ch === '.') continue;
            const c = colorMap[ch];
            if (!c) continue;
            ctx.fillStyle = c;
            ctx.fillRect(Math.floor(ox + col * scale), Math.floor(oy + row * scale), scale, scale);
        }
    }
    ctx.restore();
}

// ============ 机甲类 ============
class Mecha {
    constructor(x, color, name, isAI = false) {
        this.x = x;
        this.y = CFG.groundY;
        this.vx = 0; this.vy = 0;
        this.w = 96; this.h = 136;  // 碰撞箱（四倍体积）
        this.color = color;
        this.name = name;
        this.isAI = isAI;
        this.facing = 1;
        this.health = CFG.maxHealth;
        this.energy = 0;
        this.state = 'idle';       // idle|walk|lightAtk|heavyAtk|special|defend|hit|ko
        this.stateTimer = 0;
        this.cooldown = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hitStun = 0;
        this.hasHit = false;       // 本轮攻击是否已命中
        this.koFall = 0;
        // 颜色映射
        this.cmap = this._buildCmap();
    }

    _buildCmap() {
        const base = this.color;
        return {
            '.': null,
            'B': base,
            'D': this._darken(base, 50),
            'L': this._lighten(base, 60),
            'E': C.energy,
            'G': '#4ecdc4',
            'H': this._darken(base, 30),
        };
    }

    _darken(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (n >> 16) - amt);
        const g = Math.max(0, ((n >> 8) & 0xFF) - amt);
        const b = Math.max(0, (n & 0xFF) - amt);
        return `rgb(${r},${g},${b})`;
    }

    _lighten(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.min(255, (n >> 16) + amt);
        const g = Math.min(255, ((n >> 8) & 0xFF) + amt);
        const b = Math.min(255, (n & 0xFF) + amt);
        return `rgb(${r},${g},${b})`;
    }

    getBounds() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    canAct() { return this.state !== 'ko' && this.hitStun <= 0 && this.stateTimer <= 0; }

    lightAttack() {
        if (!this.canAct() || this.cooldown > 0) return;
        this.state = 'lightAtk'; this.stateTimer = 12; this.hasHit = false; this.cooldown = 18;
    }
    heavyAttack() {
        if (!this.canAct() || this.cooldown > 0) return;
        this.state = 'heavyAtk'; this.stateTimer = 20; this.hasHit = false; this.cooldown = 35;
    }
    specialAttack() {
        if (!this.canAct() || this.cooldown > 0 || this.energy < 50) return;
        this.state = 'special'; this.stateTimer = 25; this.hasHit = false; this.cooldown = 50;
        this.energy -= 50;
    }
    defend(active) {
        if (!this.canAct()) return;
        this.state = active ? 'defend' : 'idle';
    }
    jump() {
        if (!this.canAct() || this.y < CFG.groundY - 1) return;
        this.vy = CFG.jumpForce;
    }
    move(dir) {
        if (!this.canAct()) return;
        this.x += dir * CFG.moveSpeed;
        this.x = Math.max(this.w / 2 + 4, Math.min(W - this.w / 2 - 4, this.x));
        if (this.state === 'idle') this.state = 'walk';
    }

    takeDamage(dmg, knockback) {
        if (this.state === 'ko') return;
        const isDef = this.state === 'defend';
        const finalDmg = isDef ? Math.round(dmg * CFG.defReduction) : dmg;
        this.health = Math.max(0, this.health - finalDmg);
        this.hitStun = isDef ? 5 : 12;
        this.state = 'hit'; this.stateTimer = isDef ? 5 : 12;
        this.x -= knockback * (isDef ? 0.3 : 1);
        this.x = Math.max(this.w / 2 + 4, Math.min(W - this.w / 2 - 4, this.x));
        if (!isDef) {
            game.shakeTimer = 6; game.shakeIntensity = 3;
            game.flashAlpha = 0.3;
        }
        spawnHitSpark(this.x, this.y - this.h / 2, isDef);
        spawnDamageNumber(this.x, this.y - this.h - 8, finalDmg);
        if (this.health <= 0) {
            this.state = 'ko'; this.stateTimer = 999;
            this.koFall = 0;
            game.shakeTimer = 15; game.shakeIntensity = 5;
            game.flashAlpha = 0.6;
        }
    }

    addEnergy(amount) {
        this.energy = Math.min(CFG.maxEnergy, this.energy + amount);
    }

    update(opponent) {
        // 面向对手
        if (this.state !== 'ko') {
            this.facing = opponent.x > this.x ? 1 : -1;
        }

        // 重力
        this.vy += CFG.gravity;
        this.y += this.vy;
        if (this.y > CFG.groundY) { this.y = CFG.groundY; this.vy = 0; }

        // 状态计时
        if (this.stateTimer > 0) {
            this.stateTimer--;
            if (this.stateTimer <= 0 && this.state !== 'ko') {
                this.state = 'idle';
            }
        }
        if (this.hitStun > 0) this.hitStun--;
        if (this.cooldown > 0) this.cooldown--;

        // KO 倒地动画
        if (this.state === 'ko' && this.koFall < 30) this.koFall++;

        // 动画帧
        this.animTimer++;
        if (this.animTimer >= 10) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
    }

    draw() {
        let pose = this.state;
        if (this.state === 'walk') {
            pose = this.animFrame % 2 === 0 ? 'walk1' : 'walk2';
        }
        if (this.state === 'idle') {
            // 呼吸动画：轻微上下浮动
        }
        if (this.state === 'ko') {
            pose = 'ko';
        }

        const sprite = buildSprite(this.color, this._darken(this.color, 50), this._lighten(this.color, 60), C.energy, '#4ecdc4', this._darken(this.color, 30), pose);
        const sx = this.x - 40;
        const sy = this.y - this.h - 4;
        const offsetY = this.state === 'idle' ? Math.sin(Date.now() / 300) * 0.5 : 0;

        // KO 倒地旋转效果用偏移模拟
        let finalSy = sy + offsetY;
        if (this.state === 'ko') {
            finalSy += this.koFall * 0.3;
        }

        drawSprite(sprite, sx, finalSy, 4, this.facing, this.cmap);

        // 攻击特效（适配更大机甲）
        if (this.state === 'lightAtk' && this.stateTimer < 8) {
            const ex = this.facing === 1 ? this.x + 72 : this.x - 104;
            px(ex, this.y - 88, 32, 16, C.energy);
        }
        if (this.state === 'heavyAtk' && this.stateTimer < 12) {
            const ex = this.facing === 1 ? this.x + 88 : this.x - 120;
            px(ex, this.y - 104, 40, 24, C.p1);
            px(ex + 8, this.y - 96, 24, 12, C.white);
        }
        if (this.state === 'special' && this.stateTimer < 15) {
            const ex = this.facing === 1 ? this.x + 100 : this.x - 152;
            px(ex, this.y - 120, 56, 40, C.energy);
            px(ex + 12, this.y - 108, 32, 20, C.white);
        }

        // 防御护盾光圈（适配更大机甲）
        if (this.state === 'defend') {
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.1;
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y - this.h / 2, 64, 88, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
}

// ============ 特效系统 ============
let sparks = [];
let dmgNums = [];

function spawnHitSpark(x, y, blocked) {
    const color = blocked ? '#4ecdc4' : C.energy;
    for (let i = 0; i < 6; i++) {
        sparks.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 1,
            life: 10 + Math.random() * 8,
            color,
            size: 1 + Math.floor(Math.random() * 2),
        });
    }
}

function spawnDamageNumber(x, y, value) {
    dmgNums.push({ x, y, value, timer: 40, vy: -1.2 });
}

function updateEffects() {
    sparks = sparks.filter(s => {
        s.x += s.vx; s.y += s.vy; s.vy += 0.1; s.life--;
        return s.life > 0;
    });
    dmgNums = dmgNums.filter(d => {
        d.y += d.vy; d.vy += 0.05; d.timer--;
        return d.timer > 0;
    });
}

function drawEffects() {
    sparks.forEach(s => {
        ctx.globalAlpha = s.life / 18;
        px(s.x, s.y, s.size, s.size, s.color);
    });
    ctx.globalAlpha = 1;

    ctx.font = '16px "Press Start 2P", monospace';
    dmgNums.forEach(d => {
        ctx.globalAlpha = d.timer > 10 ? 1 : d.timer / 10;
        ctx.fillStyle = d.timer > 15 ? C.white : C.energy;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        const txt = `-${d.value}`;
        ctx.strokeText(txt, d.x - 20, d.y);
        ctx.fillText(txt, d.x - 10, d.y);
    });
    ctx.globalAlpha = 1;
}

// ============ 攻击判定 ============
function checkHit(attacker, defender, range, dmg) {
    if (attacker.hasHit) return;
    const dx = Math.abs(attacker.x - defender.x);
    const dy = Math.abs(attacker.y - defender.y);
    if (dx < range + defender.w / 2 && dy < 60) {
        defender.takeDamage(dmg, 3);
        attacker.hasHit = true;
        attacker.addEnergy(dmg * 0.6);
    }
}

function processAttacks() {
    if (p1.state === 'lightAtk' && p1.stateTimer === 6) checkHit(p1, p2, CFG.lightRange, CFG.lightDmg);
    if (p1.state === 'heavyAtk' && p1.stateTimer === 10) checkHit(p1, p2, CFG.heavyRange, CFG.heavyDmg);
    // 必杀技触发慢动作
    if (p1.state === 'special' && p1.stateTimer === 20) {
        game.slowMotion = true;
        game.slowTimer = 45; // 慢动作持续帧数
    }
    if (p1.state === 'special' && p1.stateTimer === 12) checkHit(p1, p2, CFG.specialRange, CFG.specialDmg);

    if (p2.state === 'lightAtk' && p2.stateTimer === 6) checkHit(p2, p1, CFG.lightRange, CFG.lightDmg);
    if (p2.state === 'heavyAtk' && p2.stateTimer === 10) checkHit(p2, p1, CFG.heavyRange, CFG.heavyDmg);
    // 必杀技触发慢动作
    if (p2.state === 'special' && p2.stateTimer === 20) {
        game.slowMotion = true;
        game.slowTimer = 45; // 慢动作持续帧数
    }
    if (p2.state === 'special' && p2.stateTimer === 12) checkHit(p2, p1, CFG.specialRange, CFG.specialDmg);
}

// ============ AI 对手 ============
let ai = {
    decision: 'idle',
    decisionTimer: 0,
    reactionDelay: 0,
    comboCount: 0,       // 连击计数
    aggressiveMode: false, // 激进模式
    predictTimer: 0,
    predictPos: 0,
};

function updateAI() {
    if (p2.state === 'ko' || p2.hitStun > 0) return;

    ai.decisionTimer--;
    if (ai.decisionTimer > 0) return;

    const dist = Math.abs(p1.x - p2.x);
    const p1Attacking = p1.state === 'lightAtk' || p1.state === 'heavyAtk' || p1.state === 'special';
    const healthDiff = p2.health - p1.health;

    // 反应延迟（瞬发，0-2帧）
    ai.reactionDelay = Math.floor(Math.random() * 2);
    ai.decisionTimer = ai.reactionDelay + Math.floor(Math.random() * 2);

    // 激进模式
    ai.aggressiveMode = Math.abs(healthDiff) > 5;

    // 预测玩家走位
    ai.predictTimer--;
    if (ai.predictTimer <= 0) {
        ai.predictPos = p1.x;
        ai.predictTimer = 5 + Math.floor(Math.random() * 5);
    }

    // 决策逻辑（地狱难度AI）
    if (p1Attacking && dist < 180) {
        // 对手攻击 → 20%防御，80%反击（极高反击倾向）
        ai.decision = Math.random() < 0.2 ? 'defend' : (Math.random() < 0.5 ? 'lightAtk' : 'heavyAtk');
    } else if (dist > 200) {
        // 远距离 → 快速接近 + 跳跃压制
        ai.decision = Math.random() < 0.4 ? 'approach' : 'jump';
    } else if (dist < 150) {
        // 近距离 → 极高频率连击
        const r = Math.random();
        if (r < 0.4 && p2.energy >= 50) ai.decision = 'special';
        else if (r < 0.7) ai.decision = 'heavyAtk';
        else if (r < 0.95) ai.decision = 'lightAtk';
        else ai.decision = 'defend'; // 仅5%防御
    } else {
        // 中距离 → 高频进攻 + 跳跃
        const r = Math.random();
        if (r < 0.2) ai.decision = 'approach';
        else if (r < 0.5) ai.decision = 'lightAtk';
        else if (r < 0.8) ai.decision = 'heavyAtk';
        else if (r < 0.95) ai.decision = 'jump';
        else ai.decision = 'idle';
    }

    // 能量管理：高效利用能量
    if (p2.energy >= 45 && p2.energy < 50) {
        ai.decision = Math.random() < 0.3 ? 'defend' : 'approach';
    } else if (p2.energy >= 50) {
        // 能量充足 → 极高概率释放必杀
        if (dist < 150 && Math.random() < 0.9) ai.decision = 'special';
    }

    // 连击逻辑：必追击
    if (ai.comboCount > 0 && dist < 180) {
        ai.decision = Math.random() < 0.95 ? 'lightAtk' : 'heavyAtk';
        ai.comboCount--;
    }

    // 执行决策
    switch (ai.decision) {
        case 'approach':
            p2.move(p1.x > p2.x ? 1 : -1);
            break;
        case 'lightAtk':
            p2.lightAttack();
            if (dist < 180 && Math.random() < 0.9) ai.comboCount = 2;
            break;
        case 'heavyAtk':
            p2.heavyAttack();
            if (dist < 180 && Math.random() < 0.7) ai.comboCount = 1;
            break;
        case 'special':
            p2.specialAttack();
            break;
        case 'defend':
            p2.defend(true);
            setTimeout(() => { if (p2.state === 'defend') p2.defend(false); }, 50 + Math.random() * 50);
            break;
        case 'jump':
            p2.jump();
            setTimeout(() => {
                if (p2.state !== 'ko' && Math.abs(p1.x - p2.x) < 180) {
                    if (Math.random() < 0.9) p2.lightAttack();
                    else p2.heavyAttack();
                }
            }, 150);
            break;
    }
}

// ============ 背景绘制 ============
function drawBackground() {
    // 深紫黑底色
    px(0, 0, W, H, C.bg);

    // 远景星空
    const t = Date.now() / 1000;
    for (let i = 0; i < 30; i++) {
        const sx = (i * 73 + 17) % W;
        const sy = (i * 37 + 7) % (CFG.groundY - 30);
        const twinkle = Math.sin(t * 2 + i) > 0.3 ? 1 : 0;
        if (twinkle) px(sx, sy, 1, 1, '#ffffff');
    }

    // 远景霓虹城市剪影（减少数量）
    const buildings = [
        { x: 60, w: 80, h: 130 }, { x: 200, w: 60, h: 100 },
        { x: 340, w: 100, h: 150 }, { x: 520, w: 70, h: 110 },
        { x: 680, w: 90, h: 140 }, { x: 830, w: 80, h: 120 },
    ];
    buildings.forEach(b => {
        px(b.x, CFG.groundY - b.h + 10, b.w, b.h, C.building);
        // 霓虹窗户
        const neonColor = (b.x * 7) % 3 === 0 ? C.neon1 : (b.x * 7) % 3 === 1 ? C.neon2 : C.energy;
        for (let wy = CFG.groundY - b.h + 15; wy < CFG.groundY - 5; wy += 10) {
            for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 12) {
                if (Math.sin(wx * 13 + wy * 7 + t * 0.5) > 0.5) {
                    px(wx, wy, 4, 4, neonColor);
                }
            }
        }
    });

    // 地面
    px(0, CFG.groundY, W, H - CFG.groundY, C.ground);
    px(0, CFG.groundY, W, 2, '#2a1a5e');

    // 透视网格线
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < W; i += 20) {
        px(i, CFG.groundY + 2, 1, H - CFG.groundY, C.grid);
    }
    for (let gy = CFG.groundY + 8; gy < H; gy += 8) {
        px(0, gy, W, 1, C.grid);
    }
    ctx.globalAlpha = 1;

    // 地面霓虹反射
    ctx.globalAlpha = 0.15;
    const grd = ctx.createLinearGradient(0, CFG.groundY, 0, H);
    grd.addColorStop(0, C.neon1);
    grd.addColorStop(0.5, C.neon2);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, CFG.groundY, W, H - CFG.groundY);
    ctx.globalAlpha = 1;
}

// ============ HUD 绘制 ============
function drawHUD() {
    // HUD 背景条
    px(0, 0, W, 56, C.hudBg);
    px(0, 56, W, 4, '#2a1a5e');

    const barW = 300, barH = 16, barY = 12;

    // P1 血条 (左)
    px(16, barY, barW, barH, '#333');
    const p1hpW = Math.max(0, (p1.health / CFG.maxHealth) * barW);
    px(16, barY, p1hpW, barH, C.p1);
    // 血条分段
    for (let i = 1; i < 10; i++) {
        px(16 + i * (barW / 10), barY, 2, barH, C.hudBg);
    }

    // P2 血条 (右)
    px(W - 16 - barW, barY, barW, barH, '#333');
    const p2hpW = Math.max(0, (p2.health / CFG.maxHealth) * barW);
    px(W - 16 - p2hpW, barY, p2hpW, barH, C.p2);
    for (let i = 1; i < 10; i++) {
        px(W - 16 - barW + i * (barW / 10), barY, 2, barH, C.hudBg);
    }

    // P1 能量条
    const enW = 200, enH = 8, enY = 36;
    px(16, enY, enW, enH, '#222');
    const p1enW = (p1.energy / CFG.maxEnergy) * enW;
    px(16, enY, p1enW, enH, C.energy);

    // P2 能量条
    px(W - 16 - enW, enY, enW, enH, '#222');
    const p2enW = (p2.energy / CFG.maxEnergy) * enW;
    px(W - 16 - p2enW, enY, p2enW, enH, C.energy);

    // 名字
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = C.p1;
    ctx.fillText('P1', 20, 28);
    ctx.fillStyle = C.p2;
    ctx.fillText(game.mode === 'pve' ? 'AI' : 'P2', W - 44, 28);

    // 回合比分 (中央)
    ctx.fillStyle = C.white;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${game.p1Wins} - ${game.p2Wins}`, W / 2, 20);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = C.gray;
    ctx.fillText(`R${game.round}`, W / 2, 40);
    ctx.textAlign = 'left';

    // 倒计时
    const timeLeft = Math.ceil(game.timer);
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = timeLeft <= 10 ? C.p1 : C.white;
    ctx.fillText(`${timeLeft}`, W / 2, H - 20);

    // 静音指示
    if (AudioSys.isMuted()) {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.gray;
        ctx.fillText('MUTED', W / 2, H - 6);
    }
    ctx.textAlign = 'left';

    // 能量满指示
    if (p1.energy >= 50) {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.energy;
        ctx.fillText('★', 220, 44);
    }
    if (p2.energy >= 50) {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.energy;
        ctx.fillText('★', W - 230, 44);
    }
}

// ============ 菜单界面 ============
let menuSelection = 0; // 0=vsPlayer, 1=vsAI
const menuItems = ['双人对战', '对战 AI'];

function drawMenu() {
    drawBackground();

    // 标题
    const t = Date.now() / 1000;
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    // 辉光效果
    ctx.shadowColor = C.p1;
    ctx.shadowBlur = 16 + Math.sin(t * 3) * 6;
    ctx.fillStyle = C.p1;
    ctx.fillText('PIXEL', W / 2 - 60, 130);
    ctx.shadowColor = C.p2;
    ctx.fillStyle = C.p2;
    ctx.fillText('MECHA', W / 2 + 76, 130);
    ctx.shadowBlur = 0;

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = C.energy;
    ctx.fillText('机甲对战', W / 2, 170);

    // 扫描线动效
    const scanY = (t * 80) % H;
    ctx.globalAlpha = 0.05;
    px(0, scanY, W, 6, C.white);
    ctx.globalAlpha = 1;

    // 模式选择按钮
    const btnY = 230;
    menuItems.forEach((item, i) => {
        const y = btnY + i * 60;
        const selected = i === menuSelection;

        // 按钮背景
        px(W / 2 - 110, y, 220, 44, selected ? C.p1 : C.hudBg);
        px(W / 2 - 106, y + 4, 212, 36, selected ? C.dark : '#1a0a3e');

        // 按钮文字
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = selected ? C.white : C.gray;
        ctx.fillText(item, W / 2, y + 28);

        // 选中指示器
        if (selected) {
            ctx.fillStyle = C.energy;
            ctx.fillText('▶', W / 2 - 96, y + 28);
        }
    });

    // 操作说明
    const ctrlY = 350;
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillStyle = C.p1;
    ctx.textAlign = 'center';
    ctx.fillText('P1 操作', 240, ctrlY);
    ctx.fillStyle = C.gray;
    ctx.font = '15px "Press Start 2P", monospace';
    ctx.fillText('A/D 移动  W 跳跃', 240, ctrlY + 30);
    ctx.fillText('S 防御 (减伤75%)', 240, ctrlY + 54);
    ctx.fillStyle = C.energy;
    ctx.fillText('F 轻攻 (8伤)', 240, ctrlY + 78);
    ctx.fillText('G 重攻 (16伤)', 240, ctrlY + 102);
    ctx.fillText('H 必杀 (25伤, 消耗50能量)', 240, ctrlY + 126);

    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillStyle = C.p2;
    ctx.fillText('P2 操作', 720, ctrlY);
    ctx.fillStyle = C.gray;
    ctx.font = '15px "Press Start 2P", monospace';
    ctx.fillText('←/→ 移动  ↑ 跳跃', 720, ctrlY + 30);
    ctx.fillText('↓ 防御 (减伤75%)', 720, ctrlY + 54);
    ctx.fillStyle = C.energy;
    ctx.fillText('J 轻攻 (8伤)', 720, ctrlY + 78);
    ctx.fillText('K 重攻 (16伤)', 720, ctrlY + 102);
    ctx.fillText('L 必杀 (25伤, 消耗50能量)', 720, ctrlY + 126);
    ctx.textAlign = 'left';

    // 开始提示
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillStyle = C.energy;
    const blink = Math.sin(t * 4) > 0;
    if (blink) ctx.fillText('按 ENTER 开始', W / 2, H - 50);

    // 静音提示
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = C.gray;
    ctx.fillText('M 静音: ' + (AudioSys.isMuted() ? 'ON' : 'OFF'), W / 2, H - 25);

    ctx.textAlign = 'left';
}

let audioStarted = false;

function updateMenu() {
    if (consumePress('ArrowUp') || consumePress('w')) menuSelection = 0;
    if (consumePress('ArrowDown') || consumePress('s')) menuSelection = 1;

    // 首次按键启动音频 + 菜单BGM
    if (!audioStarted && (justPressed['ArrowUp'] || justPressed['ArrowDown'] || justPressed['w'] || justPressed['s'] || justPressed['Enter'])) {
        AudioSys.init();
        AudioSys.resume();
        AudioSys.startBGM('menu');
        audioStarted = true;
    }

    // M 键静音切换
    if (consumePress('m')) {
        AudioSys.toggleMute();
    }

    if (consumePress('Enter')) {
        game.mode = menuSelection === 0 ? 'pvp' : 'pve';
        startRound();
    }
}

// ============ 回合过场 ============
function drawRoundTransition() {
    drawBackground();
    p1.draw();
    p2.draw();

    // 半透明覆盖
    ctx.globalAlpha = 0.6;
    px(0, 0, W, H, '#000');
    ctx.globalAlpha = 1;

    // 回合消息
    game.roundMsgTimer--;
    ctx.textAlign = 'center';
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillStyle = C.energy;
    const alpha = game.roundMsgTimer > 60 ? 1 : game.roundMsgTimer / 60;
    ctx.globalAlpha = alpha;
    ctx.fillText(game.roundMsg, W / 2, H / 2 - 20);

    if (game.roundMsg.includes('K.O')) {
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.p1;
        ctx.fillText(`P1 ${game.p1Wins} - ${game.p2Wins} ${game.mode === 'pve' ? 'AI' : 'P2'}`, W / 2, H / 2 + 30);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    if (game.roundMsgTimer <= 0) {
        if (game.p1Wins >= CFG.winsNeeded || game.p2Wins >= CFG.winsNeeded) {
            game.screen = 'result';
        } else {
            game.round++;
            startRound();
        }
    }
}

// ============ 结算界面 ============
function drawResult() {
    drawBackground();

    const winner = game.p1Wins >= CFG.winsNeeded ? 1 : 2;
    const winMecha = winner === 1 ? p1 : p2;
    const winColor = winner === 1 ? C.p1 : C.p2;

    // 胜方机甲特写（放大绘制）
    const sprite = buildSprite(winMecha.color, winMecha._darken(winMecha.color, 50), winMecha._lighten(winMecha.color, 60), C.energy, '#4ecdc4', winMecha._darken(winMecha.color, 30), 'idle');
    ctx.save();
    ctx.translate(W / 2, 160);
    ctx.scale(4, 4);
    drawSprite(sprite, -10, -17, 2, winMecha.facing, winMecha.cmap);
    ctx.restore();

    // VICTORY / DEFEAT
    const t = Date.now() / 1000;
    ctx.textAlign = 'center';
    ctx.shadowColor = winColor;
    ctx.shadowBlur = 12 + Math.sin(t * 3) * 4;
    ctx.font = '28px "Press Start 2P", monospace';
    ctx.fillStyle = winColor;
    ctx.fillText('VICTORY', W / 2, 340);
    ctx.shadowBlur = 0;

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = C.white;
    ctx.fillText(winner === 1 ? '赤焰机甲 胜!' : (game.mode === 'pve' ? '苍蓝机甲(AI) 胜!' : '苍蓝机甲 胜!'), W / 2, 380);

    // 战绩
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = C.gray;
    ctx.fillText(`比分 ${game.p1Wins} - ${game.p2Wins}`, W / 2, 410);

    // 按钮
    const btns = ['重新开始', '返回菜单'];
    btns.forEach((btn, i) => {
        const y = 450 + i * 40;
        px(W / 2 - 80, y, 160, 32, C.hudBg);
        px(W / 2 - 76, y + 4, 152, 24, '#1a0a3e');
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.white;
        ctx.fillText(btn, W / 2, y + 22);
    });

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = C.energy;
    const blink = Math.sin(t * 4) > 0;
    if (blink) ctx.fillText('ENTER 重新开始  ESC 返回菜单', W / 2, H - 20);
    ctx.textAlign = 'left';
}

function updateResult() {
    if (consumePress('m')) AudioSys.toggleMute();
    if (consumePress('Enter')) {
        game.p1Wins = 0; game.p2Wins = 0; game.round = 1;
        startRound();
    }
    if (consumePress('Escape')) {
        game.screen = 'menu';
        AudioSys.startBGM('menu');
    }
}

// ============ 回合管理 ============
let p1, p2;

function startRound() {
    p1 = new Mecha(200, C.p1, '赤焰机甲');
    p2 = new Mecha(760, C.p2, '苍蓝机甲', game.mode === 'pve');
    game.timer = CFG.roundTime;
    game.timerAccum = 0;
    sparks = [];
    dmgNums = [];
    game.screen = 'fight';
    game.roundMsg = `ROUND ${game.round}`;
    game.roundMsgTimer = 60;
    game.slowMotion = false;
    game.slowTimer = 0;

    // 启动战斗 BGM
    AudioSys.startBGM('fight');

    // 显示 FIGHT
    setTimeout(() => {
        if (game.screen === 'fight') {
            game.roundMsg = 'FIGHT!';
            game.roundMsgTimer = 40;
        }
    }, 1200);
}

function endRound(winner) {
    if (game.screen !== 'fight') return;
    game.screen = 'roundEnd';

    if (winner === 1) {
        game.p1Wins++;
        game.roundMsg = 'K.O! P1 胜!';
    } else if (winner === 2) {
        game.p2Wins++;
        game.roundMsg = game.mode === 'pve' ? 'K.O! AI 胜!' : 'K.O! P2 胜!';
    } else {
        // 平局：血量多者胜
        if (p1.health > p2.health) {
            game.p1Wins++;
            game.roundMsg = '时间到! P1 胜!';
        } else if (p2.health > p1.health) {
            game.p2Wins++;
            game.roundMsg = '时间到! ' + (game.mode === 'pve' ? 'AI' : 'P2') + ' 胜!';
        } else {
            game.roundMsg = '平局!';
        }
    }
    game.roundMsgTimer = 90;
}

// ============ P1 输入处理 ============
function handleP1Input() {
    if (p1.state === 'ko' || p1.hitStun > 0) return;

    // 防御
    if (keys['s']) { p1.defend(true); }
    else if (p1.state === 'defend') { p1.defend(false); }

    // 移动
    if (keys['a']) { p1.move(-1); p1.facing = -1; }
    if (keys['d']) { p1.move(1); p1.facing = 1; }

    // 跳跃
    if (consumePress('w')) p1.jump();

    // 攻击
    if (consumePress('f')) p1.lightAttack();
    if (consumePress('g')) p1.heavyAttack();
    if (consumePress('h')) p1.specialAttack();
}

// ============ P2 输入处理 ============
function handleP2Input() {
    if (game.mode === 'pve') {
        updateAI();
        return;
    }
    if (p2.state === 'ko' || p2.hitStun > 0) return;

    if (keys['ArrowDown']) { p2.defend(true); }
    else if (p2.state === 'defend') { p2.defend(false); }

    if (keys['ArrowLeft']) { p2.move(-1); p2.facing = -1; }
    if (keys['ArrowRight']) { p2.move(1); p2.facing = 1; }

    if (consumePress('ArrowUp')) p2.jump();
    if (consumePress('j')) p2.lightAttack();
    if (consumePress('k')) p2.heavyAttack();
    if (consumePress('l')) p2.specialAttack();
}

// ============ 战斗界面更新 ============
function updateFight() {
    if (consumePress('m')) AudioSys.toggleMute();
    handleP1Input();
    handleP2Input();

    p1.update(p2);
    p2.update(p1);

    processAttacks();
    updateEffects();

    // 碰撞推开
    const b1 = p1.getBounds(), b2 = p2.getBounds();
    if (b1.x < b2.x + b2.w && b1.x + b1.w > b2.x && b1.y < b2.y + b2.h && b1.y + b1.h > b2.y) {
        const overlap = (b1.x + b1.w) - b2.x;
        if (p1.x < p2.x) { p1.x -= overlap / 2; p2.x += overlap / 2; }
        else { p1.x += overlap / 2; p2.x -= overlap / 2; }
    }

    // 倒计时
    game.timerAccum++;
    if (game.timerAccum >= 60) {
        game.timerAccum = 0;
        game.timer--;
    }

    // 胜负判定
    if (p1.health <= 0) endRound(2);
    else if (p2.health <= 0) endRound(1);
    else if (game.timer <= 0) endRound(0);
}

// ============ 8-bit 芯片音乐系统 ============
const AudioSys = (() => {
    let ac = null, master = null, bgmTimer = null, muted = false, currentBGM = '';

    function init() {
        if (ac) return;
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.25;
        master.connect(ac.destination);
    }

    function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

    function freq(note) {
        const nm = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
        const sharp = note[1] === '#' ? 1 : 0;
        const name = note[0], oct = parseInt(note[sharp ? 2 : 1]);
        const midi = 12 * (oct + 1) + nm[name] + sharp;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function tone(f, time, dur, type, vol) {
        if (!ac || muted) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, time);
        g.gain.setValueAtTime(vol * 0.7, time + dur * 0.7);
        g.gain.linearRampToValueAtTime(0.001, time + dur * 0.95);
        o.connect(g); g.connect(master);
        o.start(time); o.stop(time + dur);
    }

    function noise(time, dur, vol, hpFreq) {
        if (!ac || muted) return;
        const len = Math.floor(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const g = ac.createGain();
        g.gain.setValueAtTime(vol, time);
        g.gain.linearRampToValueAtTime(0.001, time + dur * 0.9);
        const hp = ac.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = hpFreq || 4000;
        src.connect(hp); hp.connect(g); g.connect(master);
        src.start(time); src.stop(time + dur);
    }

    function kick(time) {
        if (!ac || muted) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, time);
        o.frequency.exponentialRampToValueAtTime(30, time + 0.12);
        g.gain.setValueAtTime(0.3, time);
        g.gain.linearRampToValueAtTime(0.001, time + 0.15);
        o.connect(g); g.connect(master);
        o.start(time); o.stop(time + 0.15);
    }

    // ---- 战斗 BGM: 原创芯片音乐，E小调，激昂风格 ----
    const fightBPM = 155;
    const fightStep = 60 / fightBPM / 4;

    const fightLead = [
        'E4','E4','G4','A4', 'B4','B4','A4','G4',
        'E4','E4','G4','A4', 'B4','D5','B4','A4',
        'C5','C5','B4','A4', 'G4','G4','A4','B4',
        'C5','C5','B4','A4', 'G4','E4','G4','A4',
        'E4','G4','B4','B4', 'A4','G4','A4','B4',
        'E4','G4','B4','D5', 'E5','D5','B4','A4',
        'C5','B4','A4','G4', 'A4','B4','C5','D5',
        'E5','D5','C5','B4', 'A4','G4','E4','-',
    ];
    const fightBass = [
        'E2','E2','-','E2', 'E2','E2','-','E2',
        'E2','E2','-','E2', 'B2','B2','-','B2',
        'C3','C3','-','C3', 'G2','G2','-','G2',
        'C3','C3','-','C3', 'E2','E2','-','E2',
        'E2','E2','-','E2', 'E2','E2','-','E2',
        'E2','E2','-','E2', 'B2','B2','-','B2',
        'C3','C3','-','C3', 'G2','G2','-','G2',
        'A2','A2','-','A2', 'B2','B2','-','E2',
    ];
    const fightDrums = [
        1,3,0,3, 2,3,0,3, 1,3,0,3, 2,3,1,3,
        1,3,0,3, 2,3,0,3, 1,3,0,3, 2,3,1,3,
        1,3,0,3, 2,3,0,3, 1,3,0,3, 2,3,1,3,
        1,3,0,3, 2,3,0,3, 1,3,1,3, 2,3,2,3,
    ];

    // ---- 菜单 BGM: 较舒缓、神秘氛围 ----
    const menuBPM = 110;
    const menuStep = 60 / menuBPM / 4;

    const menuLead = [
        'E4','-','G4','-', 'A4','-','G4','-',
        'E4','-','D4','-', 'E4','-','-','-',
        'C4','-','E4','-', 'G4','-','A4','-',
        'G4','-','E4','-', 'D4','-','-','-',
        'E4','-','G4','-', 'B4','-','A4','-',
        'G4','-','E4','-', 'D4','-','E4','-',
        'A4','-','G4','-', 'E4','-','D4','-',
        'E4','-','-','-', '-','-','-','-',
    ];
    const menuBass = [
        'E2','-','E2','-', 'E2','-','E2','-',
        'C2','-','C2','-', 'D2','-','D2','-',
        'C2','-','C2','-', 'G2','-','G2','-',
        'A2','-','A2','-', 'D2','-','E2','-',
        'E2','-','E2','-', 'E2','-','E2','-',
        'G2','-','G2','-', 'A2','-','A2','-',
        'E2','-','E2','-', 'D2','-','D2','-',
        'E2','-','-','-', '-','-','-','-',
    ];
    const menuDrums = [
        0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
        0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
        0,0,3,0, 0,0,3,0, 0,0,3,0, 0,0,3,0,
        0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    ];

    function scheduleLoop(lead, bass, drums, step) {
        const now = ac.currentTime + 0.05;
        const len = lead.length;
        for (let i = 0; i < len; i++) {
            const t = now + i * step;
            if (lead[i] && lead[i] !== '-') tone(freq(lead[i]), t, step * 0.85, 'square', 0.12);
            if (bass[i] && bass[i] !== '-') tone(freq(bass[i]), t, step * 0.85, 'triangle', 0.18);
            const d = drums[i];
            if (d === 1) kick(t);
            else if (d === 2) noise(t, 0.08, 0.08, 3000);
            else if (d === 3) noise(t, 0.03, 0.04, 6000);
        }
        const loopMs = len * step * 1000;
        bgmTimer = setTimeout(() => {
            if (currentBGM) scheduleLoop(lead, bass, drums, step);
        }, loopMs - 50);
    }

    function startBGM(type) {
        stopBGM();
        init(); resume();
        currentBGM = type;
        if (type === 'fight') scheduleLoop(fightLead, fightBass, fightDrums, fightStep);
        else if (type === 'menu') scheduleLoop(menuLead, menuBass, menuDrums, menuStep);
    }

    function stopBGM() {
        currentBGM = '';
        if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
    }

    function toggleMute() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.25;
    }

    function isMuted() { return muted; }

    return { init, startBGM, stopBGM, toggleMute, isMuted, resume };
})();

// ============ 主循环 ============
function gameLoop() {
    ctx.clearRect(0, 0, W, H);

    // 慢动作处理
    let shouldUpdate = true;
    if (game.slowMotion) {
        game.slowTimer--;
        // 每3帧只更新1次（3倍慢速）
        if (game.slowTimer % game.slowFactor !== 0) {
            shouldUpdate = false;
        }
        if (game.slowTimer <= 0) {
            game.slowMotion = false;
        }
    }

    // 屏幕震动
    ctx.save();
    if (game.shakeTimer > 0) {
        const sx = (Math.random() - 0.5) * game.shakeIntensity;
        const sy = (Math.random() - 0.5) * game.shakeIntensity;
        ctx.translate(sx, sy);
        game.shakeTimer--;
    }

    switch (game.screen) {
        case 'menu':
            drawMenu();
            updateMenu();
            break;
        case 'fight':
            if (shouldUpdate) {
                updateFight();
            }
            drawBackground();
            p1.draw();
            p2.draw();
            drawEffects();
            drawHUD();

            // 必杀技特效：屏幕泛光
            if (game.slowMotion) {
                ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 100) * 0.05;
                px(0, 0, W, H, C.energy);
                ctx.globalAlpha = 1;
            }

            // 回合消息
            if (game.roundMsgTimer > 0 && shouldUpdate) {
                game.roundMsgTimer--;
                ctx.textAlign = 'center';
                ctx.font = '28px "Press Start 2P", monospace';
                ctx.fillStyle = C.energy;
                ctx.shadowColor = C.energy;
                ctx.shadowBlur = 12;
                ctx.fillText(game.roundMsg, W / 2, H / 2);
                ctx.shadowBlur = 0;
                ctx.textAlign = 'left';
            }
            break;
        case 'roundEnd':
            drawRoundTransition();
            break;
        case 'result':
            drawResult();
            updateResult();
            break;
    }

    // 闪屏效果
    if (game.flashAlpha > 0) {
        ctx.globalAlpha = game.flashAlpha;
        px(0, 0, W, H, C.white);
        ctx.globalAlpha = 1;
        game.flashAlpha -= 0.05;
    }

    ctx.restore();

    // 每帧清除未消费的按键
    clearJustPressed();

    requestAnimationFrame(gameLoop);
}

// ============ 启动 ============
gameLoop();
