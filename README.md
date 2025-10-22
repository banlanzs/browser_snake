# URL Snake

Play the classic snake game on a URL!

<https://demian.ferrei.ro/snake>

This is how the game should look:

![Pro level gameplay](gameplay.gif)

## 功能增强

本项目在原版基础上增加了以下功能：

### 1. 历史得分记录
- 自动保存游戏历史得分（最多10条记录）
- 最新得分显示在最上方
- 可通过点击"H"按钮查看历史得分

### 2. 蛇头方向标识
- 蛇头会根据移动方向显示相应的箭头（↑↓←→）
- 蛇身和食物仍显示为圆点
- 可通过"Show Visual Grid"按钮查看可视化网格

### 3. 快速移动和加速功能
- 支持所有方向键（上下左右、WASD、HJKL）的快速移动和加速
- 快速点击方向键（300ms内）可快速移动3格
- 长按方向键（500ms后）可启动两倍速移动

### 4. 暂停功能
- 页面添加了暂停/继续按钮
- 可随时暂停和继续游戏
- 暂停时会在URL中显示"[paused]"标记

### 5.本地测试
```
python -m http.server 8000 --bind localhost
```

## ⚠️ **Attention!!!** ⚠️
<span style="color:red; font-weight:bold;">会产生大量历史记录，造成Boom！请在无痕模式下使用</span>

## 浏览器兼容性

Note that the game might be unplayable on some browsers for different reasons, like the browser not showing the full URL, or not allowing it to change so frequently, or escaping the Braille characters used to display the game.

Although this game is kind of a joke, bug reports, ideas and pull requests are always [welcome](https://github.com/epidemian/snake/issues)!