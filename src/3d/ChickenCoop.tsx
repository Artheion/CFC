import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cock } from '../types';
import { getCockColor } from '../utils/cockColors';

interface Rooster {
  group: THREE.Group;
  head: THREE.Mesh;
  leg1: THREE.Mesh;
  leg2: THREE.Mesh;
  targetX: number;
  targetZ: number;
  velocity: { x: number; z: number };
  bobPhase: number;
  walkPhase: number;
  pauseTime: number;
  isMoving: boolean;
}

interface ChickenCoopProps {
  cocks: Cock[];
}

export default function ChickenCoop({ cocks }: ChickenCoopProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Wait for container to have dimensions
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    if (width === 0 || height === 0) {
      console.warn('Container has no dimensions yet');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    camera.position.set(5, 6, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Add OrbitControls for camera interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Disable zoom - lock distance
    const fixedDistance = Math.sqrt(5*5 + 6*6 + 5*5);
    controls.minDistance = fixedDistance;
    controls.maxDistance = fixedDistance;
    controls.enableZoom = false;
    // Lock vertical rotation - only allow horizontal rotation
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = Math.PI / 3;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Ground - large extended grass plane
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c4e, flatShading: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Wooden fence material
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, flatShading: true });

    // Fence dimensions
    const fenceSize = 8;
    const postHeight = 2;
    const postWidth = 0.2;
    const railHeight = 0.15;
    const railWidth = 0.1;

    // Create fence posts
    const postGeo = new THREE.BoxGeometry(postWidth, postHeight, postWidth);
    
    // Corner posts
    const corners = [
      [-fenceSize/2, -fenceSize/2],
      [fenceSize/2, -fenceSize/2],
      [fenceSize/2, fenceSize/2],
      [-fenceSize/2, fenceSize/2]
    ];

    corners.forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(x, postHeight/2, z);
      post.castShadow = true;
      scene.add(post);
    });

    // Posts along sides
    const postSpacing = 1.5;
    
    // Front and back fence
    for (let x = -fenceSize/2 + postSpacing; x < fenceSize/2; x += postSpacing) {
      const post1 = new THREE.Mesh(postGeo, woodMat);
      post1.position.set(x, postHeight/2, -fenceSize/2);
      post1.castShadow = true;
      scene.add(post1);
      
      const post2 = new THREE.Mesh(postGeo, woodMat);
      post2.position.set(x, postHeight/2, fenceSize/2);
      post2.castShadow = true;
      scene.add(post2);
    }

    // Left and right fence
    for (let z = -fenceSize/2 + postSpacing; z < fenceSize/2; z += postSpacing) {
      const post1 = new THREE.Mesh(postGeo, woodMat);
      post1.position.set(-fenceSize/2, postHeight/2, z);
      post1.castShadow = true;
      scene.add(post1);
      
      const post2 = new THREE.Mesh(postGeo, woodMat);
      post2.position.set(fenceSize/2, postHeight/2, z);
      post2.castShadow = true;
      scene.add(post2);
    }

    // Horizontal rails
    const railGeoH = new THREE.BoxGeometry(fenceSize, railHeight, railWidth);
    const railGeoV = new THREE.BoxGeometry(railWidth, railHeight, fenceSize);

    // Front rails
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.6;
      const rail = new THREE.Mesh(railGeoH, woodMat);
      rail.position.set(0, y, -fenceSize/2);
      scene.add(rail);
    }

    // Back rails
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.6;
      const rail = new THREE.Mesh(railGeoH, woodMat);
      rail.position.set(0, y, fenceSize/2);
      scene.add(rail);
    }

    // Left rails
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.6;
      const rail = new THREE.Mesh(railGeoV, woodMat);
      rail.position.set(-fenceSize/2, y, 0);
      scene.add(rail);
    }

    // Right rails
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.6;
      const rail = new THREE.Mesh(railGeoV, woodMat);
      rail.position.set(fenceSize/2, y, 0);
      scene.add(rail);
    }

    // Create roosters (cocks)
    const roosters: Rooster[] = [];
    
    const createRooster = (startX: number, startZ: number, color: number): Rooster => {
      const roosterGroup = new THREE.Group();
      
      // Body - larger and more upright
      const bodyGeo = new THREE.SphereGeometry(0.35, 5, 5);
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1, 1.3, 1);
      body.castShadow = true;
      roosterGroup.add(body);

      // Neck
      const neckGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 5);
      const neck = new THREE.Mesh(neckGeo, bodyMat);
      neck.position.set(0, 0.35, 0.1);
      neck.rotation.x = 0.3;
      roosterGroup.add(neck);

      // Head
      const headGeo = new THREE.SphereGeometry(0.18, 5, 5);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.55, 0.2);
      head.castShadow = true;
      roosterGroup.add(head);

      // Beak
      const beakGeo = new THREE.ConeGeometry(0.08, 0.18, 3);
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.55, 0.35);
      roosterGroup.add(beak);

      // Large comb
      const combGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);
      const combMat = new THREE.MeshStandardMaterial({ color: 0xff0000, flatShading: true });
      const comb = new THREE.Mesh(combGeo, combMat);
      comb.position.set(0, 0.7, 0.2);
      roosterGroup.add(comb);

      // Wattle (under chin)
      const wattleGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const wattle = new THREE.Mesh(wattleGeo, combMat);
      wattle.scale.set(0.8, 1.2, 0.6);
      wattle.position.set(0, 0.45, 0.28);
      roosterGroup.add(wattle);

      // Tail feathers - large and pointed up
      const tailGeo = new THREE.ConeGeometry(0.25, 0.6, 4);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.rotation.x = -Math.PI / 3;
      tail.position.set(0, 0.3, -0.35);
      roosterGroup.add(tail);

      // Legs
      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4);
      const legMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      
      const leg1 = new THREE.Mesh(legGeo, legMat);
      leg1.position.set(-0.12, -0.55, 0);
      roosterGroup.add(leg1);
      
      const leg2 = new THREE.Mesh(legGeo, legMat);
      leg2.position.set(0.12, -0.55, 0);
      roosterGroup.add(leg2);

      roosterGroup.position.set(startX, 0.6, startZ);
      
      scene.add(roosterGroup);
      return {
        group: roosterGroup,
        head: head,
        leg1: leg1,
        leg2: leg2,
        targetX: startX,
        targetZ: startZ,
        velocity: { x: 0, z: 0 },
        bobPhase: Math.random() * Math.PI * 2,
        walkPhase: 0,
        pauseTime: Math.random() * 100,
        isMoving: false
      };
    };

    // Create roosters with their actual colors from templates
    const numRoosters = Math.min(cocks.length, 8);
    for (let i = 0; i < numRoosters; i++) {
      const angle = (i / numRoosters) * Math.PI * 2;
      const radius = 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const color = getCockColor(cocks[i].templateId);
      roosters.push(createRooster(x, z, color));
    }

    // Collision detection helper
    const checkCollision = (rooster: Rooster, otherRoosters: Rooster[]) => {
      const minDistance = 0.8;
      for (let other of otherRoosters) {
        if (other === rooster) continue;
        const dx = other.group.position.x - rooster.group.position.x;
        const dz = other.group.position.z - rooster.group.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < minDistance) {
          return { colliding: true, dx, dz, distance };
        }
      }
      return { colliding: false, dx: 0, dz: 0, distance: 0 };
    };

    // Animation with realistic chicken behavior
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Animate each rooster with realistic chicken behavior
      roosters.forEach((rooster) => {
        const bounds = fenceSize / 2 - 0.5;
        
        // Check for collisions with other roosters
        const collision = checkCollision(rooster, roosters);
        
        // Decide whether to move or pause
        rooster.pauseTime--;
        
        if (rooster.pauseTime <= 0) {
          if (!rooster.isMoving || Math.random() < 0.02) {
            // Pick new random target or stop
            if (Math.random() < 0.7) {
              rooster.targetX = (Math.random() - 0.5) * (fenceSize - 1);
              rooster.targetZ = (Math.random() - 0.5) * (fenceSize - 1);
              rooster.isMoving = true;
              rooster.pauseTime = 0;
            } else {
              rooster.isMoving = false;
              rooster.pauseTime = 30 + Math.random() * 60;
            }
          }
        }
        
        // If about to collide, stop or move away
        if (collision.colliding && rooster.isMoving) {
          // Move away from the collision
          rooster.group.position.x -= (collision.dx / collision.distance) * 0.05;
          rooster.group.position.z -= (collision.dz / collision.distance) * 0.05;
          // Pick a new target away from collision
          rooster.targetX = rooster.group.position.x - collision.dx;
          rooster.targetZ = rooster.group.position.z - collision.dz;
        }
        
        if (rooster.isMoving) {
          // Move towards target
          const dx = rooster.targetX - rooster.group.position.x;
          const dz = rooster.targetZ - rooster.group.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          
          if (distance > 0.1) {
            const speed = 0.03;
            rooster.velocity.x = (dx / distance) * speed;
            rooster.velocity.z = (dz / distance) * speed;
            
            rooster.group.position.x += rooster.velocity.x;
            rooster.group.position.z += rooster.velocity.z;
            
            // Keep within bounds
            rooster.group.position.x = Math.max(-bounds, Math.min(bounds, rooster.group.position.x));
            rooster.group.position.z = Math.max(-bounds, Math.min(bounds, rooster.group.position.z));
            
            // Face direction of movement
            rooster.group.rotation.y = Math.atan2(rooster.velocity.x, rooster.velocity.z);
            
            // Walking animation
            rooster.walkPhase += 0.3;
            rooster.bobPhase += 0.2;
            rooster.group.position.y = 0.6 + Math.abs(Math.sin(rooster.bobPhase)) * 0.08;
            
            // Head bobbing while walking
            rooster.head.position.z = 0.2 + Math.sin(rooster.walkPhase) * 0.05;
            
            // Leg animation
            rooster.leg1.rotation.x = Math.sin(rooster.walkPhase) * 0.4;
            rooster.leg2.rotation.x = Math.sin(rooster.walkPhase + Math.PI) * 0.4;
          } else {
            // Reached target, pause
            rooster.isMoving = false;
            rooster.pauseTime = 30 + Math.random() * 100;
            rooster.leg1.rotation.x = 0;
            rooster.leg2.rotation.x = 0;
          }
        } else {
          // Occasional head movement when standing still
          if (Math.random() < 0.05) {
            rooster.head.position.z = 0.2 + (Math.random() - 0.5) * 0.1;
          }
          // Subtle pecking motion
          if (Math.random() < 0.02) {
            rooster.group.rotation.x = -0.3;
            setTimeout(() => {
              rooster.group.rotation.x = 0;
            }, 200);
          }
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      
      // Clean up scene objects
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
      
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [cocks]);

  return <div ref={mountRef} className="w-full h-96 overflow-hidden" />;
}