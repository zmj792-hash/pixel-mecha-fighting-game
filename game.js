// ============================================
// 像素风机甲对战游戏 - 核心代码
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏常量
const GRAVITY = 0.6;
const GROUND_Y = 320;
const MOVE_SPEED = 5;
const JUMP_FORCE = -12;
const ATTACK_DAMAGE = 15;
const DEFENSE_REDUCTION = 0.3; // 防御时减少70%伤害
const ATTACK_RANGE = 80;
const MAX_HEALTH = 100;

// 游戏状态
let gameState = 'playing'; // 'playing' | 'finished'
let animationId;

// ============================================
// 像素风机甲精灵数据（用代码绘制，无需外部图片）
// ============================================

// 绘制像素网格的辅助函数
function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// ============================================
// 机甲类定义
// ============================================
class Mecha {
    constructor(x, facing, color, name) {
        this.x = x;
        this.y = GROUND_Y;
        this.vx = 0;
        this.vy = 0;
        this.width = 60;
        this.height = 80;
        this.facing = facing; // 1 = right, -1 = left
        this.color = color;
        this.name = name;
        this.health = MAX_HEALTH;
        this.isAttacking = false;
        this.isDefending = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hitFlash = 0;
    }

    // 获取机甲边界框
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height,
            width: this.width,
            height: this.height
        };
    }

    // 移动
    move(dir) {
        if (this.isAttacking) return;
        this.vx = dir * MOVE_SPEED;
        this.x += this.vx;
        
        // 边界限制
        if (this.x < this.width / 2) this.x = this.width / 2;
        if (this.x > canvas.width - this.width / 2) this.x = canvas.width - this.width / 2;
    }

    // 跳跃
    jump() {
        if (this.y >= GROUND_Y && !this.isAttacking) {
            this.vy = JUMP_FORCE;
        }
    }

    // 攻击
    attack() {
        if (this.attackCooldown > 0 || this.isAttacking) return;
        this.isAttacking = true;
        this.attackTimer = 15;
        this.attackCooldown = 30;
    }

    // 防御
    defend(active) {
        if (this.isAttacking) return;
        this.isDefending = active;
    }

    // 受到伤害
    takeDamage(dmg) {
        if (this.isDefending) {
            dmg *= DEFENSE_REDUCTION;
        }
        this.health = Math.max(0, this.health - dmg);
        this.hitFlash = 10;
        updateHealthUI();
    }

    // 更新状态
    update() {
        // 重力
        this.vy += GRAVITY;
        this.y += this.vy;

        // 地面碰撞
        if (this.y > GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = 0;
        }

        // 攻击计时
        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // 攻击冷却
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }

        // 受击闪烁
        if (this.hitFlash > 0) {
            this.hitFlash--;
        }

        // 动画帧
        this.animTimer++;
        if (this.animTimer >= 8) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    // 绘制像素风机甲
    draw() {
        const x = this.x - this.width / 2;
        const y = this.y - this.height;
        const f = this.facing;
        
        // 受击闪烁效果
        const flash = this.hitFlash > 0 && this.hitFlash % 2 === 0;
        const baseColor = flash ? '#ffffff' : this.color;
        const darkColor = flash ? '#cccccc' : this.darkenColor(this.color, 40);
        const lightColor = flash ? '#ffffff' : this.lightenColor(this.color, 30);

        ctx.save();
        
        // 如果朝左，翻转绘制
        if (f === -1) {
            ctx.translate(this.x * 2, 0);
            ctx.scale(-1, 1);
        }

        // === 绘制像素风机甲 ===
        const px = x + 10; // 基础偏移
        
        // 腿部（动画）
        const legOffset = this.y < GROUND_Y ? 5 : Math.sin(this.animFrame * Math.PI / 2) * 3;
        // 左腿
        drawPixelRect(px + 8, y + 55, 12, 20 + legOffset, darkColor);
        drawPixelRect(px + 10, y + 70 + legOffset, 14, 8, '#555');
        // 右腿
        drawPixelRect(px + 28, y + 55, 12, 20 - legOffset, darkColor);
        drawPixelRect(px + 30, y + 70 - legOffset, 14, 8, '#555');

        // 身体
        drawPixelRect(px + 5, y + 25, 38, 35, baseColor);
        drawPixelRect(px + 10, y + 30, 28, 25, lightColor);
        // 核心能量块
        const energyColor = this.isDefending ? '#4ecdc4' : '#ffd93d';
        drawPixelRect(px + 18, y + 38, 12, 10, energyColor);
        if (this.isDefending) {
            drawPixelRect(px + 20, y + 40, 8, 6, '#ffffff');
        }

        // 头部
        drawPixelRect(px + 10, y + 5, 28, 22, baseColor);
        drawPixelRect(px + 14, y + 8, 20, 15, darkColor);
        // 眼睛（发光）
        drawPixelRect(px + 18, y + 12, 6, 6, '#00ffff');
        drawPixelRect(px + 26, y + 12, 6, 6, '#00ffff');
        // 天线
        drawPixelRect(px + 22, y, 4, 8, '#888');
        drawPixelRect(px + 20, y - 3, 8, 4, '#ff6b6b');

        // 手臂
        const armY = y + 30;
        // 后臂
        drawPixelRect(px, armY, 10, 25, darkColor);
        drawPixelRect(px - 2, armY + 22, 12, 8, '#666');
        
        // 前臂（攻击时前伸）
        if (this.isAttacking) {
            drawPixelRect(px + 40, armY - 5, 35, 12, lightColor);
            drawPixelRect(px + 70, armY - 8, 15, 18, '#ffd93d');
            // 攻击特效
            drawPixelRect(px + 80, armY - 15, 10, 30, '#ff6b6b');
            drawPixelRect(px + 85, armY - 10, 8, 20, '#ffffff');
        } else {
            drawPixelRect(px + 38, armY, 10, 25, lightColor);
            drawPixelRect(px + 36, armY + 22, 12, 8, '#666');
        }

        // 防御护盾效果
        if (this.isDefending) {
            ctx.globalAlpha = 0.4;
            drawPixelRect(px - 5, y - 5, 58, 90, '#4ecdc4');
            ctx.globalAlpha = 0.6;
            drawPixelRect(px, y, 48, 80, '#4ecdc4');
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    // 颜色变暗
    darkenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - amount);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
        const b = Math.max(0, (num & 0x0000FF) - amount);
        return `rgb(${r},${g},${b})`;
    }

    // 颜色变亮
    lightenColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
        const b = Math.min(255, (num & 0x0000FF) + amount);
        return `rgb(${r},${g},${b})`;
    }
}

