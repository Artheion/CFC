import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cock } from '../types';
import { getCockColor } from '../utils/cockColors';

type ArenaPhase = 'idle' | 'facing' | 'fighting' | 'between' | 'finished';

interface KnockoutInfo {
  winnerId: string;
  loserId: string;
}

interface CockfightArenaProps {
  cock1?: Cock;
  cock2?: Cock;
  phase: ArenaPhase;
  cock1Health: number;
  cock2Health: number;
  knockoutInfo?: KnockoutInfo | null;
  countdown?: number | null;
}

type RoosterAction =
  | 'circling'
  | 'charging'
  | 'jumping_attack'
  | 'pecking'
  | 'wing_slap'
  | 'counterattack'
  | 'dodging'
  | 'recovering'
  | 'idle';

interface RoosterModel {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  head: THREE.Mesh;
  neck: THREE.Mesh;
  tail: THREE.Mesh;
  leg1: THREE.Mesh;
  leg2: THREE.Mesh;
  bobPhase: number;
  walkPhase: number;
  actionState: RoosterAction;
  actionTimer: number;
  health: number;
  aggression: number;
  stamina: number;
  lastHitTime: number;
  basePosition: THREE.Vector3;
  bodyRest: THREE.Euler;
  neckRest: THREE.Euler;
  tailRest: THREE.Euler;
  headRest: THREE.Vector3;
  isLoser: boolean;
  loserFallPosition: THREE.Vector3 | null;
  nameSprite: THREE.Sprite;
}

const ARENA_RADIUS = 5;

