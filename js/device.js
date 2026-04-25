/**
 * device.js — 陀螺仪 / 震动 API 封装 (iOS + Android)
 */
var Device = (function () {
    'use strict';

    var motionGranted = false;
    var motionListeners = [];
    var _lastAcc = { x: 0, y: 0, z: 0 };
    var _shakeCallbacks = [];
    var _shakeThreshold = 12;
    var _lastShakeTime = 0;
    var _bowCallbacks = [];
    var _bowState = 'idle'; // idle → down → up → counted
    var _bowYHistory = [];

    /** 请求陀螺仪权限（跨平台） */
    function requestMotionPermission(callback) {
        if (motionGranted) {
            callback(true);
            return;
        }

        // iOS 13+ 需要用户手势触发权限请求
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(function (state) {
                    if (state === 'granted') {
                        motionGranted = true;
                        _startListening();
                        callback(true);
                    } else {
                        callback(false);
                    }
                })
                .catch(function () {
                    callback(false);
                });
        } else if ('DeviceMotionEvent' in window) {
            // Android 或旧版 iOS — 直接可用
            motionGranted = true;
            _startListening();
            callback(true);
        } else {
            callback(false);
        }
    }

    function _startListening() {
        window.addEventListener('devicemotion', _onMotion, { passive: true });
    }

    function _onMotion(e) {
        var acc = e.accelerationIncludingGravity;
        if (!acc) return;

        var ax = acc.x || 0;
        var ay = acc.y || 0;
        var az = acc.z || 0;

        // 通知所有运动监听器
        for (var i = 0; i < motionListeners.length; i++) {
            motionListeners[i]({ x: ax, y: ay, z: az });
        }

        // 晃动检测
        var delta = Math.abs(ax - _lastAcc.x) + Math.abs(ay - _lastAcc.y) + Math.abs(az - _lastAcc.z);
        if (delta > _shakeThreshold) {
            var now = Date.now();
            if (now - _lastShakeTime > 300) {
                _lastShakeTime = now;
                for (var j = 0; j < _shakeCallbacks.length; j++) {
                    _shakeCallbacks[j](delta);
                }
            }
        }

        // 拜拜检测（上下运动）
        _bowYHistory.push({ t: Date.now(), y: ay });
        if (_bowYHistory.length > 30) _bowYHistory.shift();
        _detectBow();

        _lastAcc = { x: ax, y: ay, z: az };
    }

    function _detectBow() {
        if (_bowYHistory.length < 10) return;
        var recent = _bowYHistory.slice(-15);
        var minY = Infinity, maxY = -Infinity;
        for (var i = 0; i < recent.length; i++) {
            if (recent[i].y < minY) minY = recent[i].y;
            if (recent[i].y > maxY) maxY = recent[i].y;
        }
        var range = maxY - minY;
        if (range > 8) {
            var now = Date.now();
            if (now - (_detectBow._lastBow || 0) > 800) {
                _detectBow._lastBow = now;
                for (var j = 0; j < _bowCallbacks.length; j++) {
                    _bowCallbacks[j](range);
                }
                _bowYHistory = [];
            }
        }
    }
    _detectBow._lastBow = 0;

    function onShake(cb) { _shakeCallbacks.push(cb); }
    function offShake(cb) {
        var idx = _shakeCallbacks.indexOf(cb);
        if (idx >= 0) _shakeCallbacks.splice(idx, 1);
    }

    function onBow(cb) { _bowCallbacks.push(cb); }
    function offBow(cb) {
        var idx = _bowCallbacks.indexOf(cb);
        if (idx >= 0) _bowCallbacks.splice(idx, 1);
    }

    function onMotion(cb) { motionListeners.push(cb); }
    function offMotion(cb) {
        var idx = motionListeners.indexOf(cb);
        if (idx >= 0) motionListeners.splice(idx, 1);
    }

    function clearAll() {
        _shakeCallbacks = [];
        _bowCallbacks = [];
        motionListeners = [];
    }

    /** 震动封装 — iOS 不支持时静默降级 */
    function vibrate(pattern) {
        try {
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch (e) { /* 静默 */ }
    }

    /** 短震动 */
    function tapVibrate() { vibrate(50); }

    /** 中等震动 */
    function mediumVibrate() { vibrate([30, 50, 80]); }

    /** 是否已获得权限 */
    function isMotionGranted() { return motionGranted; }

    /** 检测是否支持陀螺仪 */
    function isMotionSupported() {
        return 'DeviceMotionEvent' in window;
    }

    return {
        requestMotionPermission: requestMotionPermission,
        isMotionGranted: isMotionGranted,
        isMotionSupported: isMotionSupported,
        onShake: onShake,
        offShake: offShake,
        onBow: onBow,
        offBow: offBow,
        onMotion: onMotion,
        offMotion: offMotion,
        clearAll: clearAll,
        vibrate: vibrate,
        tapVibrate: tapVibrate,
        mediumVibrate: mediumVibrate
    };
})();
