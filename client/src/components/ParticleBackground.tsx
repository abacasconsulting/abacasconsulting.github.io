import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ParticleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const SEPARATION = 100;
    const AMOUNTX = 50;
    const AMOUNTY = 50;

    const container = containerRef.current;
    let camera: THREE.PerspectiveCamera;
    let scene: THREE.Scene;
    let renderer: THREE.WebGLRenderer;

    let count = 0;
    let time = 0;

    let mouseX = 0;
    let mouseY = 0;

    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    const onWindowResize = () => {
      windowHalfX = window.innerWidth / 2;
      windowHalfY = window.innerHeight / 2;

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const onDocumentMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX - windowHalfX;
      mouseY = event.clientY - windowHalfY;
    };

    const onDocumentTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - windowHalfX;
        mouseY = event.touches[0].pageY - windowHalfY;
      }
    };

    const onDocumentTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        mouseX = event.touches[0].pageX - windowHalfX;
        mouseY = event.touches[0].pageY - windowHalfY;
      }
    };

    const initWebGL = () => {
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
      camera.position.z = 1000;
      camera.position.y = 400;

      scene = new THREE.Scene();

      const numParticles = AMOUNTX * AMOUNTY;
      const positions = new Float32Array(numParticles * 3);
      const scales = new Float32Array(numParticles);

      let i = 0, j = 0;

      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          positions[i] = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2); // x
          positions[i + 1] = 0; // y
          positions[i + 2] = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2); // z

          scales[j] = 1;

          i += 3;
          j++;
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x38bdf8) },
        },
        vertexShader: `
                    attribute float scale;
                    void main() {
                        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
                        gl_PointSize = scale * ( 300.0 / - mvPosition.z ) * 1.5; // Increased size multiplier
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
        fragmentShader: `
                    uniform vec3 color;
                    void main() {
                        // Circular particle logic
                        vec2 center = gl_PointCoord - vec2(0.5);
                        float dist = length(center);
                        if ( dist > 0.5 ) discard;
                        
                        // Optional: Soft edge
                        // float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                        // gl_FragColor = vec4( color, alpha );
                        
                        gl_FragColor = vec4( color, 1.0 );
                    }
                `,
        transparent: true
      });

      const particlesMesh = new THREE.Points(geometry, material);
      scene.add(particlesMesh);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      // Store reference for animation
      (scene as any).userData = { particlesMesh, positions, scales, originalZ: positions.slice() };

      document.addEventListener('mousemove', onDocumentMouseMove, false);
      document.addEventListener('touchstart', onDocumentTouchStart, false);
      document.addEventListener('touchmove', onDocumentTouchMove, false);
      window.addEventListener('resize', onWindowResize, false);
    };

    const renderWebGL = () => {
      // Mouse parallax
      camera.position.x += (mouseX - camera.position.x) * 0.05;
      camera.position.y += (-mouseY + 200 - camera.position.y) * 0.05;

      camera.lookAt(scene.position);

      const positions = (scene as any).userData.positions;
      const scales = (scene as any).userData.scales;
      const particlesMesh = (scene as any).userData.particlesMesh;

      // Infinite movement logic
      const speed = 2.0; // Continuous forward speed
      const scrollSpeed = window.scrollY * 0.5; // Scroll adds to speed/position
      const totalMovement = (time * speed) + scrollSpeed;

      // Grid depth
      const depth = AMOUNTY * SEPARATION;
      const halfDepth = depth / 2;

      let i = 0, j = 0;

      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          // Update Y position based on sine wave
          positions[i + 1] = (Math.sin((ix + count) * 0.3) * 50) + (Math.sin((iy + count) * 0.5) * 50);

          // Update Scale
          scales[j] = (Math.sin((ix + count) * 0.3) + 1) * 8 + (Math.sin((iy + count) * 0.5) + 1) * 8;

          // Update Z position for infinite scrolling
          // Original Z + movement, wrapped around the depth
          let z = (iy * SEPARATION) - halfDepth + totalMovement;

          // Wrap logic: if z > boundary, wrap to back
          // We want them to move towards camera (+Z)
          // So if they get too close (e.g. > 1000), wrap to -4000
          // Or simpler: modulo arithmetic

          // Shift range to [0, depth] for modulo, then shift back
          z = ((z + halfDepth) % depth) - halfDepth;

          // If negative modulo result (can happen in JS), fix it
          if (z < -halfDepth) z += depth;

          positions[i + 2] = z;

          i += 3;
          j++;
        }
      }

      particlesMesh.geometry.attributes.position.needsUpdate = true;
      particlesMesh.geometry.attributes.scale.needsUpdate = true;

      renderer.render(scene, camera);

      count += 0.1;
      time += 1;
    }

    initWebGL();

    const animateWebGL = () => {
      requestAnimationFrame(animateWebGL);
      renderWebGL();
    }

    animateWebGL();

    return () => {
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      document.removeEventListener('mousemove', onDocumentMouseMove);
      document.removeEventListener('touchstart', onDocumentTouchStart);
      document.removeEventListener('touchmove', onDocumentTouchMove);
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 -z-10 bg-[#0f172a]" />;
};

export default ParticleBackground;