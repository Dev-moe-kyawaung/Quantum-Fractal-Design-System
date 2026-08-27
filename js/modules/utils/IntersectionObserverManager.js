/**
 * =============================================================================
 * INTERSECTION OBSERVER MANAGER - Efficient Element Visibility
 * =============================================================================
 */

import { EventEmitter } from './EventEmitter.js';

export class IntersectionObserverManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      root: config.root || null,
      rootMargin: config.rootMargin || '0px',
      threshold: config.threshold || [0, 0.1, 0.25, 0.5, 0.75, 1],
    };
    
    this.observer = null;
    this.observedElements = new Map();
    this.init();
  }
  
  init() {
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
      root: this.config.root,
      rootMargin: this.config.rootMargin,
      threshold: this.config.threshold,
    });
  }
  
  handleIntersection(entries) {
    entries.forEach((entry) => {
      const data = this.observedElements.get(entry.target);
      if (!data) return;
      
      const ratio = entry.intersectionRatio;
      const isIntersecting = entry.isIntersecting;
      
      // Determine which threshold was crossed
      let crossedThreshold = null;
      for (const threshold of this.config.threshold) {
        if (isIntersecting && ratio >= threshold && (data.lastRatio || 0) < threshold) {
          crossedThreshold = threshold;
          break;
        } else if (!isIntersecting && ratio < threshold && (data.lastRatio || 1) >= threshold) {
          crossedThreshold = threshold;
          break;
        }
      }
      
      data.lastRatio = ratio;
      
      // Emit events
      this.emit('intersect', {
        element: entry.target,
        isIntersecting,
        ratio,
        crossedThreshold,
        data: data.callbackData,
      });
      
      // Call element-specific callback
      if (data.callback) {
        data.callback(entry, data.callbackData);
      }
    });
  }
  
  /**
   * Observe an element
   */
  observe(element, callback, callbackData = {}) {
    if (!element) return;
    
    this.observedElements.set(element, {
      callback,
      callbackData,
      lastRatio: 0,
    });
    
    this.observer.observe(element);
  }
  
  /**
   * Unobserve an element
   */
  unobserve(element) {
    if (!element) return;
    this.observer.unobserve(element);
    this.observedElements.delete(element);
  }
  
  /**
   * Observe multiple elements with same callback
   */
  observeAll(selector, callback, callbackData = {}) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => this.observe(el, callback, callbackData));
    return elements.length;
  }
  
  /**
   * Refresh all observations
   */
  refresh() {
    this.observedElements.forEach((data, element) => {
      this.observer.unobserve(element);
      this.observer.observe(element);
    });
  }
  
  destroy() {
    this.observer.disconnect();
    this.observedElements.clear();
    this.removeAllListeners();
  }
}
