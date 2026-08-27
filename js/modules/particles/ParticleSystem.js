/**
 * =============================================================================
 * PARTICLE SYSTEM - Quantum-Fractal Particle Simulation
 * =============================================================================
 * High-performance canvas-based particle system with multiple simulation modes
 * Optimized for 60fps across all 30 pages with automatic quality scaling
 * =============================================================================
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class ParticleSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      container: config.container || '#qf-particles-canvas',
      particleBudget: config.particleBudget || 'auto', // 'auto', 'low', 'medium', 'high', or number
      reducedMotion: config.reducedMotion || false,
      eventBus: config.eventBus,
      pageType: config.pageType || 'generic',
      
      // Simulation parameters
      gravity: config.gravity || 0,
      wind: config.wind || 0,
      attraction: config.attraction || 0,
      repulsion: config.repulsion || 0,
      connections: config.connections || false,
      connectionDistance: config.connectionDistance || 150,
      
      // Visual
      colorPalette: config.colorPalette || 'fractal',
      blendMode: config.blendMode || 'lighter',
      trailLength: config.trailLength || 0,
      
      // Performance
      maxParticles: config.maxParticles || this.getBudgetCount(),
      targetFPS: config.targetFPS || 60,
      updateInterval: config.updateInterval || 16.67, // ~60fps
    };
    
    // State
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.lastTime = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.running = false;
    this.paused = false;
    this.quality = 'high'; // 'high', 'medium', 'low'
    
    // Mouse interaction
    this.mouse = { x: 0, y: 0, radius: 150, active: false };
    
    // Attractors/repellors
    this.forces = [];
    
    // Color palettes
    this.palettes = {
      fractal: [
        { r: 0, g: 245, b: 212 },    // cyan
        { r: 255, g: 0, b: 170 },    // magenta
        { r: 255, g: 215, b: 0 },    // gold
        { r: 170, g: 255, b: 0 },    // lime
        { r: 188, g: 0, b: 255 },    // violet
        { r: 0, g: 136, b: 255 },    // blue
      ],
      quantum: [
        { r: 0, g: 245, b: 212, a: 0.8 },
        { r: 188, g: 0, b: 255, a: 0.7 },
        { r: 0, g: 136, b: 255, a: 0.6 },
      ],
      mono: [
        { r: 255, g: 255, b: 255, a: 0.6 },
        { r: 200, g: 200, b: 200, a: 0.4 },
        { r: 150, g: 150, b: 150, a: 0.3 },
      ],
      gold: [
        { r: 255, g: 215, b: 0, a: 0.7 },
        { r: 255, g: 165, b: 0, a: 0.6 },
        { r: 255, g: 100, b: 0, a: 0.5 },
      ],
    };
    
    // Page-type specific configs
    this.pageConfigs = {
      home: { count: 1.2, speed: 1.0, connections: true, gravity: 0.02 },
      about: { count: 0.8, speed: 0.7, connections: false, gravity: 0 },
      projects: { count: 1.0, speed: 1.0, connections: true, gravity: 0.01 },
      blog: { count: 0.6, speed: 0.5, connections: false, gravity: 0 },
      contact: { count: 0.8, speed: 0.8, connections: false, gravity: 0.01 },
      generic: { count: 1.0, speed: 1.0, connections: false, gravity: 0 },
    };
    
    this.init();
  }
  
  /**
   * Get particle count based on budget setting
   */
  getBudgetCount() {
    const budgets = {
      low: 40,
      medium: 80,
      high: 150,
      ultra: 250,
    };
    
    if (typeof this.config.particleBudget === 'number') {
      return this.config.particleBudget;
    }
    
    if (this.config.particleBudget !== 'auto') {
      return budgets[this.config.particleBudget] || budgets.medium;
    }
    
    // Auto-detect based on device capabilities
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReduced || this.config.reducedMotion) return budgets.low;
    if (isMobile) return budgets.low;
    if (hardwareConcurrency >= 8 && deviceMemory >= 8) return budgets.high;
    if (hardwareConcurrency >= 4 && deviceMemory >= 4) return budgets.medium;
    return budgets.low;
  }
  
  /**
   * Initialize the particle system
   */
  init() {
    // Get or create canvas
    const selector = this.config.container;
    this.canvas = document.querySelector(selector);
    
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = selector.replace('#', '');
      this.canvas.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
        z-index: -10;
      `;
      document.body.appendChild(this.canvas);
    }
    
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    
    // Set initial size
    this.resize();
    
    // Apply page-specific config
    const pageConfig = this.pageConfigs[this.config.pageType] || this.pageConfigs.generic;
    this.config.maxParticles = Math.floor(this.config.maxParticles * pageConfig.count);
    this.config.gravity = pageConfig.gravity;
    this.config.connections = pageConfig.connections;
    this.config.speedMultiplier = pageConfig.speed;
    
    // Create initial particles
    this.createParticles(this.config.maxParticles);
    
    // Event listeners
    this.bindEvents();
    
    // Start animation loop
    if (!this.config.reducedMotion) {
      this.start();
    }
    
    this.emit('ready', { particleCount: this.particles.length });
  }
  
  /**
   * Bind event listeners
   */
  bindEvents() {
    // Resize
    window.addEventListener('resize', this.debouncedResize.bind(this), { passive: true });
    
    // Mouse interaction
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    }, { passive: true });
    
    document.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    }, { passive: true });
    
    // Touch support
    document.addEventListener('touchmove', (e) => {
      if (e.touches) {
        this.mouse.x = e.touches.clientX;
        this.mouse.y = e.touches.clientY;
        this.mouse.active = true;
      }
    }, { passive: true });
    
    // Visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.resume();
    });
    
    // Event bus commands
    if (this.config.eventBus) {
      this.config.eventBus.on('qf:particles:set-count', (count) => this.setParticleCount(count));
      this.config.eventBus.on('qf:particles:set-quality', (quality) => this.setQuality(quality));
      this.config.eventBus.on('qf:particles:pause', () => this.pause());
      this.config.eventBus.on('qf:particles:resume', () => this.resume());
      this.config.eventBus.on('qf:particles:burst', (data) => this.burst(data));
    }
  }
  
  /**
   * Create particles
   */
  createParticles(count) {
    const palette = this.palettes[this.config.colorPalette] || this.palettes.fractal;
    const { innerWidth, innerHeight } = window;
    
    for (let i = 0; i < count; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      this.particles.push({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        vx: (Math.random() - 0.5) * 0.5 * (this.config.speedMultiplier || 1),
        vy: (Math.random() - 0.5) * 0.5 * (this.config.speedMultiplier || 1),
        size: Math.random() * 3 + 0.5,
        baseSize: Math.random() * 3 + 0.5,
        color: { ...color, a: (color.a || 1) * (0.3 + Math.random() * 0.4) },
        life: 1,
        decay: 0.0001 + Math.random() * 0.0002,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.01,
        trail: [],
        maxTrailLength: this.config.trailLength,
        type: Math.random() > 0.7 ? 'bright' : 'normal',
      });
    }
  }
  
  /**
   * Animation loop
   */
  animate(currentTime) {
    if (!this.running || this.paused) {
      this.animationId = requestAnimationFrame(this.animate.bind(this));
      return;
    }
    
    // FPS calculation
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      
      // Emit performance metrics
      this.emit('performance', { fps: this.fps, particles: this.particles.length, quality: this.quality });
    }
    
    // Delta time
    const dt = Math.min(currentTime - this.lastTime, 50); // Cap at 50ms
    this.lastTime = currentTime;
    
    // Update & render
    this.update(dt);
    this.render();
    
    // Continue loop
    this.animationId = requestAnimationFrame(this.animate.bind(this));
  }
  
  /**
   * Update particle physics
   */
  update(dt) {
    const { innerWidth, innerHeight } = window;
    const speedMult = this.config.speedMultiplier || 1;
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Apply forces
      let fx = 0, fy = 0;
      
      // Gravity
      if (this.config.gravity) {
        fy += this.config.gravity * dt * speedMult;
      }
      
      // Wind
      if (this.config.wind) {
        fx += this.config.wind * dt * speedMult;
      }
      
      // Mouse attraction/repulsion
      if (this.mouse.active) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.mouse.radius && dist > 0) {
          const force = (1 - dist / this.mouse.radius) * 0.5;
          fx += (dx / dist) * force * dt * speedMult;
          fy += (dy / dist) * force * dt * speedMult;
        }
      }
      
      // Custom forces
      this.forces.forEach((force) => {
        const dx = force.x - p.x;
        const dy = force.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < force.radius) {
          const f = force.strength * (1 - dist / force.radius) * (force.type === 'attract' ? 1 : -1);
          fx += (dx / dist) * f * dt * speedMult;
          fy += (dy / dist) * f * dt * speedMult;
        }
      });
      
      // Update velocity
      p.vx += fx;
      p.vy += fy;
      
      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;
      
      // Update position
      p.x += p.vx * dt * speedMult;
      p.y += p.vy * dt * speedMult;
      p.angle += p.angularVelocity * dt;
      
      // Trail
      if (this.config.trailLength > 0) {
        p.trail.push({ x: p.x, y: p.y, size: p.size, opacity: p.color.a });
        if (p.trail.length > p.maxTrailLength) p.trail.shift();
      }
      
      // Life decay
      p.life -= p.decay * dt;
      
      // Boundary wrap
      const margin = 50;
      if (p.x < -margin) p.x = innerWidth + margin;
      if (p.x > innerWidth + margin) p.x = -margin;
      if (p.y < -margin) p.y = innerHeight + margin;
      if (p.y > innerHeight + margin) p.y = -margin;
      
      // Respawn dead particles
      if (p.life <= 0) {
        this.respawnParticle(p);
      }
    }
    
    // Connection lines (spatial hash for performance)
    if (this.config.connections && this.quality !== 'low') {
      this.updateConnections();
    }
  }
  
  /**
   * Spatial hash for connection detection
   */
  updateConnections() {
    const cellSize = this.config.connectionDistance;
    const grid = new Map();
    
    // Build spatial hash
    this.particles.forEach((p, i) => {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const key = `${cx},${cy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ particle: p, index: i });
    });
    
    // Check nearby cells
    this.connections = [];
    this.particles.forEach((p, i) => {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cell = grid.get(key);
          if (!cell) continue;
          
          cell.forEach(({ particle: p2, index: j }) => {
            if (j <= i) return;
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.config.connectionDistance) {
              this.connections.push({ p1: p, p2, dist });
            }
          });
        }
      }
    });
  }
  
  /**
   * Render particles
   */
  render() {
    const ctx = this.ctx;
    const { innerWidth, innerHeight } = window;
    
    // Clear with slight trail for motion blur effect
    if (this.config.trailLength > 0) {
      ctx.fillStyle = 'rgba(5, 8, 20, 0.15)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    
    // Set blend mode
    ctx.globalCompositeOperation = this.config.blendMode;
    
    // Render trails
    if (this.config.trailLength > 0) {
      this.particles.forEach((p) => {
        if (p.trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(p.trail.x, p.trail.y);
        p.trail.forEach((point, i) => {
          const opacity = (i / p.trail.length) * point.opacity * 0.3;
          ctx.lineTo(point.x, point.y);
          ctx.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${opacity})`;
          ctx.lineWidth = point.size * (i / p.trail.length) * 0.5;
        });
        ctx.stroke();
      });
    }
    
    // Render connections
    if (this.config.connections && this.connections && this.quality !== 'low') {
      ctx.lineWidth = 0.5;
      this.connections.forEach(({ p1, p2, dist }) => {
        const opacity = (1 - dist / this.config.connectionDistance) * 0.15;
        ctx.strokeStyle = `rgba(0, 245, 212, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });
    }
    
    // Render particles
    this.particles.forEach((p) => {
      const size = p.size * (0.5 + p.life * 0.5);
      const alpha = p.color.a * p.life;
      
      if (p.type === 'bright') {
        // Glow effect for bright particles
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
        gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.3})`);
        gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Core particle
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';
  }
  
  /**
   * Respawn a dead particle
   */
  respawnParticle(p) {
    const { innerWidth, innerHeight } = window;
    const side = Math.floor(Math.random() * 4);
    const margin = 50;
    
    switch (side) {
      case 0: p.x = -margin; p.y = Math.random() * innerHeight; break;
      case 1: p.x = innerWidth + margin; p.y = Math.random() * innerHeight; break;
      case 2: p.x = Math.random() * innerWidth; p.y = -margin; break;
      case 3: p.x = Math.random() * innerWidth; p.y = innerHeight + margin; break;
    }
    
    p.life = 1;
    p.vx = (Math.random() - 0.5) * 0.5;
    p.vy = (Math.random() - 0.5) * 0.5;
  }
  
  /**
   * Start animation
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.emit('start');
  }
  
  /**
   * Pause animation
   */
  pause() {
    this.paused = true;
    this.emit('pause');
  }
  
  /**
   * Resume animation
   */
  resume() {
    this.paused = false;
    this.emit('resume');
  }
  
  /**
   * Stop and destroy
   */
  destroy() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.particles = [];
    this.forces = [];
    this.connections = [];
    this.emit('destroy');
  }
  
  /**
   * Set particle count dynamically
   */
  setParticleCount(count) {
    const currentCount = this.particles.length;
    if (count > currentCount) {
      this.createParticles(count - currentCount);
    } else if (count < currentCount) {
      this.particles = this.particles.slice(0, count);
    }
    this.emit('count-changed', { count: this.particles.length });
  }
  
  /**
   * Set quality level
   */
  setQuality(quality) {
    this.quality = quality;
    switch (quality) {
      case 'low':
        this.config.connections = false;
        this.config.trailLength = 0;
        break;
      case 'medium':
        this.config.connections = this.pageConfigs[this.config.pageType]?.connections || false;
        this.config.trailLength = 10;
        break;
      case 'high':
        this.config.connections = this.pageConfigs[this.config.pageType]?.connections || false;
        this.config.trailLength = 20;
        break;
    }
    this.emit('quality-changed', { quality });
  }
  
  /**
   * Reduce particle budget (called by performance monitor)
   */
  reduceBudget() {
    const newCount = Math.floor(this.particles.length * 0.7);
    this.setParticleCount(Math.max(newCount, 20));
    if (this.quality === 'high') this.setQuality('medium');
    else if (this.quality === 'medium') this.setQuality('low');
  }
  
  /**
   * Create particle burst at position
   */
  burst({ x, y, count = 20, color, velocity = 2 }) {
    const palette = this.palettes[this.config.colorPalette] || this.palettes.fractal;
    const burstColor = color || palette[Math.floor(Math.random() * palette.length)];
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = velocity * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1,
        baseSize: Math.random() * 4 + 1,
        color: { ...burstColor, a: 0.8 },
        life: 1,
        decay: 0.005 + Math.random() * 0.01,
        angle: 0,
        angularVelocity: 0,
        trail: [],
        maxTrailLength: 15,
        type: 'bright',
      });
    }
  }
  
  /**
   * Add force field
   */
  addForce(x, y, radius, strength, type = 'attract') {
    this.forces.push({ x, y, radius, strength, type });
    return this.forces.length - 1;
  }
  
  /**
   * Remove force field
   */
  removeForce(index) {
    this.forces.splice(index, 1);
  }
  
  /**
   * Resize canvas
   */
  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
  }
  
  /**
   * Debounced resize handler
   */
  debouncedResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.resize(), 100);
  }
  
  /**
   * Handle reduced motion change
   */
  onReducedMotionChange(enabled) {
    this.config.reducedMotion = enabled;
    if (enabled) this.pause();
    else this.resume();
  }
}
