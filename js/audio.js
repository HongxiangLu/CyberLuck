/**
 * audio.js — Web Audio API 音效合成（纯代码生成，无需 MP3）
 */
var Audio = (function () {
    'use strict';

    var audioCtx = null;
    var _initialized = false;

    /** 首次用户交互时初始化 AudioContext（iOS Safari 要求） */
    function init() {
        if (_initialized) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                audioCtx = new AC();
                // iOS Safari 需要 resume
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                _initialized = true;
            }
        } catch (e) { /* 静默降级 */ }
    }

    /** 确保上下文激活 */
    function _ensureCtx() {
        if (!audioCtx) init();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    /**
     * 木鱼敲击声 — 低频正弦波 + 噪声模拟木质打击
     */
    function playWoodHit() {
        var ctx = _ensureCtx();
        if (!ctx) return;
        var now = ctx.currentTime;

        // 基频打击音
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        // 木质噪声
        var bufferSize = ctx.sampleRate * 0.1;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        var noise = ctx.createBufferSource();
        noise.buffer = buffer;
        var noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        // 带通滤波 — 木质感
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 200;
        filter.Q.value = 2;

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.12);
    }

    /**
     * 金币/成功音效 — 高频叮～
     */
    function playSuccess() {
        var ctx = _ensureCtx();
        if (!ctx) return;
        var now = ctx.currentTime;

        [880, 1100, 1320].forEach(function (freq, idx) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            var t = now + idx * 0.08;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    }

    /**
     * 杯筊落地声 — 短促双击
     */
    function playBlockDrop() {
        var ctx = _ensureCtx();
        if (!ctx) return;
        var now = ctx.currentTime;

        for (var k = 0; k < 2; k++) {
            var t = now + k * 0.12;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300 + k * 100, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.2);

            // 碰撞噪声
            var buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
            var d = buf.getChannelData(0);
            for (var i = 0; i < d.length; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.2));
            }
            var ns = ctx.createBufferSource();
            ns.buffer = buf;
            var ng = ctx.createGain();
            ng.gain.setValueAtTime(0.25, t);
            ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            ns.connect(ng);
            ng.connect(ctx.destination);
            ns.start(t);
            ns.stop(t + 0.08);
        }
    }

    /**
     * 轻点音效
     */
    function playTap() {
        var ctx = _ensureCtx();
        if (!ctx) return;
        var now = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    return {
        init: init,
        playWoodHit: playWoodHit,
        playSuccess: playSuccess,
        playBlockDrop: playBlockDrop,
        playTap: playTap
    };
})();
