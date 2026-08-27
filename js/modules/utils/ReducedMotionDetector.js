/**
 * =============================================================================
 * REDUCED MOTION DETECTOR - Accessibility Support
 * =============================================================================
 */

import { EventEmitter } from './EventEmitter.js';

export class ReducedMotionDetector extends EventEmitter {
  constructor() {
    super();
    
    this.enabled = false;
    this.mediaQuery = null;
    this.init();
  }
  
  init() {
    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.enabled = this.mediaQuery.matches;
    
    // Listen for changes
    this.mediaQuery.addEventListener('change', this.handleChange.bind(this));
    
    // Also check for user preference via localStorage
    const userPref = localStorage.getItem('qf-reduced-motion');
    if (userPref !== null) {
      this.enabled = userPref === 'true';
    }
  }
  
  handleChange(event) {
    this.enabled = event.matches;
    this.emit('change', { enabled: this.enabled });
  }
  
  /**
   * Allow user to toggle reduced motion manually
   */
  setUserPreference(enabled) {
    this.enabled = enabled;
    localStorage.setItem('qf-reduced-motion', enabled.toString());
    this.emit('change', { enabled: this.enabled, userTriggered: true });
  }
  
  /**
   * Subscribe to changes
   */
  onChange(callback) {
    this.on('change', callback);
    return () => this.off('change', callback);
  }
  
  destroy() {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleChange.bind(this));
    }
    this.removeAllListeners();
  }
} 
