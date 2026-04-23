"use client";

import React, { useEffect, useRef } from 'react';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    let mouseX = 0;
    let mouseY = 0;
    let scrollY = 0;
    let targetScrollY = 0;
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - W / 2) / 150;
      mouseY = (e.clientY - H / 2) / 150;
    };

    const handleScroll = () => {
      targetScrollY = window.scrollY;
    };

    // Advanced Star Logic
    const stars: any[] = [];
    const shootingStars: any[] = [];
    
    const initStars = () => {
      stars.length = 0;
      // 1. Distant Background Stars (Thousands of tiny points)
      for (let i = 0; i < 350; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 0.7,
          alpha: Math.random() * 0.4 + 0.1,
          color: '#ffffff',
          depth: 0.05,
          twinkle: Math.random() > 0.8
        });
      }
      // 2. Medium Stars (Glow and Color)
      for (let i = 0; i < 80; i++) {
        const colors = ['#ffffff', '#00f0ff', '#8a2be2', '#fff0f5'];
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.6 + 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
          depth: 0.2,
          twinkle: true,
          phase: Math.random() * Math.PI * 2
        });
      }
      // 3. Hero Stars (Closest, Brightest)
      for (let i = 0; i < 15; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 2 + 1.5,
          alpha: Math.random() * 0.8 + 0.4,
          color: '#ffffff',
          depth: 0.5,
          twinkle: true,
          phase: Math.random() * Math.PI * 2,
          glow: true
        });
      }
    };

    const addShootingStar = () => {
      if (Math.random() > 0.98 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * W,
          y: Math.random() * (H / 2),
          len: Math.random() * 80 + 50,
          speed: Math.random() * 15 + 10,
          alpha: 1,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2
        });
      }
    };

    initStars();

    function draw() {
      if (!ctx || !canvas) return;
      
      // Smooth scroll interpolation
      scrollY += (targetScrollY - scrollY) * 0.1;
      
      // Deep space base
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, W, H);

      // Nebula clouds
      const nebula = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W);
      nebula.addColorStop(0, 'rgba(13, 21, 36, 0)');
      nebula.addColorStop(0.4, 'rgba(138, 43, 226, 0.04)');
      nebula.addColorStop(0.8, 'rgba(0, 240, 255, 0.02)');
      nebula.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, W, H);

      // Draw Stars
      stars.forEach(s => {
        let alpha = s.alpha;
        if (s.twinkle) {
          alpha = s.alpha + Math.sin(Date.now() * 0.002 + (s.phase || 0)) * 0.2;
          alpha = Math.max(0.05, Math.min(1, alpha));
        }

        const renderX = (s.x + (mouseX * s.depth * 50)) % W;
        const renderY = (s.y - (scrollY * s.depth)) % H;
        const finalX = renderX < 0 ? renderX + W : renderX;
        const finalY = renderY < 0 ? renderY + H : renderY;

        ctx.beginPath();
        if (s.glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = s.color;
        }
        
        ctx.arc(finalX, finalY, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        
        // Reset effects
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      // Shooting Stars
      addShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ctx.beginPath();
        ctx.lineWidth = 2;
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
        grad.addColorStop(0, `rgba(255, 255, 255, ${ss.alpha})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
        ctx.stroke();

        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.alpha -= 0.02;

        if (ss.alpha <= 0 || ss.x > W + 100 || ss.y > H + 100) {
          shootingStars.splice(i, 1);
        }
      }

      requestAnimationFrame(draw);
    }

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    const animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="particleCanvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        background: '#020617'
      }}
    />
  );
};

export default ParticleBackground;
