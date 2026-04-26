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
    var _dropProgress = 1;
    var _dropDuration = 0.55;
    var _dropFromPose = null;
    var _dropToPose = null;
    var _resultMeta = null;
    var _spriteLoadToken = 0;
    var _spritesReady = false;
    var _spriteSet = {
        head: null,
        torso: null,
        arm: null,
        leg: null,
        foot: null
    };

    var _touchStartH = null, _touchMoveH = null, _touchEndH = null;

    function _loadStickmanSprites(done) {
        if (_spritesReady && _spriteSet.head && _spriteSet.torso && _spriteSet.arm && _spriteSet.leg && _spriteSet.foot) {
            done();
            return;
        }

        var token = ++_spriteLoadToken;
        var names = ['head', 'torso', 'arm', 'leg', 'foot'];
        var remaining = names.length;

        function finish() {
            if (token !== _spriteLoadToken) return;
            remaining--;
            if (remaining <= 0) {
                _spritesReady = true;
                done();
            }
        }

        for (var i = 0; i < names.length; i++) {
            (function (name) {
                var existing = _spriteSet[name];
                if (existing && existing.complete && existing.naturalWidth > 0) {
                    finish();
                    return;
                }

                var img = new Image();
                img.onload = finish;
                img.onerror = finish;
                img.src = './images/stickman/' + name + '.png';
                _spriteSet[name] = img;
            })(names[i]);
        }
    }

    /* ====== 骨骼初始化 ====== */
    function _initSegments() {
        var leftFootX = W * 0.47;
        var shin = 70, thigh = 66, torso = 88, headL = 28;
        var uArm = 54, fArm = 48;

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

    function _buildBowPose() {
        return {
            lShin: 0.03,
            lThigh: 0.12,
            torso: 0.68,
            head: 0.76,
            lUArm: 1.72,
            lFArm: 1.08,
            rUArm: 1.46,
            rFArm: 1.88,
            rThigh: Math.PI - 0.16,
            rShin: Math.PI - 0.06
        };
    }

    function _buildLoosePose() {
        return {
            lShin: 0.04,
            lThigh: -0.12,
            torso: 0.22,
            head: 0.28,
            lUArm: 2.56,
            lFArm: 2.9,
            rUArm: 3.64,
            rFArm: 3.28,
            rThigh: Math.PI + 0.16,
            rShin: Math.PI + 0.04
        };
    }

    function _capturePose() {
        var pose = {};
        for (var i = 0; i < _segments.length; i++) {
            pose[_segments[i].id] = _segments[i].angle;
        }
        return pose;
    }

    function _normalizeAngle(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    function _lerpAngle(a, b, t) {
        return a + _normalizeAngle(b - a) * t;
    }

    function _applyPose(pose) {
        for (var i = 0; i < _segments.length; i++) {
            if (pose[_segments[i].id] == null) continue;
            _segments[i].angle = pose[_segments[i].id];
        }
        _computeFK();
    }

    function _applyPoseBlend(fromPose, toPose, t) {
        for (var i = 0; i < _segments.length; i++) {
            var seg = _segments[i];
            var from = fromPose[seg.id];
            var to = toPose[seg.id];
            if (from == null || to == null) continue;
            seg.angle = _lerpAngle(from, to, t);
        }
        _computeFK();
    }

    function _easeOutCubic(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    }

    function _getFloatAnchor() {
        return {
            x: W * 0.48,
            y: H * 0.655
        };
    }

    function _getGroundAnchor() {
        return {
            x: W * 0.48,
            y: FLOOR_Y
        };
    }

    function _setRootAnchor(x, y) {
        _segments[0].fpx = x;
        _segments[0].fpy = y;
    }

    function _placePrepareFigure() {
        var anchor = _getFloatAnchor();
        _setRootAnchor(anchor.x, anchor.y);
        _applyPose(_buildBowPose());
        _dropProgress = 1;
    }

    function _startChallenge() {
        Audio.playTap();
        _phase = 'playing';
        _selectedSeg = null;
        _resultMeta = null;
        _dropProgress = 0;
        _dropFromPose = _capturePose();
        _dropToPose = _buildLoosePose();
        _lastTime = performance.now();
        _setupUI();
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
        _resultMeta = null;
        _dropProgress = 1;
        W = Engine.width();
        H = Engine.height();
        FLOOR_Y = H * 0.835;
        _spritesReady = false;

        _loadStickmanSprites(function () {
            _initSegments();
            _placePrepareFigure();
            _setupUI();
            _bindTouch();
            _lastTime = performance.now();
            Engine.startLoop(render);
        });
    }

    function _setupUI() {
        UI.clearButtons();
        if (_phase === 'prepare') {
            UI.createButton({ x:15,y:15,w:70,h:36, text:'返回',
                color:'rgba(255,255,255,0.7)', bgColor:'rgba(255,255,255,0.05)',
                borderColor:'rgba(255,255,255,0.15)', fontSize:13, radius:18,
                onClick:function(){ App.switchScene('home'); } });
            var bw = Math.min(W * 0.62, 232);
            UI.createButton({ x:(W-bw)/2, y:H*0.79, w:bw, h:52, text:'开始挑战',
                color:'#FFF7D6', bgColor:'rgba(255,79,184,0.28)',
                borderColor:'rgba(255,215,94,0.78)', fontSize:18, radius:26,
                onClick:_startChallenge });
        } else if (_phase === 'result') {
            var bw2 = Math.min(W*0.42,155);
            UI.createButton({ x:W/2-bw2-8, y:H*0.88, w:bw2, h:46, text:'重来',
                color:'#D9F9FF', bgColor:'rgba(0,240,255,0.12)',
                borderColor:'rgba(0,240,255,0.42)', fontSize:15, radius:23,
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
            if (_phase !== 'playing' || _dropProgress < 1) return;
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
            if (!_selectedSeg || _phase !== 'playing' || _dropProgress < 1) return;
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

    function _getNodeSnapshot() {
        var head = _segMap.head;
        var lFArm = _segMap.lFArm;
        var rFArm = _segMap.rFArm;
        var lShin = _segMap.lShin;
        var rShin = _segMap.rShin;
        var torso = _segMap.torso;
        var rThigh = _segMap.rThigh;

        var pelvisX = ((torso ? torso.px : W * 0.5) + (rThigh ? rThigh.px : W * 0.5)) / 2;
        var pelvisY = ((torso ? torso.py : H * 0.6) + (rThigh ? rThigh.px != null ? rThigh.py : H * 0.6 : H * 0.6)) / 2;

        return {
            head: head ? { x: (head.px + head.ex) / 2, y: (head.py + head.ey) / 2 } : null,
            leftHand: lFArm ? { x: lFArm.ex, y: lFArm.ey } : null,
            rightHand: rFArm ? { x: rFArm.ex, y: rFArm.ey } : null,
            leftKnee: lShin ? { x: lShin.ex, y: lShin.ey } : null,
            rightKnee: rShin ? { x: rShin.ex, y: rShin.ey } : null,
            pelvis: { x: pelvisX, y: pelvisY },
            torso: torso ? { x: torso.px, y: torso.py, ex: torso.ex, ey: torso.ey } : null
        };
    }

    function _evaluatePoseResult() {
        var nodes = _getNodeSnapshot();
        var head = nodes.head || { x: W * 0.5, y: H * 0.3 };
        var leftHand = nodes.leftHand || { x: W * 0.45, y: H * 0.45 };
        var rightHand = nodes.rightHand || { x: W * 0.55, y: H * 0.45 };
        var leftKnee = nodes.leftKnee || { x: W * 0.45, y: FLOOR_Y };
        var rightKnee = nodes.rightKnee || { x: W * 0.55, y: FLOOR_Y };
        var pelvis = nodes.pelvis || { x: W * 0.5, y: H * 0.55 };
        var kneeNearFloorThreshold = Math.max(18, H * 0.035);
        var torsoTiltThreshold = Math.max(42, W * 0.12);

        var bothKneesNearFloor = Math.abs(FLOOR_Y - leftKnee.y) <= kneeNearFloorThreshold &&
            Math.abs(FLOOR_Y - rightKnee.y) <= kneeNearFloorThreshold;
        var handsAboveHead = leftHand.y <= head.y && rightHand.y <= head.y;
        var torsoTwisted = Math.abs(head.x - pelvis.x) > torsoTiltThreshold;
        var headBelowPelvis = head.y >= pelvis.y;

        if (headBelowPelvis && bothKneesNearFloor) {
            return {
                key: 'kowtow',
                tag: '至诚磕头，万事顺遂',
                quote: '诚心跪拜，霉运清零，财运福气双双到',
                nodes: nodes
            };
        }

        if (handsAboveHead) {
            return {
                key: 'wild',
                tag: '拳脚拜年，百无禁忌',
                quote: '不走寻常拜年路，自在逍遥无烦恼',
                nodes: nodes
            };
        }

        if (torsoTwisted) {
            return {
                key: 'tilted',
                tag: '歪门邪道，好运绕道',
                quote: '姿势不正福气偏，新一年主打随性自由',
                nodes: nodes
            };
        }

        return {
            key: 'formal',
            tag: '规规矩矩，岁岁平安',
            quote: '礼数周全，神明偏爱，全年顺风顺水',
            nodes: nodes
        };
    }

    /* ====== 绘制 ====== */
    function _mixColor(hex1, hex2, t) {
        var a = {
            r: parseInt(hex1.slice(1, 3), 16),
            g: parseInt(hex1.slice(3, 5), 16),
            b: parseInt(hex1.slice(5, 7), 16)
        };
        var b = {
            r: parseInt(hex2.slice(1, 3), 16),
            g: parseInt(hex2.slice(3, 5), 16),
            b: parseInt(hex2.slice(5, 7), 16)
        };
        var p = Math.max(0, Math.min(1, t));
        var r = Math.round(a.r + (b.r - a.r) * p);
        var g = Math.round(a.g + (b.g - a.g) * p);
        var bl = Math.round(a.b + (b.b - a.b) * p);
        return '#' + (1 << 24 | r << 16 | g << 8 | bl).toString(16).slice(1);
    }

    function _drawBoneSprite(ctx, img, x1, y1, x2, y2, height, anchorX) {
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        var dx = x2 - x1;
        var dy = y2 - y1;
        var length = Math.sqrt(dx * dx + dy * dy) || 1;
        var angle = Math.atan2(dy, dx);
        var drawHeight = height || (length * (img.naturalHeight / Math.max(1, img.naturalWidth)));
        var ax = anchorX == null ? 0 : anchorX;

        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(angle);
        ctx.drawImage(img, -length * ax, -drawHeight / 2, length, drawHeight);
        ctx.restore();
    }

    function _drawHeadSprite(ctx, seg) {
        var img = _spriteSet.head;
        if (!seg || !img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        var cx = seg.ex;
        var cy = seg.ey;
        var size = Math.max(44, seg.len * 2.18);
        var h = size * (img.naturalHeight / Math.max(1, img.naturalWidth));
        ctx.drawImage(img, cx - size / 2, cy - h / 2, size, h);
    }

    function _drawFootSprite(ctx, x, y, flip) {
        var img = _spriteSet.foot;
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
        var w = 24;
        var h = w * (img.naturalHeight / Math.max(1, img.naturalWidth));
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -w * 0.35, -h * 0.45, w, h);
        ctx.restore();
    }

    function _drawJointPatch(ctx, x, y, radius, color) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color || '#2d1d26';
        ctx.fill();
        ctx.restore();
    }

    function _drawCharacterShadow(ctx, cx, y, scale, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha == null ? 0.24 : alpha;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(cx, y, 48 * (scale || 1), 12 * (scale || 1), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawDataStream(ctx, x, y, h, colorA, colorB) {
        ctx.save();
        for (var i = 0; i < h; i += 10) {
            ctx.fillStyle = (i / 10) % 2 === 0 ? colorA : colorB;
            ctx.fillRect(x, y + i, 4, 6);
        }
        ctx.restore();
    }

    function _drawTempleBeacon(ctx, x, y, scale) {
        var s = scale || 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#150a26';
        ctx.fillRect(-14 * s, -56 * s, 28 * s, 80 * s);
        ctx.fillStyle = '#2a184d';
        ctx.fillRect(-10 * s, -52 * s, 20 * s, 72 * s);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-6 * s, -46 * s, 12 * s, 48 * s);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(-6 * s, 6 * s, 12 * s, 8 * s);
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(-16 * s, 20 * s, 32 * s, 8 * s);
        ctx.restore();
    }

    function _drawCurtain(ctx, x, y, w, h, side) {
        ctx.save();
        ctx.fillStyle = '#4b0f2f';
        ctx.fillRect(x, y, w, h);
        for (var i = 0; i < w; i += 12) {
            ctx.fillStyle = i % 24 === 0 ? '#8e1d49' : '#6a1538';
            ctx.fillRect(x + i, y, 8, h);
        }
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(x, y + 14, w, 4);
        ctx.fillRect(x, y + h - 10, w, 4);
        ctx.fillStyle = '#ff4fb8';
        if (side === 'left') {
            ctx.fillRect(x + w - 8, y, 8, h);
        } else {
            ctx.fillRect(x, y, 8, h);
        }
        ctx.restore();
    }

    function _drawStageSpotlight(ctx, cx, topY, bottomY, width, color) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - 18, topY);
        ctx.lineTo(cx + 18, topY);
        ctx.lineTo(cx + width, bottomY);
        ctx.lineTo(cx - width, bottomY);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    function _drawCyberTempleBackdrop(ctx, w, h) {
        var stageX = w * 0.08;
        var stageY = h * 0.08;
        var stageW = w * 0.84;
        var stageH = h * 0.76;
        var screenX = w * 0.17;
        var screenY = h * 0.29;
        var screenW = w * 0.66;
        var screenH = h * 0.38;
        var altarY = stageY + stageH * 0.78;

        ctx.fillStyle = '#130a28';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1c103b';
        ctx.fillRect(0, 0, w, FLOOR_Y);

        _drawStageSpotlight(ctx, w * 0.28, stageY + 4, screenY + screenH * 0.9, 84, 'rgba(0,240,255,0.15)');
        _drawStageSpotlight(ctx, w * 0.72, stageY + 4, screenY + screenH * 0.9, 84, 'rgba(255,79,184,0.14)');

        _drawCurtain(ctx, 0, stageY + 18, 46, stageH - 40, 'left');
        _drawCurtain(ctx, w - 46, stageY + 18, 46, stageH - 40, 'right');

        ctx.fillStyle = '#6a1538';
        ctx.fillRect(stageX + 26, stageY, stageW - 52, 26);
        ctx.fillStyle = '#8f224d';
        for (var vx = stageX + 34; vx < stageX + stageW - 34; vx += 18) {
            ctx.fillRect(vx, stageY + 4, 10, 18);
        }
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(stageX + 22, stageY + 20, stageW - 44, 4);

        Draw.drawFrame(ctx, w, h);
        Draw.drawPanel(ctx, stageX, stageY + 28, stageW, stageH - 28, '#171032', '#00f0ff', '#ff4fb8', '#0a0615');
        Draw.drawPanel(ctx, screenX, screenY, screenW, screenH, '#160c2c', '#ffd75e', '#ff4fb8', '#0a0615');

        ctx.fillStyle = '#25134a';
        ctx.fillRect(screenX + 12, screenY + 12, screenW - 24, screenH - 24);
        ctx.fillStyle = 'rgba(0,240,255,0.1)';
        for (var gy = screenY + 24; gy < screenY + screenH - 18; gy += 18) {
            ctx.fillRect(screenX + 18, gy, screenW - 36, 2);
        }

        ctx.fillStyle = '#12091f';
        ctx.fillRect(w / 2 - 96, screenY + 26, 192, 30);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(w / 2 - 90, screenY + 32, 180, 18);
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(w / 2 - 48, screenY + 22, 96, 4);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(w / 2 - 8, screenY + 32, 16, 18);

        _drawTempleBeacon(ctx, screenX + 30, altarY - 28, 1);
        _drawTempleBeacon(ctx, screenX + screenW - 30, altarY - 28, 1);
        _drawDataStream(ctx, screenX + 28, screenY + 10, 86, '#00f0ff', '#ff4fb8');
        _drawDataStream(ctx, screenX + screenW - 32, screenY + 10, 86, '#ff4fb8', '#00f0ff');

        ctx.fillStyle = '#12091f';
        ctx.fillRect(w / 2 - 126, altarY + 2, 252, 36);
        ctx.fillStyle = '#3d225f';
        ctx.fillRect(w / 2 - 108, altarY + 10, 216, 18);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(w / 2 - 102, altarY + 10, 204, 4);
        ctx.fillStyle = '#ff4fb8';
        ctx.fillRect(w / 2 - 88, altarY + 22, 176, 4);

        ctx.fillStyle = 'rgba(255,215,94,0.16)';
        ctx.fillRect(w / 2 - 152, screenY + 102, 22, 22);
        ctx.fillRect(w / 2 + 130, screenY + 122, 18, 18);
        ctx.fillStyle = 'rgba(0,240,255,0.15)';
        ctx.fillRect(w / 2 - 142, screenY + 138, 16, 16);
        ctx.fillRect(w / 2 + 116, screenY + 84, 20, 20);
    }

    function _drawGuideCard(ctx, x, y, w, lines, accent) {
        var h = 18 + lines.length * 18;
        Draw.drawPanel(ctx, x, y, w, h, 'rgba(35,18,68,0.92)', accent || Draw.THEME.cyan, Draw.THEME.pink, Draw.THEME.ink);
        ctx.save();
        ctx.font = '13px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        for (var i = 0; i < lines.length; i++) {
            ctx.strokeStyle = '#24113f';
            ctx.strokeText(lines[i], x + w / 2, y + 18 + i * 18);
            ctx.fillStyle = '#fff2c1';
            ctx.fillText(lines[i], x + w / 2, y + 18 + i * 18);
        }
        ctx.restore();
    }

    function _wrapPosterText(ctx, text, maxWidth) {
        var chars = String(text || '').split('');
        var lines = [];
        var current = '';
        for (var i = 0; i < chars.length; i++) {
            var next = current + chars[i];
            if (current && ctx.measureText(next).width > maxWidth) {
                lines.push(current);
                current = chars[i];
            } else {
                current = next;
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    function _drawNeonText(ctx, text, x, y, size, fill, glow) {
        ctx.save();
        ctx.font = size + 'px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.shadowColor = glow || fill || '#00f0ff';
        ctx.shadowBlur = Math.max(8, Math.round(size * 0.45));
        ctx.lineWidth = Math.max(3, Math.round(size * 0.18));
        ctx.strokeStyle = '#170b2d';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fill || '#fff2c1';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function _drawResultPosterText(ctx, w, h) {
        var meta = _resultMeta || _evaluatePoseResult();
        var tag = meta.tag;
        var quote = meta.quote;
        var cardW = Math.min(w * 0.72, 320);
        var cardX = w / 2 - cardW / 2;
        var cardY = h * 0.12;

        Draw.drawPanel(ctx, cardX, cardY, cardW, 118, 'rgba(35,18,68,0.92)', Draw.THEME.gold, Draw.THEME.pink, Draw.THEME.ink);
        _drawNeonText(ctx, tag, w / 2, cardY + 28, 18, '#ffea7a', '#ff58b3');

        ctx.save();
        ctx.font = '14px "PoxiaoPixel"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        var lines = _wrapPosterText(ctx, quote, cardW - 28);
        for (var i = 0; i < lines.length; i++) {
            ctx.strokeStyle = '#170b2d';
            ctx.strokeText(lines[i], w / 2, cardY + 58 + i * 20);
            ctx.fillStyle = '#7cf7ff';
            ctx.fillText(lines[i], w / 2, cardY + 58 + i * 20);
        }
        ctx.restore();
    }

    function _drawSelectionGlow(ctx, s) {
        if (!s) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 234, 0, 0.34)';
        ctx.lineWidth = s.isHead ? 20 : (s.thick + 14);
        ctx.lineCap = 'round';
        if (s.isHead) {
            var hcx = (s.px + s.ex) / 2;
            var hcy = (s.py + s.ey) / 2;
            ctx.beginPath();
            ctx.arc(hcx, hcy, s.len * 0.9, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(s.px, s.py);
            ctx.lineTo(s.ex, s.ey);
            ctx.stroke();
        }
        ctx.restore();
    }

    function _drawSleeveTrail(ctx, shoulder, hand, color) {
        if (!shoulder || !hand) return;
        var dx = hand.ex - shoulder.px;
        var dy = hand.ey - shoulder.py;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len;
        var ny = dx / len;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(shoulder.px + nx * 9, shoulder.py + ny * 9);
        ctx.quadraticCurveTo(
            shoulder.px + dx * 0.45 + nx * 16,
            shoulder.py + dy * 0.45 + ny * 16,
            hand.ex + nx * 8,
            hand.ey + ny * 6
        );
        ctx.lineTo(hand.ex - nx * 8, hand.ey - ny * 6);
        ctx.quadraticCurveTo(
            shoulder.px + dx * 0.38 - nx * 12,
            shoulder.py + dy * 0.38 - ny * 12,
            shoulder.px - nx * 8,
            shoulder.py - ny * 8
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function _drawStickman(ctx) {
        var torso = _segMap.torso;
        var head = _segMap.head;
        var lShin = _segMap.lShin;
        var rShin = _segMap.rShin;
        var drawOrder = ['rThigh','rShin','lShin','lThigh','torso','lUArm','lFArm','rUArm','rFArm'];
        var heights = {
            torso: 72,
            lUArm: 30,
            lFArm: 28,
            rUArm: 30,
            rFArm: 28,
            lThigh: 34,
            lShin: 28,
            rThigh: 34,
            rShin: 28
        };

        for (var di = 0; di < drawOrder.length; di++) {
            var s = _segMap[drawOrder[di]];
            if (!s) continue;
            if (s === _selectedSeg) _drawSelectionGlow(ctx, s);

            var img = s.id === 'torso' ? _spriteSet.torso :
                (s.id.indexOf('Arm') !== -1 ? _spriteSet.arm : _spriteSet.leg);
            var anchorX = s.id === 'torso' ? 0.08 : 0;
            _drawBoneSprite(ctx, img, s.px, s.py, s.ex, s.ey, heights[s.id], anchorX);
        }

        for (var ji = 0; ji < drawOrder.length; ji++) {
            var jointSeg = _segMap[drawOrder[ji]];
            if (!jointSeg) continue;
            _drawJointPatch(ctx, jointSeg.px, jointSeg.py, jointSeg.id === 'torso' ? 5 : 4, '#241521');
        }

        if (head === _selectedSeg) _drawSelectionGlow(ctx, head);
        _drawHeadSprite(ctx, head);

        if (torso && head) {
            _drawJointPatch(ctx, torso.ex, torso.ey, 4, '#2c1a24');
        }
        if (lShin) {
            _drawJointPatch(ctx, lShin.ex, lShin.ey, 3, '#261925');
            _drawFootSprite(ctx, lShin.px, lShin.py, true);
        }
        if (rShin) {
            _drawJointPatch(ctx, rShin.ex, rShin.ey, 3, '#261925');
            _drawFootSprite(ctx, rShin.ex, rShin.ey, false);
        }
    }

    /* ====== 渲染循环 ====== */
    function render(ctx, w, h) {
        var now = performance.now();
        var dt = (now - _lastTime) / 1000;
        _lastTime = now;
        _time += 0.016;

        if (_phase === 'playing') {
            if (_dropProgress < 1) {
                _dropProgress = Math.min(1, _dropProgress + dt / _dropDuration);
                if (_dropProgress >= 1) {
                    var ground = _getGroundAnchor();
                    _setRootAnchor(ground.x, ground.y);
                    _applyPose(_dropToPose || _buildLoosePose());
                }
            } else {
                _timer -= dt;
                if (_timer <= 0) {
                    _timer = 0;
                    _resultMeta = _evaluatePoseResult();
                    _phase = 'result';
                    _selectedSeg = null;
                    _setupUI();
                    Audio.playBlockDrop();
                    Device.mediumVibrate();
                    Engine.addGoldBurst(w / 2, h * 0.4);
                }
            }
        }

        // 背景
        _drawCyberTempleBackdrop(ctx, w, h);

        // 地面
        ctx.fillStyle = '#6f153d';
        ctx.fillRect(0, FLOOR_Y, w, h - FLOOR_Y);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(0, FLOOR_Y, w, 6);
        ctx.fillStyle = '#ff4fb8';
        for (var gx = 0; gx < w; gx += 28) {
            ctx.fillRect(gx, FLOOR_Y + 18, 12, 3);
        }
        ctx.strokeStyle = Draw.THEME.ink;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, FLOOR_Y); ctx.lineTo(w, FLOOR_Y); ctx.stroke();

        if (_phase === 'prepare') {
            var floatAnchor = _getFloatAnchor();
            _setRootAnchor(floatAnchor.x, floatAnchor.y + Math.sin(_time * 2.8) * 8);
            _applyPose(_buildBowPose());
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 1.2, 0.16);
            Draw.drawHalo(ctx, w / 2, h * 0.42, 120, Draw.THEME.gold, 0.12 + Math.sin(_time * 2.4) * 0.04);
        } else if (_phase === 'playing' && _dropProgress < 1) {
            var eased = _easeOutCubic(_dropProgress);
            var fromAnchor = _getFloatAnchor();
            var toAnchor = _getGroundAnchor();
            _setRootAnchor(
                fromAnchor.x + (toAnchor.x - fromAnchor.x) * eased,
                fromAnchor.y + (toAnchor.y - fromAnchor.y) * eased
            );
            _applyPoseBlend(_dropFromPose || _buildBowPose(), _dropToPose || _buildLoosePose(), eased);
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 0.9 + eased * 0.25, 0.12 + eased * 0.12);
        } else {
            if (_phase === 'playing' || _phase === 'result') {
                var groundAnchor = _getGroundAnchor();
                _setRootAnchor(groundAnchor.x, groundAnchor.y);
            }
            _computeFK();
            _drawCharacterShadow(ctx, w / 2, FLOOR_Y + 2, 1.18, 0.24);
        }

        _drawStickman(ctx);

        // --- 阶段 UI ---
        if (_phase === 'prepare') {
            var titleW = 200, titleH = 48;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, '拜年姿势王', w/2, h*0.06 + titleH/2 + 2, 28, Draw.THEME.gold);
            _drawGuideCard(ctx, w * 0.14, h * 0.14, w * 0.72, [
                '空中示范：标准弯腰作揖',
                '双手合拢，低头，含胸前倾',
                '开始后他会落地散开，8 秒内拖回拜年姿势'
            ], Draw.THEME.cyan);
        } else if (_phase === 'playing') {
            // 倒计时
            var timerColor = _timer <= 3 ? Draw.THEME.red : Draw.THEME.gold;
            var titleW = 120, titleH = 60;
            UI.drawRoundedRect(ctx, w / 2 - titleW / 2, h * 0.06, titleW, titleH, 0, Draw.THEME.pink, Draw.THEME.ink);
            UI.drawTitle(ctx, (_dropProgress < 1 ? '...' : Math.ceil(_timer) + 's'), w/2, h*0.06 + titleH/2 + 2, 36, timerColor);
            if (_dropProgress < 1) {
                _drawGuideCard(ctx, w * 0.18, h * 0.15, w * 0.64, [
                    '人物落地中...',
                    '等姿势散开后，立刻开摆'
                ], Draw.THEME.gold);
            } else {
                var hint = _selectedSeg ? ('正在调整：' + _selectedSeg.lbl) : '先扶正躯干，再把双手摆回胸前作揖';
                _drawGuideCard(ctx, w * 0.16, h * 0.14, w * 0.68, [
                    hint,
                    '拖动手臂、腿和头部，拼回标准拜年姿势'
                ], Draw.THEME.cyan);
            }
        } else if (_phase === 'result') {
            Draw.drawHalo(ctx, w/2, h*0.35, 140, Draw.THEME.gold, 0.18);
            _drawResultPosterText(ctx, w, h);
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
            var fileName = ((_resultMeta && _resultMeta.key) || 'new-year') + '-poster.png';
            a.href = url; a.download = fileName;
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
