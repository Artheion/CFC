import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cock } from '../types';
import { getCockColor } from '../utils/cockColors';

interface Rooster {
  group: THREE.Group;
  head: THREE.Mesh;
  body: THREE.Mesh;
  leg1: THREE.Mesh;
  leg2: THREE.Mesh;
  neck: THREE.Mesh;
  tail: THREE.Mesh;
  bobPhase: number;
  walkPhase: number;
  actionState: string;
  actionTimer: number;
  health: number;
  aggression: number;
  stamina: number;
  lastHitTime: number;
}

interface FightArenaProps {
  cock1?: Cock;
  cock2?: Cock;
  isActive: boolean;
}

export default function FightArena({ cock1, cock2, isActive }: FightArenaProps) {
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
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Add OrbitControls for camera interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x6b8e23, flatShading: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Arena floor
    const arenaRadius = 5;
    const arenaFloorGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius, 0.2, 16);
    const arenaFloorMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, flatShading: true });
    const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
    arenaFloor.position.y = 0.1;
    arenaFloor.receiveShadow = true;
    scene.add(arenaFloor);

    // Arena fence - wooden posts in a circle
    const postCount = 24;
    const postHeight = 1.8;
    const postGeo = new THREE.BoxGeometry(0.2, postHeight, 0.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, flatShading: true });

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * arenaRadius;
      const z = Math.sin(angle) * arenaRadius;
      
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(x, postHeight / 2 + 0.2, z);
      post.castShadow = true;
      scene.add(post);
    }

    // Horizontal rails around arena - create curved rails
    const segments = 64;
    const railHeight = 0.12;
    
    for (let level = 0; level < 4; level++) {
      const y = 0.5 + level * 0.45;
      const points = [];
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * arenaRadius;
        const z = Math.sin(angle) * arenaRadius;
        points.push(new THREE.Vector3(x, y, z));
      }
      
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, segments, railHeight / 2, 4, true);
      const rail = new THREE.Mesh(tubeGeo, woodMat);
      scene.add(rail);
    }

    // Create rooster function
    const createRooster = (startX: number, startZ: number, color: number): Rooster => {
      const roosterGroup = new THREE.Group();
      
      const bodyGeo = new THREE.SphereGeometry(0.35, 5, 5);
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1, 1.3, 1);
      body.castShadow = true;
      roosterGroup.add(body);

      const neckGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 5);
      const neck = new THREE.Mesh(neckGeo, bodyMat);
      neck.position.set(0, 0.35, 0.1);
      neck.rotation.x = 0.3;
      roosterGroup.add(neck);

      const headGeo = new THREE.SphereGeometry(0.18, 5, 5);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.55, 0.2);
      head.castShadow = true;
      roosterGroup.add(head);

      const beakGeo = new THREE.ConeGeometry(0.08, 0.18, 3);
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.55, 0.35);
      roosterGroup.add(beak);

      const combGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);
      const combMat = new THREE.MeshStandardMaterial({ color: 0xff0000, flatShading: true });
      const comb = new THREE.Mesh(combGeo, combMat);
      comb.position.set(0, 0.7, 0.2);
      roosterGroup.add(comb);

      const wattleGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const wattle = new THREE.Mesh(wattleGeo, combMat);
      wattle.scale.set(0.8, 1.2, 0.6);
      wattle.position.set(0, 0.45, 0.28);
      roosterGroup.add(wattle);

      const tailGeo = new THREE.ConeGeometry(0.25, 0.6, 4);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.rotation.x = -Math.PI / 3;
      tail.position.set(0, 0.3, -0.35);
      roosterGroup.add(tail);

      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4);
      const legMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      
      const leg1 = new THREE.Mesh(legGeo, legMat);
      leg1.position.set(-0.12, -0.55, 0);
      roosterGroup.add(leg1);
      
      const leg2 = new THREE.Mesh(legGeo, legMat);
      leg2.position.set(0.12, -0.55, 0);
      roosterGroup.add(leg2);

      roosterGroup.position.set(startX, 0.8, startZ);
      scene.add(roosterGroup);
      
      return {
        group: roosterGroup,
        head: head,
        body: body,
        leg1: leg1,
        leg2: leg2,
        neck: neck,
        tail: tail,
        bobPhase: 0,
        walkPhase: 0,
        actionState: 'circling',
        actionTimer: 0,
        health: 100,
        aggression: 0.5 + Math.random() * 0.5,
        stamina: 100,
        lastHitTime: 0
      };
    };

    // Create two fighting roosters with their actual colors
    const cock1Color = cock1 ? getCockColor(cock1.templateId) : 0xd4a574;
    const cock2Color = cock2 ? getCockColor(cock2.templateId) : 0x2c1810;
    const rooster1 = createRooster(-2.5, 0, cock1Color);
    const rooster2 = createRooster(2.5, 0, cock2Color);
    const roosters = [rooster1, rooster2];

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      if (isActive) {
        roosters.forEach((rooster, index) => {
          const opponent = roosters[1 - index];
          const toOpponent = {
            x: opponent.group.position.x - rooster.group.position.x,
            z: opponent.group.position.z - rooster.group.position.z
          };
          const distToOpponent = Math.sqrt(toOpponent.x ** 2 + toOpponent.z ** 2);
          
          rooster.actionTimer--;
          rooster.stamina = Math.min(100, rooster.stamina + 0.2);
          
          // Decision making based on distance, stamina, and aggression
          if (rooster.actionTimer <= 0) {
            const rand = Math.random();
            const isClose = distToOpponent < 1.8;
            const hasStamina = rooster.stamina > 40;
            const opponentAttacking = opponent.actionState === 'attacking' || opponent.actionState === 'charging';
            
            if (opponentAttacking && rand < 0.6 && hasStamina) {
              // Counter-attack or dodge
              if (rand < 0.35 && distToOpponent < 1.5) {
                rooster.actionState = 'counterattack';
                rooster.actionTimer = 15;
                rooster.stamina -= 25;
              } else {
                rooster.actionState = 'dodging';
                rooster.actionTimer = 15;
                rooster.stamina -= 10;
              }
            } else if (isClose && hasStamina && rand < rooster.aggression) {
              // Aggressive close-range actions
              if (rand < 0.25) {
                rooster.actionState = 'pecking';
                rooster.actionTimer = 20;
                rooster.stamina -= 15;
              } else if (rand < 0.5) {
                rooster.actionState = 'jumping_attack';
                rooster.actionTimer = 25;
                rooster.stamina -= 30;
              } else {
                rooster.actionState = 'wing_slap';
                rooster.actionTimer = 18;
                rooster.stamina -= 20;
              }
            } else if (distToOpponent > 3 && hasStamina) {
              // Close distance
              rooster.actionState = 'charging';
              rooster.actionTimer = 30 + Math.random() * 20;
              rooster.stamina -= 5;
            } else if (distToOpponent > 1.5 && distToOpponent < 3) {
              // Medium range - circle and position
              rooster.actionState = 'circling';
              rooster.actionTimer = 25 + Math.random() * 25;
            } else if (!hasStamina) {
              // Recover stamina
              rooster.actionState = 'recovering';
              rooster.actionTimer = 40;
            } else {
              // Default to circling
              rooster.actionState = 'circling';
              rooster.actionTimer = 30;
            }
          }
          
          const speed = 0.045;
          const normalizeDir = (x: number, z: number) => {
            const len = Math.sqrt(x * x + z * z);
            return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
          };
          
          // Collision prevention - keep minimum distance
          const minDistance = 0.7;
          if (distToOpponent < minDistance && !['jumping_attack', 'counterattack', 'pecking', 'wing_slap'].includes(rooster.actionState)) {
            const pushDir = normalizeDir(-toOpponent.x, -toOpponent.z);
            rooster.group.position.x += pushDir.x * 0.05;
            rooster.group.position.z += pushDir.z * 0.05;
          }
          
          switch (rooster.actionState) {
            case 'circling':
              // Circle with some approach
              const circleDir = index === 0 ? 1 : -1;
              const perpX = -toOpponent.z / distToOpponent;
              const perpZ = toOpponent.x / distToOpponent;
              
              // Only move closer if not too close
              const approachFactor = distToOpponent > 1.2 ? 0.4 : 0;
              
              rooster.group.position.x += (perpX * speed * circleDir * 1.5 + toOpponent.x / distToOpponent * speed * approachFactor);
              rooster.group.position.z += (perpZ * speed * circleDir * 1.5 + toOpponent.z / distToOpponent * speed * approachFactor);
              
              rooster.walkPhase += 0.25;
              rooster.bobPhase += 0.18;
              rooster.group.position.y = 0.8 + Math.abs(Math.sin(rooster.bobPhase)) * 0.08;
              rooster.neck.rotation.x = 0.3 + Math.sin(rooster.bobPhase) * 0.1;
              rooster.tail.rotation.x = -Math.PI / 3 + Math.sin(rooster.bobPhase * 0.5) * 0.1;
              break;
              
            case 'charging':
              // Aggressive rush - but stop before collision
              if (distToOpponent > 0.9) {
                const dir = normalizeDir(toOpponent.x, toOpponent.z);
                rooster.group.position.x += dir.x * speed * 2.5;
                rooster.group.position.z += dir.z * speed * 2.5;
              }
              
              rooster.walkPhase += 0.6;
              rooster.bobPhase += 0.4;
              rooster.group.position.y = 0.8 + Math.abs(Math.sin(rooster.bobPhase)) * 0.15;
              rooster.body.rotation.x = -0.3;
              rooster.neck.rotation.x = 0.1;
              break;
              
            case 'jumping_attack':
              // Powerful leap attack
              const jumpPhase = (25 - rooster.actionTimer) / 25;
              rooster.group.position.y = 0.8 + Math.sin(jumpPhase * Math.PI) * 1.2;
              rooster.group.rotation.x = Math.sin(jumpPhase * Math.PI) * 0.6;
              rooster.leg1.rotation.x = Math.cos(jumpPhase * Math.PI * 2) * 1.2;
              rooster.leg2.rotation.x = -Math.cos(jumpPhase * Math.PI * 2) * 1.2;
              rooster.neck.rotation.x = 0.5;
              
              if (jumpPhase < 0.5) {
                const moveDir = normalizeDir(toOpponent.x, toOpponent.z);
                rooster.group.position.x += moveDir.x * speed * 1.5;
                rooster.group.position.z += moveDir.z * speed * 1.5;
              }
              
              // Check for hit
              if (jumpPhase > 0.4 && jumpPhase < 0.6 && distToOpponent < 1.2) {
                opponent.lastHitTime = Date.now();
              }
              break;
              
            case 'pecking':
              // Rapid pecking attacks
              const peckPhase = ((20 - rooster.actionTimer) % 7) / 7;
              rooster.head.position.z = 0.2 + Math.sin(peckPhase * Math.PI) * 0.3;
              rooster.head.position.y = 0.55 - Math.sin(peckPhase * Math.PI) * 0.2;
              rooster.neck.rotation.x = 0.5 + Math.sin(peckPhase * Math.PI) * 0.5;
              rooster.body.rotation.x = Math.sin(peckPhase * Math.PI) * 0.2;
              
              if (peckPhase > 0.5 && distToOpponent < 1.0) {
                opponent.lastHitTime = Date.now();
              }
              
              // Slight forward movement
              if (distToOpponent > 0.8) {
                const moveDir = normalizeDir(toOpponent.x, toOpponent.z);
                rooster.group.position.x += moveDir.x * speed * 0.5;
                rooster.group.position.z += moveDir.z * speed * 0.5;
              }
              break;
              
            case 'wing_slap':
              // Wing slapping motion
              const slapPhase = (18 - rooster.actionTimer) / 18;
              rooster.body.rotation.z = Math.sin(slapPhase * Math.PI * 2) * 0.5;
              rooster.neck.rotation.z = Math.sin(slapPhase * Math.PI * 2) * 0.3;
              
              if (slapPhase > 0.3 && slapPhase < 0.7 && distToOpponent < 1.1) {
                opponent.lastHitTime = Date.now();
              }
              break;
              
            case 'counterattack':
              // Quick counter move
              const counterPhase = (15 - rooster.actionTimer) / 15;
              rooster.group.position.y = 0.8 + Math.sin(counterPhase * Math.PI) * 0.7;
              rooster.leg1.rotation.x = Math.sin(counterPhase * Math.PI * 2) * 0.9;
              rooster.leg2.rotation.x = -Math.sin(counterPhase * Math.PI * 2) * 0.9;
              rooster.body.rotation.x = -Math.sin(counterPhase * Math.PI) * 0.4;
              
              if (counterPhase > 0.4 && counterPhase < 0.6 && distToOpponent < 1.3) {
                opponent.lastHitTime = Date.now();
              }
              break;
              
            case 'dodging':
              // Quick evasive movement
              const dodgeDir = index === 0 ? 1 : -1;
              const backDir = normalizeDir(-toOpponent.x, -toOpponent.z);
              const sideDir = normalizeDir(-toOpponent.z, toOpponent.x);
              
              rooster.group.position.x += (backDir.x * speed * 2 + sideDir.x * speed * dodgeDir * 1.5);
              rooster.group.position.z += (backDir.z * speed * 2 + sideDir.z * speed * dodgeDir * 1.5);
              
              rooster.walkPhase += 0.4;
              rooster.bobPhase += 0.3;
              rooster.body.rotation.z = dodgeDir * 0.2;
              break;
              
            case 'recovering':
              // Breathing, regaining stamina
              rooster.bobPhase += 0.1;
              rooster.body.rotation.x = Math.sin(rooster.bobPhase) * 0.05;
              rooster.neck.rotation.x = 0.4;
              
              // Slowly back away
              if (distToOpponent < 2.5) {
                const backDir = normalizeDir(-toOpponent.x, -toOpponent.z);
                rooster.group.position.x += backDir.x * speed * 0.5;
                rooster.group.position.z += backDir.z * speed * 0.5;
              }
              break;
          }
          
          // Visual feedback for being hit
          if (Date.now() - opponent.lastHitTime < 200) {
            opponent.body.material.emissive = new THREE.Color(0xff0000);
            opponent.group.position.x -= (toOpponent.x / distToOpponent) * 0.1;
            opponent.group.position.z -= (toOpponent.z / distToOpponent) * 0.1;
          } else {
            opponent.body.material.emissive = new THREE.Color(0x000000);
          }
          
          // Always face opponent
          const angleToOpponent = Math.atan2(toOpponent.x, toOpponent.z);
          rooster.group.rotation.y = angleToOpponent;
          
          // Leg animation for walking states
          if (['circling', 'charging', 'dodging', 'recovering'].includes(rooster.actionState)) {
            rooster.leg1.rotation.x = Math.sin(rooster.walkPhase) * 0.5;
            rooster.leg2.rotation.x = Math.sin(rooster.walkPhase + Math.PI) * 0.5;
          }
          
          // Head bobbing for walking
          if (['circling', 'charging'].includes(rooster.actionState)) {
            rooster.head.position.z = 0.2 + Math.sin(rooster.walkPhase * 2) * 0.06;
          } else if (!['pecking', 'jumping_attack'].includes(rooster.actionState)) {
            rooster.head.position.z = 0.2;
            rooster.head.position.y = 0.55;
          }
          
          // Reset rotations
          if (!['wing_slap', 'dodging'].includes(rooster.actionState)) {
            rooster.body.rotation.z = 0;
            rooster.neck.rotation.z = 0;
          }
          if (!['charging', 'pecking', 'counterattack', 'jumping_attack'].includes(rooster.actionState)) {
            rooster.body.rotation.x = 0;
          }
          if (rooster.actionState !== 'jumping_attack') {
            rooster.group.rotation.x = 0;
          }
          
          // Keep roosters in arena
          const distFromCenter = Math.sqrt(rooster.group.position.x ** 2 + rooster.group.position.z ** 2);
          if (distFromCenter > arenaRadius - 0.8) {
            const angle = Math.atan2(rooster.group.position.z, rooster.group.position.x);
            rooster.group.position.x = Math.cos(angle) * (arenaRadius - 0.8);
            rooster.group.position.z = Math.sin(angle) * (arenaRadius - 0.8);
          }
        });
      }

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
      controls.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isActive, cock1, cock2]);

  return <div ref={mountRef} className="w-full h-96 overflow-hidden" />;
}