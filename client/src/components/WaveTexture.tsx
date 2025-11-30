import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WaveTextureProps {
  className?: string;
}

const WaveTexture = ({ className = '' }: { className?: string }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Constants from reference
    const SEPARATION = 100;
    const AMOUNTX = 100;
    const AMOUNTY = 70;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Camera
    const camera = new THREE.PerspectiveCamera(120, width / height, 1, 10000);
    camera.position.z = 1000;

    // Scene
    const scene = new THREE.Scene();

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create particles
    const particles: THREE.Points[] = [];
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(AMOUNTX * AMOUNTY * 3);
    const basePositions = new Float32Array(AMOUNTX * AMOUNTY * 3);

    let i = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const idx = i * 3;
        const x = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
        const z = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2);

        positions[idx] = x;
        positions[idx + 1] = 0;
        positions[idx + 2] = z;

        basePositions[idx] = x;
        basePositions[idx + 1] = 0;
        basePositions[idx + 2] = z;

        i++;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Material (white-ish particles matching reference color 11111100)
    const material = new THREE.PointsMaterial({
      color: 0xAAAAAA,
      size: 4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Mouse tracking
    const mouseRef = {
      x: 85,
      y: -342
    };

    const windowHalf = {
      x: width / 2,
      y: height / 2
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.x = event.clientX - rect.left - windowHalf.x;
      mouseRef.y = event.clientY - rect.top - windowHalf.y;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const rect = container.getBoundingClientRect();
        mouseRef.x = event.touches[0].pageX - rect.left - windowHalf.x;
        mouseRef.y = event.touches[0].pageY - rect.top - windowHalf.y;
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Animation
    let count = 0;
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Camera follows mouse (smoothed)
      camera.position.x += (mouseRef.x - camera.position.x) * 0.05;
      camera.position.y += (-mouseRef.y - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Update particle positions with wave pattern
      const positions = geometry.attributes.position.array as Float32Array;
      let idx = 0;

      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const i = idx * 3;
          const baseIdx = i;

          // Wave calculation from reference
          const y = (Math.sin((ix + count) * 0.3) * 50) +
            (Math.sin((iy + count) * 0.5) * 50);

          positions[i + 1] = y;

          idx++;
        }
      }

      geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      count += 0.1;
    };

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;

      windowHalf.x = w / 2;
      windowHalf.y = h / 2;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationId);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`absolute inset-0 -z-20 ${className}`}
      style={{ pointerEvents: 'auto' }}
    />
  );
};

export default WaveTexture;
