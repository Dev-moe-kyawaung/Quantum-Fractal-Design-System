/**
 * =============================================================================
 * PERFORMANCE MONITOR - Real-time FPS & Memory Tracking
 * =============================================================================
 */

import { EventEmitter } from './EventEmitter.js';

export class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      targetFPS: config.targetFPS || 60,
      sampleSize: config.sampleSize || 60,
      onBudgetExceeded: config.onBudgetExceeded,
    };
    
    this.running = false;
    this.paused = false;
    this.frameCount = 0;
    this.lastTime = 0;
    this.fpsHistory = [];
    this.frameTimeHistory = [];
    this.memoryHistory = [];
    this.animationId = null;
    
    this.metrics = {
      fps: 60,
      avgFPS: 60,
      minFPS: 60,
      maxFPS: 60,
      frameTime: 16.67,
      memoryUsed: 0,
      memoryTotal: 0,
      particleCount: 0,
    };
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }
  
  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
  
  setPaused(paused) {
    this.paused = paused;
  }
  
  tick() {
    if (!this.running) return;
    
    if (!this.paused) {
      const now = performance.now();
      const delta = now - this.lastTime;
      
      this.frameCount++;
      this.metrics.frameTime = delta;
      this.frameTimeHistory.push(delta);
      if (this.frameTimeHistory.length > this.config.sampleSize) {
        this.frameTimeHistory.shift();
      }
      
      // Calculate FPS every second
      if (now - this.lastFPSUpdate >= 1000) {
        this.metrics.fps = Math.round(this.frameCount * 1000 / (now - this.lastFPSUpdate));
        this.fpsHistory.push(this.metrics.fps);
        if (this.fpsHistory.length > this.config.sampleSize) {
          this.fpsHistory.shift();
        }
        
        this.updateDerivedMetrics();
        this.checkBudget();
        this.emit('metrics', { ...this.metrics });
        
        this.frameCount = 0;
        this.lastFPSUpdate = now;
      }
      
      this.lastTime = now;
      
      // Memory check (every 5 seconds)
      if (now - this.lastMemoryCheck >= 5000) {
        this.updateMemoryMetrics();
        this.lastMemoryCheck = now;
      }
    }
    
    this.animationId = requestAnimationFrame(this.tick.bind(this));
  }
  
  updateDerivedMetrics() {
    if (this.fpsHistory.length === 0) return;
    
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    this.metrics.avgFPS = Math.round(sum / this.fpsHistory.length);
    this.metrics.minFPS = Math.min(...this.fpsHistory);
    this.metrics.maxFPS = Math.max(...this.fpsHistory);
  }
  
  updateMemoryMetrics() {
    if (performance.memory) {
      this.metrics.memoryUsed = Math.round(performance.memory.usedJSHeapSize / 1048576);
      this.metrics.memoryTotal = Math.round(performance.memory.totalJSHeapSize / 1048576);
      this.memoryHistory.push(this.metrics.memoryUsed);
      if (this.memoryHistory.length > this.config.sampleSize) {
        this.memoryHistory.shift();
      }
    }
  }
  
  checkBudget() {
    if (this.metrics.fps < this.config.targetFPS * 0.7) {
      this.emit('budget-warning', { 
        fps: this.metrics.fps, 
        target: this.config.targetFPS,
        severity: this.metrics.fps < this.config.targetFPS * 0.5 ? 'critical' : 'warning',
      });
      
      if (this.config.onBudgetExceeded) {
        this.config.onBudgetExceeded(this.metrics);
      }
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  getHistory() {
    return {
      fps: [...this.fpsHistory],
      frameTime: [...this.frameTimeHistory],
      memory: [...this.memoryHistory],
    };
  }
  
  destroy() {
    this.stop();
    this.removeAllListeners();
  }
}
