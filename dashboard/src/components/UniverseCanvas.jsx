import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.15, 'rgba(150,180,255,.9)'); gradient.addColorStop(.46, 'rgba(90,80,255,.24)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}

export default function UniverseCanvas() {
  const mountRef = useRef(null);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return undefined;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x050713, .015);
    const camera = new THREE.PerspectiveCamera(52, 1, .1, 180); camera.position.set(0, 2.3, 18);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.setClearColor(0x02040d, 1); mount.appendChild(renderer.domElement);
    const root = new THREE.Group(); scene.add(root); const universe = new THREE.Group(); root.add(universe);
    const ambient = new THREE.AmbientLight(0x39406b, 1.1); scene.add(ambient);
    const cyanLight = new THREE.PointLight(0x70d7ff, 20, 38, 2); cyanLight.position.set(-4, 4, 4); scene.add(cyanLight);
    const roseLight = new THREE.PointLight(0xa37cff, 18, 34, 2); roseLight.position.set(8, -1, -5); scene.add(roseLight);
    const texture = glowTexture();

    // Deep-field star dust in multiple depth layers.
    const dustGroups = [];
    [900, 520, 250].forEach((count, layer) => { const positions = new Float32Array(count * 3); for (let i = 0; i < count; i += 1) { const radius = 25 + Math.random() * 65; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta); positions[i * 3 + 1] = radius * Math.cos(phi); positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: layer === 1 ? 0x8ea8ff : 0xd8e5ff, size: layer === 2 ? .075 : .045, transparent: true, opacity: layer === 0 ? .5 : .8, map: texture, blending: THREE.AdditiveBlending, depthWrite: false })); points.userData.speed = .002 + layer * .001; scene.add(points); dustGroups.push(points); });

    // Layered nebula sprites create soft, volumetric cosmic clouds without external image assets.
    const nebula = new THREE.Group();
    [[-6, 1, -11, 8, 0x4b36a8, .14], [5, 4, -15, 10, 0x135e9e, .12], [0, -5, -10, 9, 0x8c286d, .1], [9, 1, -18, 12, 0x264f9b, .1]].forEach(([x, y, z, size, color, opacity]) => {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
      cloud.position.set(x, y, z); cloud.scale.set(size, size * .62, 1); nebula.add(cloud);
    });
    universe.add(nebula);

    // Black hole with a dark event horizon and layered accretion torus.
    const blackHole = new THREE.Group(); blackHole.position.set(3.8, 1.1, -3.5); universe.add(blackHole);
    const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000005 })); blackHole.add(horizon);
    [1.45, 1.76, 2.08].forEach((radius, index) => { const disk = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 1 ? .12 : .055, 16, 160), new THREE.MeshBasicMaterial({ color: index === 1 ? 0xffa15e : 0x806cff, transparent: true, opacity: index === 1 ? .8 : .5, blending: THREE.AdditiveBlending })); disk.rotation.x = Math.PI / 2.12; disk.rotation.z = index * .08; blackHole.add(disk); });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 32), new THREE.MeshBasicMaterial({ color: 0x6d63ff, transparent: true, opacity: .065, side: THREE.BackSide, blending: THREE.AdditiveBlending })); blackHole.add(lens);

    // Small planets with atmosphere shells and orbit paths.
    const planets = [];
    [[-5, -1.8, -2, .95, 0x4c89c7], [-6.5, 3.8, -8, 1.8, 0x9865c8], [6.2, -3.6, -5, .7, 0xe29870]].forEach(([x, y, z, size, color], index) => { const group = new THREE.Group(); group.position.set(x, y, z); const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 28, 28), new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .05, emissive: color, emissiveIntensity: .12 })); group.add(planet); const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(size * 1.08, 28, 28), new THREE.MeshBasicMaterial({ color: index === 1 ? 0xc08fff : 0x77d5ed, transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending })); group.add(atmosphere); const orbit = new THREE.Mesh(new THREE.TorusGeometry(size * 1.7, .012, 8, 100), new THREE.MeshBasicMaterial({ color: 0x7d91ec, transparent: true, opacity: .26 })); orbit.rotation.x = index * .46 + .5; orbit.rotation.z = index * .28; group.add(orbit); universe.add(group); planets.push(group); });

    // Instanced asteroid belt for depth and performance.
    const asteroidGroup = new THREE.Group(); const rockGeometry = new THREE.IcosahedronGeometry(.08, 1); const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x7a7792, roughness: 1, metalness: .05 }); const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 230); const matrix = new THREE.Matrix4(); const rotation = new THREE.Euler(); const scale = new THREE.Vector3(); for (let i = 0; i < 230; i += 1) { const angle = Math.random() * Math.PI * 2; const radius = 5.8 + Math.random() * 2.4; const y = (Math.random() - .5) * .85; matrix.makeRotationFromEuler(rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)); matrix.setPosition(Math.cos(angle) * radius, y, Math.sin(angle) * radius - 2); scale.setScalar(.45 + Math.random() * 1.7); matrix.scale(scale); rocks.setMatrixAt(i, matrix); } asteroidGroup.add(rocks); universe.add(asteroidGroup);

    const mouse = new THREE.Vector2(); let scrollProgress = 0; const pointer = (event) => { mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; }; const scroll = () => { scrollProgress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1); }; const resize = () => { const width = mount.clientWidth || window.innerWidth; const height = mount.clientHeight || window.innerHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }; window.addEventListener('pointermove', pointer, { passive: true }); window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', resize); resize(); scroll();
    const clock = new THREE.Clock(); let frame; const animate = () => { const time = clock.getElapsedTime(); camera.position.x += ((mouse.x * .75) - camera.position.x) * .018; camera.position.y += (((2.3 - mouse.y * .5) - camera.position.y) * .018); camera.position.z += ((18 - scrollProgress * 4.2) - camera.position.z) * .012; universe.rotation.y = time * .018 + scrollProgress * .22; universe.rotation.x = scrollProgress * .05; blackHole.rotation.z = time * .12; blackHole.rotation.y = time * .05; planets.forEach((planet, index) => { planet.rotation.y = time * (.04 + index * .018); }); dustGroups.forEach((group, index) => { group.rotation.y = time * group.userData.speed * (index % 2 ? 1 : -1); group.rotation.x = time * group.userData.speed * .45; }); asteroidGroup.rotation.y = time * .055; renderer.render(scene, camera); frame = requestAnimationFrame(animate); }; animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', pointer); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', resize); renderer.dispose(); texture.dispose(); mount.removeChild(renderer.domElement); };
  }, []);
  return <div className="universe-canvas" ref={mountRef} aria-hidden="true" />;
}
