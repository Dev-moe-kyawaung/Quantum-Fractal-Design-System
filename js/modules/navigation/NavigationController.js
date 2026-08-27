/**
 * =============================================================================
 * NAVIGATION CONTROLLER - Unified Navigation System
 * =============================================================================
 * Handles responsive navigation, mobile menu, scroll effects, and page transitions
 * =============================================================================
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

export class NavigationController extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      eventBus: config.eventBus,
      reducedMotion: config.reducedMotion || false,
      pageTransitionManager: config.pageTransitionManager,
      navSelector: config.navSelector || '.qf-nav',
      mobileBreakpoint: config.mobileBreakpoint || 768,
    };
    
    this.nav = null;
    this.menu = null;
    this.toggle = null;
    this.brand = null;
    this.links = [];
    this.cta = null;
    this.progressBar = null;
    this.isMobile = false;
    this.isOpen = false;
    this.lastScrollY = 0;
    this.scrollDirection = 'up';
    this.ticking = false;
    
    this.init();
  }
  
  init() {
    // Find elements
    this.nav = document.querySelector(this.config.navSelector);
    if (!this.nav) {
      this.warn('Navigation element not found');
      return;
    }
    
    this.menu = this.nav.querySelector('.qf-nav__menu');
    this.toggle = this.nav.querySelector('.qf-nav__toggle');
    this.brand = this.nav.querySelector('.qf-nav__brand');
    this.links = Array.from(this.nav.querySelectorAll('.qf-nav__link'));
    this.cta = this.nav.querySelector('.qf-nav__cta');
    this.progressBar = this.nav.querySelector('.qf-nav__progress');
    
    // Create progress bar if missing
    if (!this.progressBar) {
      this.progressBar = document.createElement('div');
      this.progressBar.className = 'qf-nav__progress';
      this.nav.appendChild(this.progressBar);
    }
    
    // Initial state
    this.updateMobileState();
    this.bindEvents();
    this.setActiveLink();
    
    // Listen for page transitions
    if (this.config.eventBus) {
      this.config.eventBus.on('qf:page-transition:start', () => this.setTransitioning(true));
      this.config.eventBus.on('qf:page-transition:complete', () => this.setTransitioning(false));
    }
  }
  
  bindEvents() {
    // Toggle mobile menu
    if (this.toggle) {
      this.toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMobileMenu();
      });
    }
    
    // Close menu on link click (mobile)
    this.links.forEach((link) => {
      link.addEventListener('click', () => {
        if (this.isMobile && this.isOpen) {
          this.closeMobileMenu();
        }
      });
    });
    
    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.isMobile && !this.nav.contains(e.target)) {
        this.closeMobileMenu();
      }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMobileMenu();
        this.toggle?.focus();
      }
    });
    
    // Scroll handling
    window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    
    // Resize handling
    window.addEventListener('resize', this.debouncedResize.bind(this), { passive: true });
    
    // Page transition clicks
    if (this.config.pageTransitionManager) {
      this.links.forEach((link) => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('http') && !link.hasAttribute('target')) {
            e.preventDefault();
            this.config.pageTransitionManager.navigateTo(href);
          }
        });
      });
    }
  }
  
  /**
   * Handle scroll events
   */
  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    
    requestAnimationFrame(() => {
      const scrollY = window.scrollY || window.pageYOffset;
      const direction = scrollY > this.lastScrollY ? 'down' : 'up';
      
      // Update scroll direction
      if (direction !== this.scrollDirection && Math.abs(scrollY - this.lastScrollY) > 10) {
        this.scrollDirection = direction;
        this.emit('scroll-direction', { direction });
      }
      
      // Scrolled state
      const isScrolled = scrollY > 50;
      this.nav.classList.toggle('qf-nav--scrolled', isScrolled);
      
      // Hide/show on scroll (optional)
      if (this.config.hideOnScrollDown) {
        if (direction === 'down' && scrollY > 200) {
          this.nav.classList.add('qf-nav--hidden');
        } else {
          this.nav.classList.remove('qf-nav--hidden');
        }
      }
      
      // Update progress bar
      this.updateProgressBar();
      
      this.lastScrollY = scrollY;
      this.ticking = false;
    });
  }
  
  /**
   * Update scroll progress bar
   */
  updateProgressBar() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    
    if (this.progressBar) {
      this.progressBar.style.transform = `scaleX(${progress})`;
      this.progressBar.classList.toggle('qf-nav__progress--active', progress > 0);
    }
  }
  
  /**
   * Toggle mobile menu
   */
  toggleMobileMenu() {
    if (this.isOpen) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }
  
  /**
   * Open mobile menu
   */
  openMobileMenu() {
    if (this.isOpen || !this.isMobile) return;
    
    this.isOpen = true;
    this.menu.classList.add('qf-nav__menu--open');
    this.toggle.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    
    // Animate links
    if (!this.config.reducedMotion) {
      gsap.fromTo(this.links,
        { x: 30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.06 }
      );
    }
    
    this.emit('menu:open');
    this.config.eventBus?.emit('qf:nav:menu-open');
  }
  
  /**
   * Close mobile menu
   */
  closeMobileMenu() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.menu.classList.remove('qf-nav__menu--open');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    
    this.emit('menu:close');
    this.config.eventBus?.emit('qf:nav:menu-close');
  }
  
  /**
   * Update mobile state based on viewport
   */
  updateMobileState() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= this.config.mobileBreakpoint;
    
    if (wasMobile !== this.isMobile) {
      if (!this.isMobile && this.isOpen) {
        this.closeMobileMenu();
      }
      this.emit('mobile-state-change', { isMobile: this.isMobile });
    }
    
    // Update toggle visibility
    if (this.toggle) {
      this.toggle.style.display = this.isMobile ? 'flex' : 'none';
    }
    
    // Update menu display
    if (this.menu) {
      this.menu.style.display = this.isMobile ? 'flex' : 'flex';
    }
  }
  
  /**
   * Set active link based on current URL
   */
  setActiveLink() {
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    
    this.links.forEach((link) => {
      const href = link.getAttribute('href');
      const isActive = href === currentPath || 
                       (currentHash && href === currentHash) ||
                       (href !== '/' && currentPath.startsWith(href));
      
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
      link.classList.toggle('qf-nav__link--active', isActive);
    });
  }
  
  /**
   * Set transitioning state
   */
  setTransitioning(isTransitioning) {
    this.nav.classList.toggle('qf-nav--transitioning', isTransitioning);
    if (this.toggle) {
      this.toggle.disabled = isTransitioning;
    }
    this.links.forEach((link) => {
      link.style.pointerEvents = isTransitioning ? 'none' : '';
    });
  }
  
  /**
   * Debounced resize handler
   */
  debouncedResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.updateMobileState();
    }, 100);
  }
  
  /**
   * Update navigation for new page (called after page transition)
   */
  updateForPage(pageData) {
    this.setActiveLink();
    this.closeMobileMenu();
    this.updateProgressBar();
    
    // Update brand if needed
    if (pageData?.brand) {
      this.brand.textContent = pageData.brand;
    }
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
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.debouncedResize);
    clearTimeout(this.resizeTimeout);
    this.removeAllListeners();
  }
}
