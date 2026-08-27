/**
 * =============================================================================
 * QUANTUM-FRACTAL DESIGN SYSTEM - MAIN ENTRY POINT
 * =============================================================================
 * Initializes all core systems: GSAP animations, particle simulations,
 * global event listeners, navigation, page transitions, and performance monitoring.
 * 
 * @version 1.0.0
 * @author Quantum-Fractal Design System
 * =============================================================================
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';
import { ParticleSystem } from './modules/particles/ParticleSystem.js';
import { NavigationController } from './modules/navigation/NavigationController.js';
import { PageTransitionManager } from './modules/animations/PageTransitionManager.js';
import { AnimationRegistry } from './modules/animations/AnimationRegistry.js';
import { PerformanceMonitor } from './modules/utils/PerformanceMonitor.js';
import { GlobalEventBus } from './modules/utils/GlobalEventBus.js';
import { IntersectionObserverManager } from './modules/utils/IntersectionObserverManager.js';
import { MagneticController } from './modules/animations/MagneticController.js';
import { ParallaxController } from './modules/animations/ParallaxController.js';
import { CursorEffects } from './modules/animations/CursorEffects.js';
import { ReducedMotionDetector } from './modules/utils/ReducedMotionDetector.js';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

/**
 * QuantumFractalApp - Main application controller
 * Manages lifecycle of all subsystems across 30-page website
 */
