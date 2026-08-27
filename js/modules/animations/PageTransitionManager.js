/**
 * =============================================================================
 * PAGE TRANSITION MANAGER - Smooth Page Transitions
 * =============================================================================
 * Handles seamless page transitions with GSAP animations across 30-page site
 * =============================================================================
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

export class PageTransitionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      eventBus: config.eventBus,
      reducedMotion: config.reducedMotion || false,
      navigation: config.navigation,
      transitionDuration: config.transitionDuration || 0.6,
      overlaySelector: config.overlaySelector || '.qf-page-transition',
    };
    
    this.overlay = null;
    this.layers = [];
    this.isTransitioning = false;
    this.currentPage = window.location.pathname;
    this.pendingNavigation = null;
    
    this.init();
  }
  
  init() {
    // Create or find transition overlay
    this.overlay = document.querySelector(this.config.overlaySelector);
    if (!this.overlay) {
      this.createOverlay();
    }
    
    this.layers = Array.from(this.overlay.querySelectorAll('.qf-page-transition__layer'));
    
    // Intercept navigation
    this.bindNavigation();
    
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }
  
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'qf-page-transition';
    this.overlay.innerHTML = `
      <div class="qf-page-transition__layer"></div>
      <div class="qf-page-transition__layer"></div>
      <div class="qf-page-transition__layer"></div>
    `;
    document.body.appendChild(this.overlay);
    this.layers = Array.from(this.overlay.querySelectorAll('.qf-page-transition__layer'));
  }
  
  bindNavigation() {
    // Handle all internal links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      const isExternal = href.startsWith('http') || href.startsWith('//');
      const isAnchor = href.startsWith('#');
      const isMailto = href.startsWith('mailto:');
      const isTel = href.startsWith('tel:');
      const hasTarget = link.hasAttribute('target');
      const isDownload = link.hasAttribute('download');
      
      // Skip if external, anchor, mailto, tel, target=_blank, or download
      if (isExternal || isAnchor || isMailto || isTel || hasTarget || isDownload) {
        return;
      }
      
      // Skip if modifier keys pressed
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      
      e.preventDefault();
      this.navigateTo(href);
    });
  }
  
  /**
   * Navigate to URL with transition
   */
  async navigateTo(url, options = {}) {
    if (this.isTransitioning) return;
    if (url === window.location.pathname + window.location.search) return;
    
    this.isTransitioning = true;
    this.pendingNavigation = url;
    
    this.emit('transition:start', { from: this.currentPage, to: url });
    this.config.eventBus?.emit('qf:page-transition:start', { from: this.currentPage, to: url });
    
    // Notify navigation controller
    this.config.navigation?.setTransitioning(true);
    
    try {
      // Play exit animation
      await this.playExitTransition();
      
      // Update URL
      window.history.pushState({ page: url }, '', url);
      this.currentPage = url;
      
      // Fetch new page content (if using AJAX)
      if (options.ajax !== false) {
        await this.fetchPageContent(url);
      } else {
        // Full page reload fallback
        window.location.href = url;
        return;
      }
      
      // Play enter animation
      await this.playEnterTransition();
      
      // Update navigation
      this.config.navigation?.updateForPage({ url });
      
      // Re-initialize page-specific scripts
      this.reinitializePageScripts();
      
      this.emit('transition:complete', { page: url });
      this.config.eventBus?.emit('qf:page-transition:complete', { page: url });
      
    } catch (error) {
      this.error('Page transition failed:', error);
      // Fallback to hard navigation
      window.location.href = url;
    } finally {
      this.isTransitioning = false;
      this.pendingNavigation = null;
      this.config.navigation?.setTransitioning(false);
    }
  }
  
  /**
   * Play exit transition animation
   */
  playExitTransition() {
    return new Promise((resolve) => {
      if (this.config.reducedMotion) {
        resolve();
        return;
      }
      
      this.overlay.classList.add('qf-page-transition--active');
      this.overlay.classList.remove('qf-page-transition--exit');
      
      // Stagger layers
      const tl = gsap.timeline({ onComplete: resolve });
      
      this.layers.forEach((layer, i) => {
        tl.to(layer, {
          scaleY: 1,
          transformOrigin: 'top center',
          duration: this.config.transitionDuration / 2,
          ease: 'expo.inOut',
        }, i * 0.05);
      });
    });
  }
  
  /**
   * Play enter transition animation
   */
  playEnterTransition() {
    return new Promise((resolve) => {
      if (this.config.reducedMotion) {
        this.overlay.classList.remove('qf-page-transition--active');
        resolve();
        return;
      }
      
      this.overlay.classList.add('qf-page-transition--exit');
      
      const tl = gsap.timeline({ onComplete: () => {
        this.overlay.classList.remove('qf-page-transition--active', 'qf-page-transition--exit');
        resolve();
      }});
      
      // Reverse stagger
      [...this.layers].reverse().forEach((layer, i) => {
        tl.to(layer, {
          scaleY: 0,
          transformOrigin: 'bottom center',
          duration: this.config.transitionDuration / 2,
          ease: 'expo.inOut',
        }, i * 0.05);
      });
    });
  }
  
  /**
   * Fetch page content via AJAX
   */
  async fetchPageContent(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html',
        },
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract main content
      const newMain = doc.querySelector('main, #main, [data-qf-page-content]');
      const currentMain = document.querySelector('main, #main, [data-qf-page-content]');
      
      if (newMain && currentMain) {
        // Animate out current content
        await this.animateContentOut(currentMain);
        
        // Replace content
        currentMain.innerHTML = newMain.innerHTML;
        currentMain.dataset.pageId = newMain.dataset.pageId || '';
        currentMain.dataset.pageType = newMain.dataset.pageType || '';
        
        // Update page metadata
        this.updatePageMetadata(doc);
        
        // Animate in new content
        await this.animateContentIn(currentMain);
      }
      
      // Update document title
      document.title = doc.title;
      
      // Scroll to top
      window.scrollTo(0, 0);
      
    } catch (error) {
      this.error('Failed to fetch page content:', error);
      throw error;
    }
  }
  
  /**
   * Animate content out
   */
  animateContentOut(element) {
    return new Promise((resolve) => {
      if (this.config.reducedMotion) {
        resolve();
        return;
      }
      
      gsap.to(element, {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'expo.in',
        onComplete: resolve,
      });
    });
  }
  
  /**
   * Animate content in
   */
  animateContentIn(element) {
    return new Promise((resolve) => {
      if (this.config.reducedMotion) {
        element.style.opacity = 1;
        element.style.transform = 'none';
        resolve();
        return;
      }
      
      gsap.fromTo(element,
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.5, 
          ease: 'expo.out',
          onComplete: resolve,
        }
      );
    });
  }
  
  /**
   * Update page metadata (title, meta tags, etc.)
   */
  updatePageMetadata(doc) {
    // Update title
    const newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.textContent;
    
    // Update meta tags
    const metaSelectors = [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[name="twitter:card"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]',
    ];
    
    metaSelectors.forEach((selector) => {
      const newMeta = doc.querySelector(selector);
      const currentMeta = document.querySelector(selector);
      if (newMeta && currentMeta) {
        currentMeta.setAttribute('content', newMeta.getAttribute('content'));
      } else if (newMeta && !currentMeta) {
        document.head.appendChild(newMeta.cloneNode(true));
      }
    });
    
    // Update canonical
    const newCanonical = doc.querySelector('link[rel="canonical"]');
    const currentCanonical = document.querySelector('link[rel="canonical"]');
    if (newCanonical && currentCanonical) {
      currentCanonical.href = newCanonical.href;
    }
  }
  
  /**
   * Reinitialize page-specific scripts
   */
  reinitializePageScripts() {
    // Emit event for modules to reinitialize
    this.config.eventBus?.emit('qf:page:ready', { 
      pageId: document.body.dataset.pageId,
      pageType: document.body.dataset.pageType,
    });
    
    // Re-initialize intersection observers
    this.config.eventBus?.emit('qf:intersection:refresh');
    
    // Refresh ScrollTriggers
    ScrollTrigger.refresh();
    
    // Re-run syntax highlighting if needed
    if (window.Prism) {
      Prism.highlightAll();
    }
    
    // Re-initialize any custom components
    document.querySelectorAll('[data-qf-init]').forEach((el) => {
      const initFn = el.dataset.qfInit;
      if (window[initFn] && typeof window[initFn] === 'function') {
        window[initFn](el);
      }
    });
  }
  
  /**
   * Handle browser back/forward
   */
  handlePopState(event) {
    if (this.isTransitioning) return;
    
    const url = window.location.pathname + window.location.search;
    if (url === this.currentPage) return;
    
    this.navigateTo(url, { ajax: true });
  }
  
  /**
   * Handle reduced motion change
   */
  onReducedMotionChange(enabled) {
    this.config.reducedMotion = enabled;
  }
  
  /**
   * Destroy
   */
  destroy() {
    window.removeEventListener('popstate', this.handlePopState);
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.removeAllListeners();
  }
}