const normalizeDir = (x: number, z: number) => {
  const len = Math.sqrt(x * x + z * z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
};

const CockfightArena = ({
  cock1,
  cock2,
  phase,
  cock1Health,
  cock2Health,
  knockoutInfo = null,
  countdown = null,
}: CockfightArenaProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const roostersRef = useRef<RoosterModel[]>([]);
  const animationRef = useRef<number>();
  const phaseRef = useRef<ArenaPhase>('idle');
  const healthRef = useRef({ cock1: 100, cock2: 100 });
  const knockoutRef = useRef<KnockoutInfo | null>(null);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    healthRef.current = { cock1: cock1Health, cock2: cock2Health };
  }, [cock1Health, cock2Health]);

  useEffect(() => {
    knockoutRef.current = knockoutInfo ?? null;
  }, [knockoutInfo]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !cock1 || !cock2) {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(6.5, 4.2, 6.5);
    camera.lookAt(0, 0.6, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(6, 10, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const groundGeo = new THREE.CircleGeometry(12, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, flatShading: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const arenaFloorGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.2, 16);
    const arenaFloorMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3a, flatShading: true });
    const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
    arenaFloor.position.y = 0.1;
    arenaFloor.receiveShadow = true;
    scene.add(arenaFloor);

    const postCount = 24;
    const postHeight = 1.8;
    const postGeo = new THREE.BoxGeometry(0.2, postHeight, 0.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, flatShading: true });

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * ARENA_RADIUS;
      const z = Math.sin(angle) * ARENA_RADIUS;
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(x, postHeight / 2 + 0.2, z);
      post.castShadow = true;
      scene.add(post);
    }

    const segments = 64;
    for (let level = 0; level < 4; level++) {
      const y = 0.5 + level * 0.45;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * ARENA_RADIUS;
        const z = Math.sin(angle) * ARENA_RADIUS;
        points.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, segments, 0.06, 4, true);
      const rail = new THREE.Mesh(tubeGeo, woodMat);
      scene.add(rail);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = Math.PI / 3;
    controls.minAzimuthAngle = -Math.PI;
    controls.maxAzimuthAngle = Math.PI;
    const startDistance = camera.position.length();
    controls.minDistance = startDistance * 0.5;
    controls.maxDistance = startDistance;

    const createRooster = (startX: number, startZ: number, color: number, name: string): RoosterModel => {
      const group = new THREE.Group();

      const bodyGeo = new THREE.SphereGeometry(0.35, 5, 5);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color, 
        flatShading: true,
        metalness: 0.4,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.15
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1, 1.3, 1);
      body.castShadow = true;
      group.add(body);

      const neckGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 5);
      const neckMat = new THREE.MeshStandardMaterial({ 
        color, 
        flatShading: true,
        metalness: 0.4,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.15
      });
      const neck = new THREE.Mesh(neckGeo, neckMat);
      neck.position.set(0, 0.35, 0.1);
      neck.rotation.x = 0.3;
      group.add(neck);

      const headGeo = new THREE.SphereGeometry(0.18, 6, 6);
      const headMat = new THREE.MeshStandardMaterial({ 
        color, 
        flatShading: true,
        metalness: 0.4,
        roughness: 0.3,
        emissive: color,
        emissiveIntensity: 0.15
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.scale.set(1, 0.9, 1.1);
      head.position.set(0, 0.55, 0.2);
      head.castShadow = true;
      group.add(head);

      // Attach beak, comb, wattle to head so they move together
      const beakGeo = new THREE.ConeGeometry(0.08, 0.18, 3);
      const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      const beak = new THREE.Mesh(beakGeo, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0, 0.15); // Relative to head
      head.add(beak);

      const combGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);
      const combMat = new THREE.MeshStandardMaterial({ color: 0xff0000, flatShading: true });
      const comb = new THREE.Mesh(combGeo, combMat);
      comb.position.set(0, 0.15, 0); // Relative to head
      head.add(comb);

      const wattleGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const wattle = new THREE.Mesh(wattleGeo, combMat);
      wattle.scale.set(0.8, 1.2, 0.6);
      wattle.position.set(0, -0.1, 0.08); // Relative to head
      head.add(wattle);

      const tailGeo = new THREE.ConeGeometry(0.25, 0.6, 4);
      const tailMat = new THREE.MeshStandardMaterial({ 
        color, 
        flatShading: true,
        metalness: 0.5,
        roughness: 0.2,
        emissive: color,
        emissiveIntensity: 0.2
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.rotation.x = -Math.PI / 3;
      tail.position.set(0, 0.3, -0.35);
      group.add(tail);

      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 4);
      const legMat = new THREE.MeshStandardMaterial({ color: 0xffa500, flatShading: true });
      const leg1 = new THREE.Mesh(legGeo, legMat);
      leg1.position.set(-0.12, -0.55, 0);
      group.add(leg1);

      const leg2 = new THREE.Mesh(legGeo, legMat);
      leg2.position.set(0.12, -0.55, 0);
      group.add(leg2);

      const basePosition = new THREE.Vector3(startX, 0.8, startZ);
      group.position.copy(basePosition);
      group.castShadow = true;
      scene.add(group);

      // Create name sprite
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 512;
      canvas.height = 128;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = 'bold 72px Arial';
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.lineWidth = 8;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.strokeText(name, canvas.width / 2, canvas.height / 2);
      context.fillText(name, canvas.width / 2, canvas.height / 2);
      
      const nameTexture = new THREE.CanvasTexture(canvas);
      const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
      const nameSprite = new THREE.Sprite(nameMaterial);
      nameSprite.scale.set(1.8, 0.45, 1);
      nameSprite.position.set(0, 1.9, 0);
      scene.add(nameSprite);

      return {
        group,
        body,
        bodyMaterial: bodyMat,
        head,
        neck,
        tail,
        leg1,
        leg2,
        bobPhase: 0,
        walkPhase: 0,
        actionState: 'circling',
        actionTimer: 0,
        health: 100,
        aggression: 0.5 + Math.random() * 0.5,
        stamina: 100,
        lastHitTime: 0,
        basePosition,
        bodyRest: body.rotation.clone(),
        neckRest: neck.rotation.clone(),
        tailRest: tail.rotation.clone(),
        headRest: head.position.clone(),
        isLoser: false,
        loserFallPosition: null,
        nameSprite,
      };
    };

    const cock1Color = getCockColor(cock1.templateId);
    const cock2Color = getCockColor(cock2.templateId);
    const rooster1 = createRooster(-2.5, 0, cock1Color, cock1.name);
    const rooster2 = createRooster(2.5, 0, cock2Color, cock2.name);
    roostersRef.current = [rooster1, rooster2];

    const animate = () => {
      const now = Date.now();
      const currentPhase = phaseRef.current;
      const healthState = healthRef.current;
      const koState = knockoutRef.current;

      roostersRef.current.forEach((rooster, index) => {
        const opponent = roostersRef.current[1 - index];
        if (!opponent) return;

        rooster.head.position.copy(rooster.headRest);
        rooster.neck.rotation.copy(rooster.neckRest);
        rooster.body.rotation.copy(rooster.bodyRest);
        rooster.tail.rotation.copy(rooster.tailRest);

        const isLoser = !!koState && (index === 0 ? cock1.id : cock2.id) === koState.loserId;
        rooster.isLoser = isLoser;
        if (isLoser && !rooster.loserFallPosition) {
          rooster.loserFallPosition = rooster.group.position.clone();
        }
        
        // Reset loser state when starting a new round (facing phase)
        // BUT NOT when the entire fight is finished
        if (currentPhase === 'facing' && phaseRef.current !== 'finished') {
          rooster.isLoser = false;
          rooster.loserFallPosition = null;
          rooster.group.rotation.z = 0;
          rooster.group.position.y = 0.8;
        }
        
        // Only clear fall position if not in finished state
        if (!isLoser && currentPhase !== 'finished') {
          rooster.loserFallPosition = null;
        }

        const toOpponentX = opponent.group.position.x - rooster.group.position.x;
        const toOpponentZ = opponent.group.position.z - rooster.group.position.z;
        const distToOpponent = Math.max(0.0001, Math.sqrt(toOpponentX ** 2 + toOpponentZ ** 2));

        // Add subtle shimmer/holographic effect
        const baseColor = rooster.bodyMaterial.color;
        const shimmerIntensity = 0.15 + Math.sin(now * 0.003 + index) * 0.05;
        rooster.bodyMaterial.emissiveIntensity = shimmerIntensity;

        if (currentPhase === 'fighting') {
          rooster.actionTimer -= 1;
          rooster.stamina = Math.min(100, rooster.stamina + 0.2);

          if (rooster.actionTimer <= 0) {
            const rand = Math.random();
            const isClose = distToOpponent < 1.8;
            const hasStamina = rooster.stamina > 40;
            const opponentAttacking = ['attacking', 'charging', 'jumping_attack', 'pecking', 'wing_slap', 'counterattack'].includes(
              opponent.actionState
            );

            if (opponentAttacking && rand < 0.6 && hasStamina) {
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
              rooster.actionState = 'charging';
              rooster.actionTimer = 30 + Math.random() * 20;
              rooster.stamina -= 5;
            } else if (distToOpponent > 1.5 && distToOpponent < 3) {
              rooster.actionState = 'circling';
              rooster.actionTimer = 25 + Math.random() * 25;
            } else if (!hasStamina) {
              rooster.actionState = 'recovering';
              rooster.actionTimer = 40;
            } else {
              rooster.actionState = 'circling';
              rooster.actionTimer = 30;
            }
          }

          const speed = 0.045;
          const minDistance = 0.85;

          if (distToOpponent < minDistance) {
            const pushDir = normalizeDir(-toOpponentX, -toOpponentZ);
            const pushStrength = (minDistance - distToOpponent) / minDistance;
            rooster.group.position.x += pushDir.x * pushStrength * 0.08;
            rooster.group.position.z += pushDir.z * pushStrength * 0.08;
          }

          switch (rooster.actionState) {
            case 'circling': {
              const circleDir = index === 0 ? 1 : -1;
              const perpX = -toOpponentZ / distToOpponent;
              const perpZ = toOpponentX / distToOpponent;
              rooster.group.position.x += perpX * speed * circleDir * 1.5 + (toOpponentX / distToOpponent) * speed * 0.4;
              rooster.group.position.z += perpZ * speed * circleDir * 1.5 + (toOpponentZ / distToOpponent) * speed * 0.4;
              rooster.walkPhase += 0.25;
              rooster.bobPhase += 0.18;
              rooster.group.position.y = 0.8 + Math.abs(Math.sin(rooster.bobPhase)) * 0.08;
              rooster.neck.rotation.x = rooster.neckRest.x + Math.sin(rooster.bobPhase) * 0.1;
              rooster.tail.rotation.x = rooster.tailRest.x + Math.sin(rooster.bobPhase * 0.5) * 0.1;
              break;
            }
            case 'charging': {
              const dir = normalizeDir(toOpponentX, toOpponentZ);
              rooster.group.position.x += dir.x * speed * 2.5;
              rooster.group.position.z += dir.z * speed * 2.5;
              rooster.walkPhase += 0.6;
              rooster.bobPhase += 0.4;
              rooster.group.position.y = 0.8 + Math.abs(Math.sin(rooster.bobPhase)) * 0.15;
              rooster.body.rotation.x = rooster.bodyRest.x - 0.3;
              rooster.neck.rotation.x = rooster.neckRest.x - 0.2;
              break;
            }
            case 'jumping_attack': {
              const jumpPhase = (25 - rooster.actionTimer) / 25;
              rooster.group.position.y = 0.8 + Math.sin(jumpPhase * Math.PI) * 1.2;
              rooster.group.rotation.x = Math.sin(jumpPhase * Math.PI) * 0.6;
              rooster.leg1.rotation.x = Math.cos(jumpPhase * Math.PI * 2) * 1.2;
              rooster.leg2.rotation.x = -Math.cos(jumpPhase * Math.PI * 2) * 1.2;
              rooster.neck.rotation.x = rooster.neckRest.x + 0.2;
              if (jumpPhase < 0.5) {
                const moveDir = normalizeDir(toOpponentX, toOpponentZ);
                rooster.group.position.x += moveDir.x * speed * 1.5;
                rooster.group.position.z += moveDir.z * speed * 1.5;
              }
              if (jumpPhase > 0.4 && jumpPhase < 0.6 && distToOpponent < 1.2) {
                opponent.lastHitTime = now;
              }
              break;
            }
            case 'pecking': {
              const peckPhase = ((20 - rooster.actionTimer) % 7) / 7;
              const peckAmount = Math.sin(peckPhase * Math.PI);
              rooster.head.position.z = rooster.headRest.z + peckAmount * 0.25;
              rooster.head.position.y = rooster.headRest.y - peckAmount * 0.15;
              rooster.neck.rotation.x = rooster.neckRest.x + peckAmount * 0.45;
              rooster.body.rotation.x = rooster.bodyRest.x + peckAmount * 0.15;
              if (peckPhase > 0.5 && distToOpponent < 1.0) {
                opponent.lastHitTime = now;
              }
              if (distToOpponent > 0.8) {
                const moveDir = normalizeDir(toOpponentX, toOpponentZ);
                rooster.group.position.x += moveDir.x * speed * 0.5;
                rooster.group.position.z += moveDir.z * speed * 0.5;
              }
              break;
            }
            case 'wing_slap': {
              const slapPhase = (18 - rooster.actionTimer) / 18;
              rooster.body.rotation.z = rooster.bodyRest.z + Math.sin(slapPhase * Math.PI * 2) * 0.5;
              rooster.neck.rotation.z = rooster.neckRest.z + Math.sin(slapPhase * Math.PI * 2) * 0.3;
              if (slapPhase > 0.3 && slapPhase < 0.7 && distToOpponent < 1.1) {
                opponent.lastHitTime = now;
              }
              break;
            }
            case 'counterattack': {
              const counterPhase = (15 - rooster.actionTimer) / 15;
              rooster.group.position.y = 0.8 + Math.sin(counterPhase * Math.PI) * 0.7;
              rooster.leg1.rotation.x = Math.sin(counterPhase * Math.PI * 2) * 0.9;
              rooster.leg2.rotation.x = -Math.sin(counterPhase * Math.PI * 2) * 0.9;
              rooster.body.rotation.x = rooster.bodyRest.x - Math.sin(counterPhase * Math.PI) * 0.4;
              if (counterPhase > 0.4 && counterPhase < 0.6 && distToOpponent < 1.3) {
                opponent.lastHitTime = now;
              }
              break;
            }
            case 'dodging': {
              const dodgeDir = index === 0 ? 1 : -1;
              const backDir = normalizeDir(-toOpponentX, -toOpponentZ);
              const sideDir = normalizeDir(-toOpponentZ, toOpponentX);
              rooster.group.position.x += backDir.x * speed * 2 + sideDir.x * speed * dodgeDir * 1.5;
              rooster.group.position.z += backDir.z * speed * 2 + sideDir.z * speed * dodgeDir * 1.5;
              rooster.walkPhase += 0.4;
              rooster.bobPhase += 0.3;
              rooster.body.rotation.z = rooster.bodyRest.z + dodgeDir * 0.2;
              break;
            }
            case 'recovering': {
              rooster.bobPhase += 0.1;
              rooster.body.rotation.x = rooster.bodyRest.x + Math.sin(rooster.bobPhase) * 0.05;
              rooster.neck.rotation.x = rooster.neckRest.x + 0.1;
              if (distToOpponent < 2.5) {
                const backDir = normalizeDir(-toOpponentX, -toOpponentZ);
                rooster.group.position.x += backDir.x * speed * 0.5;
                rooster.group.position.z += backDir.z * speed * 0.5;
              }
              break;
            }
            default:
              break;
          }

          if (['circling', 'charging', 'dodging', 'recovering'].includes(rooster.actionState)) {
            rooster.leg1.rotation.x = Math.sin(rooster.walkPhase) * 0.5;
            rooster.leg2.rotation.x = Math.sin(rooster.walkPhase + Math.PI) * 0.5;
          }

          if (['circling', 'charging'].includes(rooster.actionState)) {
            rooster.head.position.z = rooster.headRest.z + Math.sin(rooster.walkPhase * 2) * 0.06;
          }

          if (!['wing_slap', 'dodging'].includes(rooster.actionState)) {
            rooster.body.rotation.z = rooster.bodyRest.z;
            rooster.neck.rotation.z = rooster.neckRest.z;
          }
          if (!['charging', 'pecking', 'counterattack', 'jumping_attack'].includes(rooster.actionState)) {
            rooster.body.rotation.x = rooster.bodyRest.x;
          }
          if (rooster.actionState !== 'jumping_attack') {
            rooster.group.rotation.x = 0;
          }

          const angleToOpponent = Math.atan2(toOpponentX, toOpponentZ);
          rooster.group.rotation.y = angleToOpponent;

          // Flash red temporarily when taking damage (200ms flash)
          const timeSinceHit = now - opponent.lastHitTime;
          if (timeSinceHit < 200) {
            opponent.bodyMaterial.emissive = new THREE.Color(0xff0000);
            opponent.bodyMaterial.emissiveIntensity = 0.8;
            const push = normalizeDir(toOpponentX, toOpponentZ);
            opponent.group.position.x -= push.x * 0.1;
            opponent.group.position.z -= push.z * 0.1;
          } else {
            // Reset to normal color after flash
            const originalColor = index === 0 ? cock2Color : cock1Color;
            opponent.bodyMaterial.emissive = new THREE.Color(originalColor);
            opponent.bodyMaterial.emissiveIntensity = shimmerIntensity;
          }
        } else {
          rooster.actionState = 'idle';
          rooster.actionTimer = 0;
          rooster.stamina = Math.min(100, rooster.stamina + 0.5);

          const idleTarget = rooster.basePosition.clone();

          if (currentPhase === 'facing') {
            idleTarget.x = index === 0 ? -1.4 : 1.4;
            idleTarget.z = 0;
          }

          if (currentPhase === 'between') {
            idleTarget.copy(rooster.basePosition);
          }

          if (currentPhase === 'finished' && rooster.isLoser) {
            const fallPos = rooster.loserFallPosition ?? rooster.group.position.clone();
            idleTarget.copy(fallPos);
            rooster.group.rotation.z = THREE.MathUtils.lerp(rooster.group.rotation.z, index === 0 ? -Math.PI / 2 : Math.PI / 2, 0.15);
            rooster.group.position.y = THREE.MathUtils.lerp(rooster.group.position.y, 0.35, 0.15);
          } else if (currentPhase === 'finished') {
            idleTarget.copy(rooster.basePosition);
            rooster.tail.rotation.x = rooster.tailRest.x - Math.PI / 8;
            rooster.head.position.y = rooster.headRest.y + 0.08;
          } else {
            rooster.group.rotation.z = THREE.MathUtils.lerp(rooster.group.rotation.z, 0, 0.12);
          }

          const lerpFactor = currentPhase === 'between' ? 0.12 : 0.08;
          rooster.group.position.x = THREE.MathUtils.lerp(rooster.group.position.x, idleTarget.x, lerpFactor);
          rooster.group.position.z = THREE.MathUtils.lerp(rooster.group.position.z, idleTarget.z, lerpFactor);

          const hoverAmplitude = rooster.isLoser && currentPhase === 'finished' ? 0 : Math.abs(Math.sin(now * 0.002 + index)) * 0.04;
          const targetY = idleTarget.y + hoverAmplitude;
          rooster.group.position.y = THREE.MathUtils.lerp(rooster.group.position.y, targetY, 0.12);

          if (!(currentPhase === 'finished' && rooster.isLoser)) {
            rooster.walkPhase += currentPhase === 'between' ? 0.25 : 0.1;
            rooster.leg1.rotation.x = Math.sin(rooster.walkPhase + index) * 0.25;
            rooster.leg2.rotation.x = Math.sin(rooster.walkPhase + index + Math.PI) * 0.25;
            rooster.head.position.z = rooster.headRest.z + Math.sin(now * 0.002 + index) * 0.05;
          } else {
            rooster.leg1.rotation.x = 0;
            rooster.leg2.rotation.x = 0;
            rooster.head.position.copy(rooster.headRest);
          }

          if (!(currentPhase === 'finished' && rooster.isLoser)) {
            const angleToOpponent = Math.atan2(toOpponentX, toOpponentZ);
            rooster.group.rotation.y = angleToOpponent;
          }
        }

        const healthTarget = index === 0 ? healthState.cock1 : healthState.cock2;
        const healthScale = Math.max(0.15, healthTarget / 100);
        rooster.body.scale.set(1, 1.3 + (1 - healthScale) * 0.2, 1);

        // Update name sprite position - keep it above the rooster even when dead
        const nameHeight = rooster.isLoser && currentPhase === 'finished' ? 1.2 : 1.9;
        rooster.nameSprite.position.set(
          rooster.group.position.x,
          rooster.group.position.y + nameHeight,
          rooster.group.position.z
        );

        const distFromCenter = Math.sqrt(rooster.group.position.x ** 2 + rooster.group.position.z ** 2);
        if (distFromCenter > ARENA_RADIUS - 0.8) {
          const angle = Math.atan2(rooster.group.position.z, rooster.group.position.x);
          rooster.group.position.x = Math.cos(angle) * (ARENA_RADIUS - 0.8);
          rooster.group.position.z = Math.sin(angle) * (ARENA_RADIUS - 0.8);
        }
      });

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = mountRef.current.clientWidth || window.innerWidth;
      const newHeight = mountRef.current.clientHeight || window.innerHeight;
      rendererRef.current.setSize(newWidth, newHeight);
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else {
            material.dispose();
          }
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      roostersRef.current = [];
      rendererRef.current = undefined;
      cameraRef.current = undefined;
      animationRef.current = undefined;
    };
  }, [cock1?.id, cock2?.id]);

  if (!cock1 || !cock2) {
    return <div className="w-full h-full bg-black/40" />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {countdown !== null && countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            key={countdown}
            className="countdown-scale text-6xl font-black text-red-500 drop-shadow-[0_0_16px_rgba(239,68,68,0.7)] sm:text-7xl"
          >
            {countdown}
          </span>
        </div>
      )}
    </div>
  );
};

export default CockfightArena;
