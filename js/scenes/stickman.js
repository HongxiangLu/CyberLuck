/**
 * stickman.js — 拜年姿势王场景（刚体旋转 FK 模型）
 */
var StickmanScene = (function () {
    'use strict';

    var _phase = 'prepare'; // prepare -> playing -> result
    var _timer = 8;
    var _lastTime = 0;
    var _time = 0;
    var W = 0, H = 0, FLOOR_Y = 0;

    var _segments = [];
    var _segMap = {};
    var _selectedSeg = null;
    var _dragStartAngle = 0;
    var _dragPivotX = 0, _dragPivotY = 0;

    var _touchStartH = null, _touchMoveH = null, _touchEndH = null;

    /* ====== 骨骼初始化 ====== */
    function _initSegments() {
        var leftFootX = W * 0.46;
        var rightFootX = W * 0.54;
        var shin = 55, thigh = 50, torso = 65, headL = 22;
        var uArm = 40, fArm = 35;

        // angle: 绝对世界角 (0=正上方, PI/2=右, PI=下, -PI/2=左)
        // attachRatio: 在 parent 线段上的比例位置 (0=pivot端, 1=end端)
        // offX: 垂直于 parent 方向的侧偏移 (parent 本地坐标)
        _segments = [
            { id:'lShin',  pid:null,     angle:0,    len:shin,  thick:9,  color:'#3a5f5f', lbl:'左小腿',
              fpx:leftFootX, fpy:0/*FLOOR_Y*/, ar:1, ox:0 },
            { id:'lThigh', pid:'lShin',  angle:0,    len:thigh, thick:11, color:'#3a5f5f', lbl:'左大腿',
              ar:1, ox:0 },
            { id:'torso',  pid:'lThigh', angle:0,    len:torso, thick:14, color:'#c0392b', lbl:'躯干',
              ar:1, ox:0 },
            { id:'head',   pid:'torso',  angle:0,    len:headL, thick:0,  color:'#FFDEAD', lbl:'头部',
              ar:1, ox:0, isHead:true },
            { id:'lUArm',  pid:'torso',  angle:Math.PI*0.85,  len:uArm, thick:8, color:'#c0392b', lbl:'左大臂',
              ar:0.92, ox:-8 },
            { id:'lFArm',  pid:'lUArm',  angle:Math.PI*0.9,   len:fArm, thick:7, color:'#FFDEAD', lbl:'左小臂',
              ar:1, ox:0 },
            { id:'rUArm',  pid:'torso',  angle:Math.PI*1.15,   len:uArm, thick:8, color:'#c0392b', lbl:'右大臂',
              ar:0.92, ox:8 },
            { id:'rFArm',  pid:'rUArm',  angle:Math.PI*1.1,    len:fArm, thick:7, color:'#FFDEAD', lbl:'右小臂',
              ar:1, ox:0 },
            { id:'rThigh', pid:'torso',  angle:Math.PI,        len:thigh,thick:11,color:'#2F4F4F', lbl:'右大腿',
              ar:0, ox:8 },
            { id:'rShin',  pid:'rThigh', angle:Math.PI,        len:shin, thick:9, color:'#2F4F4F', lbl:'右小腿',
              ar:1, ox:0 }
        ];

        _segMap = {};
        for (var i = 0; i < _segments.length; i++) {
            var s = _segments[i];
            s.px = 0; s.py = 0; s.ex = 0; s.ey = 0;
            s.children = [];
            _segMap[s.id] = s;
        }
        for (var j = 0; j < _segments.length; j++) {
            var seg = _segments[j];
            if (seg.pid && _segMap[seg.pid]) {
                _segMap[seg.pid].children.push(seg);
            }
        }
        // 设置 root 的固定 pivot Y
        _segments[0].fpy = FLOOR_Y;
        _computeFK();
    }

    /* ====== 前向运动学 ====== */
    function _computeFK() {
        var rootBob = 0;
        if (_phase === 'prepare' || _phase === 'result') {
            rootBob = Math.sin(_time * 4) * 3; // 待机时的轻微呼吸动效
        }

        for (var i = 0; i < _segments.length; i++) {
            var s = _segments[i];
            if (!s.pid) {
                // 根节点：固定 pivot
                s.px = s.fpx;
                s.py = s.fpy + rootBob;
            } else {
                var p = _segMap[s.pid];
                // attach 点 = p.pivot + (p.end - p.pivot) * attachRatio
                var ax = p.px + (p.ex - p.px) * s.ar;
                var ay = p.py + (p.ey - p.py) * s.ar;
                // 侧偏移：垂直于 parent 方向
                if (s.ox !== 0) {
                    var pdx = p.ex - p.px, pdy = p.ey - p.py;
                    var pLen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
                    ax += (-pdy / pLen) * s.ox;
                    ay += (pdx / pLen) * s.ox;
                }
                s.px = ax;
                s.py = ay;
            }
            s.ex = s.px + s.len * Math.sin(s.angle);
            s.ey = s.py - s.len * Math.cos(s.angle);
        }
    }

    /* ====== 旋转一个部位 + 所有远地端子代 ====== */
    function _rotateSeg(seg, delta) {
        seg.angle += delta;
        _rotateChildren(seg, delta);
    }
    function _rotateChildren(seg, delta) {
        for (var i = 0; i < seg.children.length; i++) {
            seg.children[i].angle += delta;
            _rotateChildren(seg.children[i], delta);
        }
    }

    /* ====== 场景生命周期 ====== */
    function init() {
        _phase = 'prepare';
        _timer = 8;
        _time = 0;
        _selectedSeg = null;
        W = Engine.width();
        H = Engine.height();
        FLOOR_Y = H * 0.82;

        _initSegments();
        _setupUI();
        _bindTouch();
        _lastTime = performance.now();
        Engine.startLoop(render);
    }

    function _setupUI() {
        UI.clearButtons();
        if (_phase === 'prepare') {
            UI.createButton({ x:15,y:15,w:70,h:36, text:'返回',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
            var bw = Math.min(W*0.6,220);
            UI.createButton({ x:(W-bw)/2, y:H*0.7, w:bw, h:52, text:'开始挑战',
                color:'#FFF', bgColor:'rgba(250,128,114,0.3)',
                borderColor:'rgba(250,128,114,0.8)', fontSize:18, radius:26,
                onClick:function(){ Audio.playTap(); _phase='playing'; _lastTime=performance.now(); _setupUI(); } });
        } else if (_phase === 'result') {
            var bw2 = Math.min(W*0.42,155);
            UI.createButton({ x:W/2-bw2-8, y:H*0.88, w:bw2, h:46, text:'重来',
                color:'#FFF', bgColor:'rgba(255,255,255,0.1)',
                borderColor:'rgba(255,255,255,0.3)', fontSize:15, radius:23,
                onClick:function(){ Audio.playTap(); init(); } });
            UI.createButton({ x:W/2+8, y:H*0.88, w:bw2, h:46, text:'保存图片',
                color:'#FFD700', bgColor:'rgba(255,215,0,0.2)',
                borderColor:'rgba(255,215,0,0.6)', fontSize:15, radius:23,
                onClick:function(){ Audio.playSuccess(); _saveImage(); } });
            UI.createButton({ x:15,y:15,w:70,h:36, text:'首页',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
        }
    }

    /* ====== 触摸交互 ====== */
    function _bindTouch() {
        var canvas = Engine.getCanvas();

        _touchStartH = function (e) {
            e.preventDefault();
            if (_phase !== 'playing') return;
            var pos = _touchPos(e);
            // 寻找被点击的肢节
            var best = null, bestD = 30;
            for (var i = 0; i < _segments.length; i++) {
                var s = _segments[i];
                var d = _distToSegment(pos.x, pos.y, s.px, s.py, s.ex, s.ey);
                if (d < bestD) { bestD = d; best = s; }
            }
            if (best) {
                _selectedSeg = best;
                _dragPivotX = best.px;
                _dragPivotY = best.py;
                _dragStartAngle = Math.atan2(pos.x - _dragPivotX, -(pos.y - _dragPivotY));
                Device.tapVibrate();
            }
        };

        _touchMoveH = function (e) {
            e.preventDefault();
            if (!_selectedSeg || _phase !== 'playing') return;
            var pos = _touchPos(e);
            var newAngle = Math.atan2(pos.x - _dragPivotX, -(pos.y - _dragPivotY));
            var delta = newAngle - _dragStartAngle;
            // 标准化到 [-PI, PI]
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            if (Math.abs(delta) > 0.003) {
                _rotateSeg(_selectedSeg, delta);
                _computeFK();
                _dragStartAngle = newAngle;
            }
        };

        _touchEndH = function (e) {
            e.preventDefault();
            _selectedSeg = null;
        };

        canvas.addEventListener('touchstart', _touchStartH, { passive: false });
        canvas.addEventListener('touchmove', _touchMoveH, { passive: false });
        canvas.addEventListener('touchend', _touchEndH, { passive: false });
        canvas.addEventListener('mousedown', _touchStartH);
        canvas.addEventListener('mousemove', _touchMoveH);
        canvas.addEventListener('mouseup', _touchEndH);
    }

    function _touchPos(e) {
        var t = e.touches ? e.touches[0] : e;
        var r = Engine.getCanvas().getBoundingClientRect();
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function _distToSegment(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px-ax)*(px-ax)+(py-ay)*(py-ay));
        var t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
        var cx = ax + t * dx, cy = ay + t * dy;
        return Math.sqrt((px-cx)*(px-cx)+(py-cy)*(py-cy));
    }

    /* ====== 绘制 ====== */
    function _drawStickman(ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 先画远离观者的部分（右腿），再画近处的
        var drawOrder = ['rThigh','rShin','lShin','lThigh','torso','lUArm','lFArm','rUArm','rFArm','head'];
        for (var di = 0; di < drawOrder.length; di++) {
            var s = _segMap[drawOrder[di]];
            if (!s) continue;

            if (s.isHead) {
                // 头部画圆
                var hcx = (s.px + s.ex) / 2;
                var hcy = (s.py + s.ey) / 2;
                var hr = s.len * 0.7;
                ctx.beginPath();
                ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
                ctx.fillStyle = s.color;
                ctx.fill();
                ctx.strokeStyle = '#CD853F';
                ctx.lineWidth = 2;
                ctx.stroke();
                // 眼睛 — 根据 torso 方向确定朝向
                var faceAngle = _segMap['torso'].angle;
                var ex1x = hcx + Math.cos(faceAngle + 0.4) * hr * 0.4;
                var ex1y = hcy + Math.sin(faceAngle + 0.4) * hr * 0.4;
                var ex2x = hcx + Math.cos(faceAngle - 0.4) * hr * 0.4;
                var ex2y = hcy + Math.sin(faceAngle - 0.4) * hr * 0.4;
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(ex1x, ex1y, 2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(ex2x, ex2y, 2, 0, Math.PI*2); ctx.fill();
            } else {
                // 暗色描边（先画，在后面）
                ctx.beginPath();
                ctx.moveTo(s.px, s.py);
                ctx.lineTo(s.ex, s.ey);
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = s.thick + 3;
                ctx.stroke();
                // 主体颜色（后画，在前面）
                ctx.beginPath();
                ctx.moveTo(s.px, s.py);
                ctx.lineTo(s.ex, s.ey);
                ctx.strokeStyle = s.color;
                ctx.lineWidth = s.thick;
                ctx.stroke();
            }

            // 关节圆点
            ctx.beginPath();
            ctx.arc(s.px, s.py, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ddd';
            ctx.fill();

            // 高亮选中
            if (s === _selectedSeg) {
                ctx.beginPath();
                ctx.moveTo(s.px, s.py);
                ctx.lineTo(s.ex, s.ey);
                ctx.strokeStyle = 'rgba(255,255,0,0.35)';
                ctx.lineWidth = s.thick + 12;
                ctx.stroke();
            }
        }

        // 脚 (小圆)
        var lShin = _segMap['lShin'], rShin = _segMap['rShin'];
        ctx.fillStyle = '#222';
        if (lShin) { ctx.beginPath(); ctx.ellipse(lShin.px, lShin.py, 10, 5, 0, 0, Math.PI*2); ctx.fill(); }
        if (rShin) { ctx.beginPath(); ctx.ellipse(rShin.ex, rShin.ey, 10, 5, 0, 0, Math.PI*2); ctx.fill(); }

        // 手 (小圆)
        var lf = _segMap['lFArm'], rf = _segMap['rFArm'];
        ctx.fillStyle = '#FFDEAD';
        if (lf) { ctx.beginPath(); ctx.arc(lf.ex, lf.ey, 5, 0, Math.PI*2); ctx.fill(); }
        if (rf) { ctx.beginPath(); ctx.arc(rf.ex, rf.ey, 5, 0, Math.PI*2); ctx.fill(); }
    }

    /* ====== 渲染循环 ====== */
    function render(ctx, w, h) {
        var now = performance.now();
        var dt = (now - _lastTime) / 1000;
        _lastTime = now;
        _time += 0.016;

        if (_phase === 'playing') {
            _timer -= dt;
            if (_timer <= 0) {
                _timer = 0;
                _phase = 'result';
                _selectedSeg = null;
                _setupUI();
                Audio.playBlockDrop();
                Device.mediumVibrate();
                Engine.addGoldBurst(w / 2, h * 0.4);
            }
        }

        // 背景
        Draw.drawBackground(ctx, w, h);
        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.76, Draw.THEME.panelDark, Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);

        // 装饰灯笼
        ctx.fillStyle = 'rgba(255,88,179,0.18)';
        ctx.beginPath(); ctx.arc(w*0.1, h*0.08, 35, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(w*0.9, h*0.08, 35, 0, Math.PI*2); ctx.fill();

        // 地面
        ctx.fillStyle = Draw.THEME.pink;
        ctx.fillRect(0, FLOOR_Y, w, h - FLOOR_Y);
        ctx.strokeStyle = Draw.THEME.ink;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(w, FLOOR_Y); ctx.stroke();

        _computeFK();
        _drawStickman(ctx);

        // --- 阶段 UI ---
        if (_phase === 'prepare') {
            var titleW = 200, titleH = 48;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, '拜年姿势王', w/2, h*0.06 + titleH/2 + 2, 28, Draw.THEME.gold);
            
            ctx.save();
            ctx.font = '15px "PoxiaoPixel"';
            ctx.fillStyle = '#fff2c1';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText('点击并拖动肢节，摆出拜年姿势！', w/2, h*0.2);
            ctx.fillText('点击并拖动肢节，摆出拜年姿势！', w/2, h*0.2);
            ctx.strokeText('限时 8 秒', w/2, h*0.25);
            ctx.fillText('限时 8 秒', w/2, h*0.25);
            ctx.restore();
        } else if (_phase === 'playing') {
            // 倒计时
            var timerColor = _timer <= 3 ? Draw.THEME.red : Draw.THEME.gold;
            var titleW = 120, titleH = 60;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, Math.ceil(_timer) + 's', w/2, h*0.06 + titleH/2 + 2, 36, timerColor);
            // 提示
            var hint = _selectedSeg ? ('正在旋转: ' + _selectedSeg.lbl) : '点击身体部位并拖动旋转';
            UI.drawSubtitle(ctx, hint, w/2, h*0.16, 14, Draw.THEME.cyan);
        } else if (_phase === 'result') {
            Draw.drawHalo(ctx, w/2, h*0.35, 140, Draw.THEME.gold, 0.18);
            ctx.save();
            ctx.translate(w/2, h*0.15);
            ctx.rotate(-0.08);
            var titleW = 260, titleH = 60;
            UI.drawRoundedRect(ctx, -titleW / 2, -titleH / 2, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, '新年快乐', 0, 2, 28, Draw.THEME.gold);
            ctx.fillStyle = '#fff2c1';
            ctx.font = '15px "PoxiaoPixel"';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#24113f';
            ctx.strokeText('大吉大利 · 岁岁平安', 0, 46);
            ctx.fillText('大吉大利 · 岁岁平安', 0, 46);
            ctx.restore();
        }

        UI.drawButtons(ctx);
    }

    /* ====== 保存图片 ====== */
    function _saveImage() {
        var ctx = Engine.getCtx();
        UI.clearButtons();
        render(ctx, W, H);
        try {
            var url = Engine.getCanvas().toDataURL('image/png');
            var a = document.createElement('a');
            a.href = url; a.download = '新年拜年.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) { alert('保存失败，请截图保存吧~'); }
        _setupUI();
    }

    /* ====== 销毁 ====== */
    function destroy() {
        UI.clearButtons();
        var c = Engine.getCanvas();
        if (_touchStartH) { c.removeEventListener('touchstart',_touchStartH); c.removeEventListener('mousedown',_touchStartH); }
        if (_touchMoveH)  { c.removeEventListener('touchmove',_touchMoveH);  c.removeEventListener('mousemove',_touchMoveH);  }
        if (_touchEndH)   { c.removeEventListener('touchend',_touchEndH);    c.removeEventListener('mouseup',_touchEndH);    }
        _touchStartH = _touchMoveH = _touchEndH = null;
    }

    return { init: init, destroy: destroy };
})();