// ============================================
// 创建机甲角色
// ============================================
let player1 = new Mecha(150, 1, '#4ecdc4', '蓝甲战士');
let player2 = new Mecha(650, -1, '#ff6b6b', '红甲战士');

// ============================================
// 输入处理
// ============================================
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true; // 保留原始键（如箭头）
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.key] = false;
});

function handleInput() {
    if (gameState !== 'playing') return;

    // P1 操作
    if (keys['a']) {
        player1.move(-1);
        player1.facing = -1;
    }
    if (keys['d']) {
        player1.move(1);
        player1.facing = 1;
    }
    if (keys['w']) {
        player1.jump();
    }
    if (keys['s']) {
        player1.defend(true);
    } else {
        player1.defend(false);
    }
    if (keys['f']) {
        player1.attack();
    }

    // P2 操作
    if (keys['ArrowLeft']) {
        player2.move(-1);
        player2.facing = -1;
    }
    if (keys['ArrowRight']) {
        player2.move(1);
        player2.facing = 1;
    }
    if (keys['ArrowUp']) {
        player2.jump();
    }
    if (keys['ArrowDown']) {
        player2.defend(true);
    } else {
        player2.defend(false);
    }
    if (keys['j'] || keys['J']) {
        player2.attack();
    }

    // 面向对手
    if (!keys['a'] && !keys['d']) {
        player1.facing = player1.x < player2.x ? 1 : -1;
    }
    if (!keys['ArrowLeft'] && !keys['ArrowRight']) {
        player2.facing = player2.x < player1.x ? 1 : -1;
    }
}

// ============================================
// 碰撞检测（攻击判定）
// ============================================
let p1HasHit = false;
let p2HasHit = false;

function checkAttacks() {
    // P1 攻击 P2 — 每次攻击只判定一次
    if (player1.isAttacking && !p1HasHit) {
        if (Math.abs(player1.x - player2.x) < ATTACK_RANGE + player2.width / 2) {
            player2.takeDamage(ATTACK_DAMAGE);
            showDamageNumber(player2.x, player2.y - player2.height - 10, ATTACK_DAMAGE);
            p1HasHit = true;
        }
    }
    if (!player1.isAttacking) {
        p1HasHit = false;
    }

    // P2 攻击 P1 — 每次攻击只判定一次
    if (player2.isAttacking && !p2HasHit) {
        if (Math.abs(player2.x - player1.x) < ATTACK_RANGE + player1.width / 2) {
            player1.takeDamage(ATTACK_DAMAGE);
            showDamageNumber(player1.x, player1.y - player1.height - 10, ATTACK_DAMAGE);
            p2HasHit = true;
        }
    }
    if (!player2.isAttacking) {
        p2HasHit = false;
    }
}

// ============================================
// 伤害数字特效
// ============================================
let damageNumbers = [];

function showDamageNumber(x, y, dmg) {
    damageNumbers.push({
        x: x,
        y: y,
        value: Math.round(dmg),
        timer: 30,
        vy: -2
    });
}

function updateDamageNumbers() {
    damageNumbers = damageNumbers.filter(d => {
        d.y += d.vy;
        d.vy += 0.1;
        d.timer--;
        return d.timer > 0;
    });
}

