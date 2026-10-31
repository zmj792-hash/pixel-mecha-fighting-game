---
name: prd-driven-game-rewrite
description: 从 PRD.md 产品需求文档驱动 HTML Canvas 游戏重写的完整工作流
source: auto-skill
extracted_at: '2026-07-04T02:11:48.545Z'
---

## 适用场景

当用户提供 PRD.md（产品需求文档）并要求按其需求重写/实现一个 HTML Canvas 小游戏时。

## 工作流程

### 1. 读取 PRD 并提取关键需求

- 读取 PRD.md，提取：页面清单、功能模块、UI 设计规范（颜色/字体/布局）、核心流程
- 将需求映射为代码模块：`screen` 状态机 + 各 `drawXXX()` / `updateXXX()` 函数

### 2. 项目结构

```
project/
├── index.html    # 仅含 Canvas + CSS 外壳（CRT 覆盖层等）
├── game.js       # 全部游戏逻辑（单文件，无框架）
└── PRD.md        # 产品需求文档
```

### 3. HTML 外壳规范

- Canvas 逻辑分辨率应直接设为**最终显示分辨率**（如 960×540），不要用小分辨率 + CSS 拉伸，否则文字和像素画面会模糊
- Google Fonts 引入像素字体（`Press Start 2P` 标题/HUD + `VT323` 正文）
- CRT 扫描线 + 暗角通过 CSS `repeating-linear-gradient` + `radial-gradient` 伪元素实现
- **重要**：Canvas 分辨率翻倍时，所有游戏内坐标、尺寸、字体大小、AI 距离阈值都必须相应翻倍

### 4. game.js 架构

```
常量 → 游戏状态对象 → 输入系统 → 工具函数 → Sprite/角色类 → 特效系统 → AI → 各界面绘制/更新 → 主循环
```

关键设计决策：
- **单文件无框架**：纯原生 JS，零依赖，浏览器直接打开即玩
- **Sprite 用代码字符串矩阵生成**：无需外部图片，字符映射颜色，支持水平翻转
- **输入系统分离**：`keys`（持续按下）+ `justPressed`（单次触发，需在每帧结束时 `clearJustPressed()` 清除未消费状态）
- **攻击判定 once-per-attack**：用 `hasHit` 标志避免一帧多判
- **屏幕震动 + 闪屏**：`ctx.save()/restore()` + `translate` 震动，`globalAlpha` 闪屏

### 5. 颜色与风格遵循 PRD

严格按 PRD 定义的主色调编码：
- 深紫黑底色 `#0d0221`
- P1 霓虹品红 `#ff2a6d`，P2 霓虹青蓝 `#05d9e8`
- 能量警示黄 `#f9f871`

### 6. 完成后用浏览器打开测试

```
start <path>/index.html
```
提醒用户按 Ctrl+Shift+R 强制刷新清除缓存。
