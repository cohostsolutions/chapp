import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limit particle count for performance
    const MAX_PARTICLES = 150;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    const initParticles = () => {
      particlesRef.current = [];
      const spacing = 80; // Increased spacing for fewer particles
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);
      const totalNeeded = cols * rows;
      
      // Reduce density if too many particles
      const actualSpacing = totalNeeded > MAX_PARTICLES 
        ? Math.ceil(Math.sqrt((canvas.width * canvas.height) / MAX_PARTICLES))
        : spacing;
      
      const actualCols = Math.ceil(canvas.width / actualSpacing);
      const actualRows = Math.ceil(canvas.height / actualSpacing);

      for (let i = 0; i < actualCols && particlesRef.current.length < MAX_PARTICLES; i++) {
        for (let j = 0; j < actualRows && particlesRef.current.length < MAX_PARTICLES; j++) {
          particlesRef.current.push({
            x: i * actualSpacing + actualSpacing / 2,
            y: j * actualSpacing + actualSpacing / 2,
            baseX: i * actualSpacing + actualSpacing / 2,
            baseY: j * actualSpacing + actualSpacing / 2,
            vx: 0,
            vy: 0,
            radius: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.3 + 0.1,
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    // Visibility observer to pause animation when not visible
    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const animate = () => {
      // Skip animation if not visible
      if (!isVisibleRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const particleCount = particles.length;

      // Draw all particles first
      for (let i = 0; i < particleCount; i++) {
        const particle = particles[i];
        
        // Calculate distance from mouse
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distSq = dx * dx + dy * dy;
        const maxDistance = 100;
        const maxDistSq = maxDistance * maxDistance;

        // Move away from mouse (use squared distance to avoid sqrt)
        if (distSq < maxDistSq && distSq > 0) {
          const distance = Math.sqrt(distSq);
          const force = (maxDistance - distance) / maxDistance;
          particle.vx -= (dx / distance) * force * 0.5;
          particle.vy -= (dy / distance) * force * 0.5;
        }

        // Return to base position
        particle.vx += (particle.baseX - particle.x) * 0.02;
        particle.vy += (particle.baseY - particle.y) * 0.02;

        // Apply friction
        particle.vx *= 0.95;
        particle.vy *= 0.95;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(187, 85%, 53%, ${particle.alpha})`;
        ctx.fill();
      }

      // Draw connections - only check nearby particles (skip distant ones)
      // Use a simplified approach: only draw connections for first 50 particles
      const connectionLimit = Math.min(50, particleCount);
      for (let i = 0; i < connectionLimit; i++) {
        const particle = particles[i];
        // Only check next few particles to avoid O(n²)
        for (let j = i + 1; j < Math.min(i + 10, particleCount); j++) {
          const other = particles[j];
          const distX = particle.x - other.x;
          const distY = particle.y - other.y;
          const distSq = distX * distX + distY * distY;

          if (distSq < 3600 && distSq > 0) { // 60^2 = 3600
            const dist = Math.sqrt(distSq);
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `hsla(187, 85%, 53%, ${0.05 * (1 - dist / 60)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ opacity: 0.6 }}
    />
  );
}