function drawDamageNumbers() {
    damageNumbers.forEach(d => {
        ctx.font = 'bold 24px Courier New';
        ctx.fillStyle = d.timer > 10 ? '#ff6b6b' : '#ffd93d';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(`-${d.value}`, d.x - 15, d.y);
        ctx.fillText(`-${d.value}`, d.x - 15, d.y);
    });
}

// ============================================
// 背景绘制（像素风场景）
// ============================================
function drawBackground() {
    // 天空渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.6, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 星星
    const stars = [
        [50, 30], [150, 50], [280, 20], [400, 60], [520, 40],
        [650, 25], [720, 55], [100, 80], [350, 70], [600, 85]
    ];
    stars.forEach(([sx, sy]) => {
        const twinkle = Math.sin(Date.now() / 500 + sx) > 0.5 ? 3 : 2;
        drawPixelRect(sx, sy, twinkle, twinkle, '#ffffff');
    });

    // 远景建筑（像素风）
    drawPixelRect(50, 200, 60, 120, '#2a2a4a');
    drawPixelRect(60, 180, 40, 20, '#2a2a4a');
    drawPixelRect(70, 220, 10, 10, '#ffd93d');
    drawPixelRect(90, 250, 10, 10, '#ffd93d');

    drawPixelRect(180, 230, 80, 90, '#2a2a4a');
    drawPixelRect(200, 250, 12, 12, '#ff6b6b');
    drawPixelRect(230, 280, 12, 12, '#4ecdc4');

    drawPixelRect(550, 190, 70, 130, '#2a2a4a');
    drawPixelRect(570, 210, 15, 15, '#ffd93d');
    drawPixelRect(600, 240, 15, 15, '#ff6b6b');

    drawPixelRect(680, 220, 90, 100, '#2a2a4a');
    drawPixelRect(700, 240, 12, 12, '#4ecdc4');
    drawPixelRect(730, 270, 12, 12, '#ffd93d');

    // 地面
    drawPixelRect(0, GROUND_Y + 2, canvas.width, 80, '#3a3a5a');
    
    // 地面纹理
    for (let i = 0; i < canvas.width; i += 20) {
        drawPixelRect(i, GROUND_Y + 2, 18, 3, '#4a4a6a');
        drawPixelRect(i + 10, GROUND_Y + 10, 15, 3, '#2a2a4a');
    }

    // 地面装饰线
    drawPixelRect(0, GROUND_Y, canvas.width, 4, '#5a5a7a');
}

// ============================================
// 更新UI血量显示
// ============================================
function updateHealthUI() {
    const p1Percent = (player1.health / MAX_HEALTH) * 100;
    const p2Percent = (player2.health / MAX_HEALTH) * 100;
    
    document.getElementById('p1Health').style.width = p1Percent + '%';
    document.getElementById('p2Health').style.width = p2Percent + '%';
    document.getElementById('p1HealthText').textContent = `${Math.round(player1.health)} / ${MAX_HEALTH}`;
    document.getElementById('p2HealthText').textContent = `${Math.round(player2.health)} / ${MAX_HEALTH}`;
}

// ============================================
// 胜负判定
// ============================================
function checkWinCondition() {
    if (gameState !== 'playing') return;

    if (player1.health <= 0 || player2.health <= 0) {
        gameState = 'finished';
        const message = document.getElementById('message');
        const restartBtn = document.getElementById('restartBtn');
        
        if (player1.health <= 0 && player2.health <= 0) {
            message.textContent = '⚔️ 平局! ⚔️';
        } else if (player1.health <= 0) {
            message.textContent = '🏆 红甲战士胜利! 🏆';
        } else {
            message.textContent = '🏆 蓝甲战士胜利! 🏆';
        }
        
        message.style.display = 'block';
        restartBtn.style.display = 'inline-block';
    }
}

// ============================================
// 游戏主循环
// ============================================
function gameLoop() {
    // 清屏
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景
    drawBackground();

    // 处理输入
    handleInput();

    // 更新状态
    player1.update();
    player2.update();

    // 检测攻击
    checkAttacks();

    // 更新伤害数字
    updateDamageNumbers();

    // 绘制机甲
    player1.draw();
    player2.draw();

    // 绘制伤害数字
    drawDamageNumbers();

    // 检测胜负
    checkWinCondition();

    // 继续循环
    animationId = requestAnimationFrame(gameLoop);
}

// ============================================
// 重新开始游戏
// ============================================
function restartGame() {
    player1 = new Mecha(150, 1, '#4ecdc4', '蓝甲战士');
    player2 = new Mecha(650, -1, '#ff6b6b', '红甲战士');
    gameState = 'playing';
    damageNumbers = [];
    
    document.getElementById('message').style.display = 'none';
    document.getElementById('restartBtn').style.display = 'none';
    updateHealthUI();
}

// ============================================
// 启动游戏
// ============================================
updateHealthUI();
gameLoop();
