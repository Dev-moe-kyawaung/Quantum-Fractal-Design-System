/**
 * =============================================================================
 * ANIMATION REGISTRY - Centralized GSAP Animation Management
 * =============================================================================
 * Registers, manages, and plays reusable animation patterns across all pages
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class AnimationRegistry extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      reducedMotion: config.reducedMotion || false,
      eventBus: config.eventBus,
      defaultDuration: 0.8,
      defaultEase: 'expo.out',
    };
    
    this.animations = new Map();
    this.activeAnimations = new Map();
    this.timelines = new Map();
    
    // Register built-in animations
    this.registerBuiltins();
  }
  
  /**
   * Register built-in animation patterns
   */
  registerBuiltins() {
    // Fade in up
    this.register('fade-up', (el, options = {}) => {
      return gsap.fromTo(el,
        { y: options.distance || 40, opacity: 0 },
        { 
          y: 0, 
          opacity: 1,
          duration: options.duration || this.config.defaultDuration,
          ease: options.ease || this.config.defaultEase,
          delay: options.delay || 0,
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Fade in down
    this.register('fade-down', (el, options = {}) => {
      return gsap.fromTo(el,
        { y: -(options.distance || 40), opacity: 0 },
        { 
          y: 0, 
          opacity: 1,
          duration: options.duration || this.config.defaultDuration,
          ease: options.ease || this.config.defaultEase,
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Scale in
    this.register('scale-in', (el, options = {}) => {
      return gsap.fromTo(el,
        { scale: options.fromScale || 0.9, opacity: 0 },
        { 
          scale: 1, 
          opacity: 1,
          duration: options.duration || 0.6,
          ease: options.ease || 'back.out(1.2)',
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Slide from left
    this.register('slide-left', (el, options = {}) => {
      return gsap.fromTo(el,
        { x: -(options.distance || 60), opacity: 0 },
        { 
          x: 0, 
          opacity: 1,
          duration: options.duration || this.config.defaultDuration,
          ease: options.ease || this.config.defaultEase,
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Slide from right
    this.register('slide-right', (el, options = {}) => {
      return gsap.fromTo(el,
        { x: options.distance || 60, opacity: 0 },
        { 
          x: 0, 
          opacity: 1,
          duration: options.duration || this.config.defaultDuration,
          ease: options.ease || this.config.defaultEase,
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Stagger children
    this.register('stagger', (container, options = {}) => {
      const selector = options.selector || '[data-qf-stagger], > *';
      const children = container.querySelectorAll(selector);
      if (!children.length) return gsap.timeline();
      
      return gsap.fromTo(children,
        { y: options.distance || 30, opacity: 0 },
        { 
          y: 0, 
          opacity: 1,
          duration: options.duration || 0.6,
          ease: options.ease || this.config.defaultEase,
          stagger: {
            each: options.stagger || 0.08,
            from: options.staggerFrom || 'start',
            grid: options.staggerGrid || 'auto',
          },
          scrollTrigger: this.createScrollTrigger(container, options),
        }
      );
    });
    
    // Text reveal (character/word/line)
    this.register('text-reveal', (el, options = {}) => {
      const type = options.splitType || 'chars';
      const split = new SplitText(el, { type, linesClass: 'qf-split-line' });
      const targets = type === 'chars' ? split.chars : type === 'words' ? split.words : split.lines;
      
      return gsap.fromTo(targets,
        { y: options.distance || '100%', opacity: 0, rotateX: options.rotateX || 0 },
        { 
          y: 0, 
          opacity: 1,
          rotateX: 0,
          duration: options.duration || 0.6,
          ease: options.ease || 'expo.out',
          stagger: {
            each: options.stagger || (type === 'chars' ? 0.02 : 0.08),
            from: options.staggerFrom || 'start',
          },
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Counter animation
    this.register('counter', (el, options = {}) => {
      const target = { value: options.from || 0 };
      const endValue = options.to || parseFloat(el.textContent) || 100;
      const decimals = options.decimals || 0;
      const prefix = options.prefix || '';
      const suffix = options.suffix || '';
      const formatter = options.formatter || ((v) => v.toFixed(decimals));
      
      return gsap.to(target, {
        value: endValue,
        duration: options.duration || 1.5,
        ease: options.ease || 'expo.out',
        scrollTrigger: this.createScrollTrigger(el, options),
        onUpdate: () => {
          el.textContent = prefix + formatter(target.value) + suffix;
        },
        onComplete: () => {
          el.textContent = prefix + formatter(endValue) + suffix;
        },
      });
    });
    
    // Progress bar
    this.register('progress', (el, options = {}) => {
      const progress = el.querySelector('[data-qf-progress-bar]') || el;
      const target = options.to || parseFloat(progress.dataset.qfProgress) || 100;
      
      return gsap.fromTo(progress,
        { scaleX: 0, transformOrigin: 'left center' },
        { 
          scaleX: target / 100,
          duration: options.duration || 1.2,
          ease: options.ease || 'expo.out',
          scrollTrigger: this.createScrollTrigger(el, options),
        }
      );
    });
    
    // Morphing blob
    this.register('morph-blob', (el, options = {}) => {
      const paths = options.paths || [];
      if (!paths.length) return gsap.timeline();
      
      const tl = gsap.timeline({ repeat: -1, yoyo: true, ...options.timeline });
      paths.forEach((path, i) => {
        tl.to(el, {
          morphSVG: path,
          duration: options.duration || 3,
          ease: options.ease || 'power2.inOut',
        }, i === 0 ? 0 : '+=0');
      });
      return tl;
    });
    
    // Floating animation
    this.register('float', (el, options = {}) => {
      return gsap.to(el, {
        y: options.distance || -20,
        duration: options.duration || 3,
        ease: options.ease || 'sine.inOut',
        yoyo: true,
        repeat: -1,
        ...options,
      });
    });
    
    // Pulse glow
    this.register('pulse-glow', (el, options = {}) => {
      return gsap.to(el, {
        boxShadow: options.glow || '0 0 30px rgba(0, 245, 212, 0.5)',
        duration: options.duration || 2,
        ease: options.ease || 'sine.inOut',
        yoyo: true,
        repeat: -1,
        ...options,
      });
    });
    
    // Rotate continuous
    this.register('rotate', (el, options = {}) => {
      return gsap.to(el, {
        rotation: options.degrees || 360,
        duration: options.duration || 20,
        ease: 'none',
        repeat: -1,
        ...options,
      });
    });
    
    // Orbit motion
    this.register('orbit', (el, options = {}) => {
      const radius = options.radius || 100;
      const duration = options.duration || 10;
      const center = { x: 0, y: 0 };
      
      return gsap.to(el, {
        motionPath: {
          path: [
          radius, y: 0 -radius ],
          curv, autoRotate: radius: duration,
          duration',
 'none',
        ease: -1,
      -1,
    },
  
    // Clip path reveal
    this.registerTrigger configuration(el,clip-reveal', const options = {}) => { innerClip = options || { innerWidth: { const { x:  end: y: 0 },
, innerWidthinnerHeight  },
      innerWidthWidthHeight },   // Build : innerWidth
      { paths,
        innerWidth,  y: 0,
      }
    : innerWidthWidth, innerWidth,
        duration: duration,
        0,
 ease: 'none',
        'none',
        repeat: repeat: -1,
        -1
      }
  
    //   */
   register(name, factory) {
    if (this.animations.has(name)) {
      this.warn(`Animation "${name}" already registered, overwriting`);
    }
    
    this.animations.set(name, {
      factory,
      name,
      registeredAt: Date.now(),
    });
    
    this.emit('registered', { name });
  }
  
  /**
   * Play registered animation
   */
  play(name, element, options = {}) {
    if (!element) {
      this.error(`Cannot play animation "${name}": no element provided`);
      return null;
    }
    
    const animation = this.animations.get(name);
    if (!animation) {
      this.error(`Animation "${name}" not found`);
      return null;
    }
    
    // Handle reduced motion
    if (this.config.reducedMotion) {
      options.duration = 0;
      options.scrollTrigger = false;
    }
    
    // Create unique ID for this animation instance
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const animationInstance = animation.factory(element, options);
      
      // Store reference
      this.activeAnimations.set(id, {
        name,
        element,
        instance: animationInstance,
        options,
        createdAt: Date.now(),
      });
      
      // Cleanup on complete
      if (animationInstance && animationInstance.eventCallback) {
        animationInstance.eventCallback('onComplete', () => {
          this.activeAnimations.delete(id);
        });
      }
      
      this.emit('play', { id, name, element, options });
      return animationInstance;
      
    } catch (error) {
      this.error(`Failed to play animation "${name}":`, error);
      return null;
    }
  }
  
  /**
   * Kill animation by ID
   */
  kill(id) {
    const anim = this.activeAnimations.get(id);
    if (anim && anim.instance) {
      anim.instance.kill();
      this.activeAnimations.delete(id);
      this.emit('kill', { id });
    }
  }
  
  /**
   * Kill all animations for an element
   */
  killElement(element) {
    const toKill = [];
    this.activeAnimations.forEach((anim, id) => {
      if (anim.element === element || element.contains(anim.element)) {
        toKill.push(id);
      }
    });
    toKill.forEach((id) => this.kill(id));
  }
  
  /**
   * Kill all active animations
   */
  killAll() {
    this.activeAnimations.forEach((anim, id) => {
      if (anim.instance) anim.instance.kill();
    });
    this.activeAnimations.clear();
    this.emit('kill-all');
  }
  
  /**
   * Create ScrollTrigger config
   */
  createScrollTrigger(element, options) {
    if (options.scrollTrigger === false) return null;
    
    return {
      trigger: options.trigger || element,
      start: options.start || 'top 85%',
      end: options.end || 'bottom 20%',
      toggleActions: options.toggleActions || 'play none none reverse',
      scrub: options.scrub || false,
      pin: options.pin || false,
      pinSpacing: options.pinSpacing !== false,
      markers: options.markers || false,
      onEnter: () => this.emit('scroll-enter', { element }),
      onLeave: () => this.emit('scroll-leave', { element }),
      onEnterBack: () => this.emit('scroll-enter-back', { element }),
      onLeaveBack: () => this.emit('scroll-leave-back', { element }),
      ...options.scrollTrigger,
    };
  }
  
  /**
   * Create a timeline with registered animations
   */
  createTimeline(name, steps) {
    const tl = gsap.timeline({ ...steps.timeline });
    this.timelines.set(name, tl);
    
    steps.animations.forEach((step) => {
      const { name: animName, element, options = {}, position } = step;
      const anim = this.play(animName, element, options);
      if (anim) {
        tl.add(anim, position);
      }
    });
    
    return tl;
  }
  
  /**
   * Get animation info
   */
  get(name) {
    return this.animations.get(name);
  }
  
  /**
   * List all registered animations
   */
  list() {
    return Array.from(this.animations.keys());
  }
  
  /**
   * Handle reduced motion change
   */
  onReducedMotionChange(enabled) {
    this.config.reducedMotion = enabled;
    if (enabled) {
      // Speed up all running animations
      this.activeAnimations.forEach((anim) => {
        if (anim.instance && anim.instance.timeScale) {
          anim.instance.timeScale(100);
        }
      });
    }
  }
  
  /**
   * Destroy
   */
  destroy() {
    this.killAll();
    this.animations.clear();
    this.timelines.clear();
    this.removeAllListeners();
  }
}