class QuantumFractalApp {
  constructor(config = {}) {
    this.config = {
      // Performance settings
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      targetFPS: config.targetFPS ?? 60,
      particleBudget: config.particleBudget ?? 'auto', // 'auto', 'low', 'medium', 'high'
      
      // Feature flags
      enableParticles: config.enableParticles ?? true,
      enableParallax: config.enableParallax ?? true,
      enableMagnetic: config.enableMagnetic ?? true,
      enableCursorEffects: config.enableCursorEffects ?? true,
      enablePageTransitions: config.enablePageTransitions ?? true,
      enableScrollSmoother: config.enableScrollSmoother ?? true,
      
      // Debug
      debug: config.debug ?? false,
      
      // Page-specific config
      pageId: config.pageId || document.body.dataset.pageId || 'unknown',
      pageType: config.pageType || document.body.dataset.pageType || 'generic',
    };

    // Core systems
    this.systems = new Map();
    this.initialized = false;
    this.destroyed = false;
    
    // Event bus for cross-module communication
    this.eventBus = new GlobalEventBus();
    
    // Performance monitor
    this.performance = null;
    
    // Reduced motion detection
    this.reducedMotion = new ReducedMotionDetector();
    
    // Bind methods
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleResize = this.handleResize.bind(this);
    
    // Auto-initialize if DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.init);
    } else {
      this.init();
    }
  }

  /**
   * Initialize all subsystems
   */
  async init() {
    if (this.initialized) return;
    
    this.log('Initializing Quantum-Fractal Design System...');
    const startTime = performance.now();
    
    try {
      // 1. Initialize performance monitoring first
      if (this.config.enablePerformanceMonitoring) {
        this.performance = new PerformanceMonitor({
          targetFPS: this.config.targetFPS,
          onBudgetExceeded: this.handlePerformanceBudgetExceeded.bind(this),
        });
        this.systems.set('performance', this.performance);
      }
      
      // 2. Initialize core utilities
      this.intersectionObserver = new IntersectionObserverManager({
        rootMargin: '50px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      });
      this.systems.set('intersectionObserver', this.intersectionObserver);
      
      // 3. Initialize animation registry
      this.animationRegistry = new AnimationRegistry({
        reducedMotion: this.reducedMotion.enabled,
        eventBus: this.eventBus,
      });
      this.systems.set('animationRegistry', this.animationRegistry);
      
      // 4. Initialize ScrollSmoother (if enabled and not reduced motion)
      if (this.config.enableScrollSmoother && !this.reducedMotion.enabled) {
        this.scrollSmoother = ScrollSmoother.create({
          wrapper: '#qf-smooth-wrapper',
          content: '#qf-smooth-content',
          smooth: 1.2,
          effects: true,
          normalizeScroll: true,
          ignoreMobileResize: true,
          onUpdate: (self) => this.eventBus.emit('scroll:update', { scrollTop: self.scrollTop, progress: self.progress }),
        });
        this.systems.set('scrollSmoother', this.scrollSmoother);
      }
      
      // 5. Initialize Navigation Controller
      this.navigation = new NavigationController({
        eventBus: this.eventBus,
        reducedMotion: this.reducedMotion.enabled,
        pageTransitionManager: null, // Will be set after creation
      });
      this.systems.set('navigation', this.navigation);
      
      // 6. Initialize Page Transition Manager
      this.pageTransitions = new PageTransitionManager({
        eventBus: this.eventBus,
        reducedMotion: this.reducedMotion.enabled,
        navigation: this.navigation,
      });
      this.systems.set('pageTransitions', this.pageTransitions);
      
      // Link navigation to page transitions
      this.navigation.pageTransitionManager = this.pageTransitions;
      
      // 7. Initialize Particle System (perfParticleSystem({
        container: '#qf-particles-canvas',
        particleBudget: this.config.particleBudget,
        reducedMotion: this.reducedMotion.enabled,
        eventBus: this.eventBus,
        pageType: this.config.pageType,
      });
      this.systems.set('particles', this.particleSystem);
      
      // 8. Initialize Parallax Controller
      if (this.config.enableParallax && !this.reducedMotion.enabled) {
        this.parallax = new ParallaxController({
          eventBus: this.eventBus,
          scrollSmoother: this.scrollSmoother,
        });
        this.systems.set('parallax', this.parallax);
      }
      
      // 9. Initialize Magnetic Controller
      if (this.config.enableMagnetic && !this.reducedMotion.enabled) {
        this.magnetic = new MagneticController({
          eventBus: this.eventBus,
        });
        this.systems.set('magnetic', this.magnetic);
      }
      
      // 10. Initialize Cursor Effects
      if (this.config.enableCursorEffects && !this.reducedMotion.enabled) {
        this.cursor = new CursorEffects({
          eventBus: this.eventBus,
        });
        this.systems.set('cursor', this.cursor);
      }
      
      // 11. Register global event listeners
      this.registerGlobalListeners();
      
      // 12. Initialize page-specific animations
      this.initializePageAnimations();
      
      // 13. Mark as initialized
      this.initialized = true;
      
      const initTime = performance.now() - startTime;
      this.log(`Initialization complete in ${initTime.toFixed(2)}ms`);
      
      // Emit ready event
      this.eventBus.emit('qf:ready', {
        pageId: this.config.pageId,
        pageType: this.config.pageType,
        systems: Array.from(this.systems.keys()),
        initTime,
      });
      
      // Start performance monitoring
      if (this.performance) {
        this.performance.start();
      }
      
    } catch (error) {
      this.error('Initialization failed:', error);
      this.eventBus.emit('qf:error', { error, phase: 'initialization' });
    }
  }

  /**
   * Register global event listeners
   */
  registerGlobalListeners() {
    // Visibility change - pause/resume animations
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Resize handling
    window.addEventListener('resize', this.handleResize, { passive: true });
    
    // Reduced motion change
    this.reducedMotion.onChange((enabled) => {
      this.eventBus.emit('qf:reduced-motion', { enabled });
      this.systems.forEach((system) => {
        if (system.onReducedMotionChange) {
          system.onReducedMotionChange(enabled);
        }
      });
    });
    
    // Global keyboard navigation
    document.addEventListener('keydown', (e) => {
      this.eventBus.emit('qf:keydown', { event: e });
      
      // Escape key - close modals, menus
      if (e.key === 'Escape') {
        this.eventBus.emit('qf:escape');
        this.navigation?.closeMobileMenu();
      }
    });
    
    // Global click handler for delegation
    document.addEventListener('click', (e) => {
      this.eventBus.emit('qf:click', { event: e, target: e.target });
    }, { passive: true });
    
    // Scroll events (if not using ScrollSmoother)
    if (!this.scrollSmoother) {
      window.addEventListener('scroll', () => {
        this.eventBus.emit('scroll:update', { 
          scrollTop: window.scrollY, 
          progress: window.scrollY / (document.body.scrollHeight - window.innerHeight) 
        });
      }, { passive: true });
    }
    
    // Page lifecycle
    window.addEventListener('beforeunload', () => this.destroy());
  }

  /**
   * Initialize page-specific animations
   */
  initializePageAnimations() {
    // Register common animation patterns
    this.animationRegistry.register('reveal-up', (element, options = {}) => {
      return gsap.fromTo(element, 
        { y: 60, opacity: 0 },
        { 
          y: 0, 
          opacity: 1, 
          duration: options.duration || 0.8,
          ease: options.ease || 'expo.out',
          delay: options.delay || 0,
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
            ...options.scrollTrigger,
          },
        }
      );
    });
    
    this.animationRegistry.register('reveal-scale', (element, options = {}) => {
      return gsap.fromTo(element,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: options.duration || 0.6,
          ease: options.ease || 'back.out(1.2)',
          scrollTrigger: {
            trigger: element,
            start: 'top 90%',
            toggleActions: 'play none none reverse',
            ...options.scrollTrigger,
          },
        }
      );
    });
    
    this.animationRegistry.register('stagger-children', (container, options = {}) => {
      const children = container.querySelectorAll('[data-qf-stagger]');
      return gsap.fromTo(children,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: options.duration || 0.6,
          ease: options.ease || 'expo.out',
          stagger: options.stagger || 0.08,
          scrollTrigger: {
            trigger: container,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
            ...options.scrollTrigger,
          },
        }
      );
    });
    
    this.animationRegistry.register('text-reveal', (element, options = {}) => {
      const split = new SplitText(element, { type: 'lines, wordscharsgsap.fromTo(split.chars),
        { opacity: 100% },
        { opacity: 1, 
          duration: options.durationstagger: options.stagger04,
          ease: options.ease || 'expo.out',
          stagger: 0.02,
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
            ...options.scrollTrigger,
          },
        }
      );
    });
    
    // Auto-initialize elements with data-qf-animate attribute
    document.querySelectorAll('[data-qf-animate]').forEach((element) => {
      const animationType = element.dataset.qfAnimate;
      const options = JSON.parse(element.dataset.qfOptions || '{}');
      this.animationRegistry.play(animationType, element, options);
    });
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    const hidden = document.hidden;
    this.eventBus.emit('qf:visibility', { hidden });
    
    this.systems.forEach((system) => {
      if (system.onVisibilityChange) {
        system.onVisibilityChange(hidden);
      }
    });
    
    if (this.performance) {
      this.performance.setPaused(hidden);
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    this.eventBus.emit('qf:resize', { 
      width: window.innerWidth, 
      height: window.innerHeight 
    });
    
    // Debounced refresh for ScrollTrigger
    gsap.delayedCall(0.1, () => {
      ScrollTrigger.refresh();
    });
  }

  /**
   * Handle performance budget exceeded
   */
  handlePerformanceBudgetExceeded(metrics) {
    this.warn('Performance budget exceeded:', metrics);
    
    // Auto-reduce particle count
    if (this.particleSystem && metrics.fps < this.config.targetFPS * 0.7) {
      this.particleSystem.reduceBudget();
    }
    
    // Disable non-critical effects
    if (metrics.fps < this.config.targetFPS * 0.5) {
      this.parallax?.setEnabled(false);
      this.magnetic?.setEnabled(false);
      this.cursor?.setEnabled(false);
    }
  }

  /**
   * Public API: Get system instance
   */
  getSystem(name) {
    return this.systems.get(name);
  }

  /**
   * Public API: Register custom animation
   */
  registerAnimation(name, fn) {
    this.animationRegistry.register(name, fn);
  }

  /**
   * Public API: Play animation
   */
  playAnimation(name, element, options) {
    return this.animationRegistry.play(name, element, options);
  }

  /**
   * Public API: Navigate to page with transition
   */
  navigateTo(url, options = {}) {
    return this.pageTransitions.navigateTo(url, options);
  }

  /**
   * Destroy all systems
   */
  destroy() {
    if (this.destroyed) return;
    
    this.log('Destroying Quantum-Fractal Design System...');
    
    // Remove global listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('resize', this.handleResize);
    
    // Destroy all systems
    this.systems.forEach((system, name) => {
      if (system.destroy) {
        try {
          system.destroy();
        } catch (e) {
          this.warnname}:`, e);
        }
      }
    });
    
    // Clean up GSAP
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.killAll();
    
    this
    this.initialized = false;
    this.destroyed = true;
    
    this.log('Destruction complete');
  }

  // Logging utilitieslog(...args) {
    if (this.config.debug) console.log(`[QF]`c('%c', 'color: #00f5d4');  
  warn(...args) {
    console.warn(`[QF] WARN]', 'color: #ffd700');
  }
  
  error(...args) {
    console.error(`[QF] ERROR`, ...args) ;[module use as Module/export (typeof module windowtypeof window.QuantumFractalApp ===QuantumFractalApp
      : export default QuantumFractalApp;
    }
  })({
  .init() ifif if (typeof window !== 'undefined'undefined) ume = {
    getInstance    return new QuantumFractalApp(config);
        } 
 
```init() {
    'undefined' && window.QuantumFractalByIdFractalApp) ) {
      window.QuantumFractalApp App = new .init({ 
      autoInit: new Quantum alApp(config).init()FractalApp(config)} init();;
  }
}
