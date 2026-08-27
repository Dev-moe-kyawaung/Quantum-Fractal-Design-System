/**
 * =============================================================================
 * GLOBAL EVENT BUS - Cross-Module Communication
 * =============================================================================
 */

import { EventEmitter } from './EventEmitter.js';

class GlobalEventBus extends EventEmitter {
  constructor() {
    super();
    this.history = [];
    this.maxHistory = 100;
  }
  
  emit(event, data) {
    // Record in history for debugging
    this.history.push({ event, data, timestamp: performance.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    super.emit(event, data);
  }
  
  getHistory() {
    return [...this.history];
  }
  
  clearHistory() {
    this.history = [];
  }
}

// Singleton instance
export const globalEventBus = new GlobalEventBus();
export default globalEventBus; 
