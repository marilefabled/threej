import * as THREE from 'three';

// Prison "backgrounds" built from primitives — ported from GhostJail3D
// (LocationBuilder3D.ts), plain JS. buildLocation(id) -> { objects, fogColor,
// fogDensity, floorColor }. Each room's FLOOR sits at y=0 so a figure standing
// at y=0 rests on it (the original centered the room box; this aligns it with
// the furniture, which is all modeled for a floor at y=0).

function box(w, h, d, color, x = 0, y = 0, z = 0, emissive = 0x000000, emissiveIntensity = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.85, metalness: 0.1 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(rt, rb, h, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// Enclosing room. Floor face placed at y=0, ceiling at y=h.
function room(w, h, d, wallColor, floorColor) {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.BackSide });
  const roomMat = [
    mat(wallColor), mat(wallColor),
    mat(floorColor), mat(0x111111),
    mat(wallColor), mat(wallColor),
  ];
  const roomMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), roomMat);
  roomMesh.position.y = h / 2;   // raise so the floor face lands at y=0
  roomMesh.receiveShadow = true;
  return [roomMesh];
}

function cellBars(count, height, color, offsetX = 0, z = 0) {
  const bars = [];
  const spacing = 0.45;
  const total = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    const x = offsetX - total / 2 + i * spacing;
    bars.push(cylinder(0.06, 0.06, height, color, x, height / 2, z));
  }
  bars.push(box(total + 0.5, 0.08, 0.08, color, offsetX, height, z));
  bars.push(box(total + 0.5, 0.08, 0.08, color, offsetX, 0.04, z));
  return bars;
}

function bunkBed(x, y, z) {
  const wood = 0x3a2510;
  const metal = 0x445566;
  return [
    box(1.0, 0.08, 2.0, wood, x, y + 0.5, z),
    box(1.0, 0.08, 2.0, wood, x, y + 1.3, z),
    cylinder(0.04, 0.04, 1.4, metal, x - 0.46, y + 0.7, z - 0.9),
    cylinder(0.04, 0.04, 1.4, metal, x + 0.46, y + 0.7, z - 0.9),
    cylinder(0.04, 0.04, 1.4, metal, x - 0.46, y + 0.7, z + 0.9),
    cylinder(0.04, 0.04, 1.4, metal, x + 0.46, y + 0.7, z + 0.9),
    box(0.9, 0.08, 1.9, 0x334455, x, y + 0.58, z),
    box(0.9, 0.08, 1.9, 0x334455, x, y + 1.38, z),
  ];
}

function cafeteriaTable(x, z) {
  const metal = 0x667788;
  const tray = 0x556677;
  return [
    box(2.4, 0.06, 0.7, metal, x, 0.75, z),
    cylinder(0.04, 0.04, 0.74, metal, x - 1.0, 0.37, z),
    cylinder(0.04, 0.04, 0.74, metal, x + 1.0, 0.37, z),
    box(0.3, 0.02, 0.22, tray, x - 0.7, 0.79, z - 0.1),
    box(0.3, 0.02, 0.22, tray, x + 0.7, 0.79, z - 0.1),
    box(2.4, 0.05, 0.28, metal, x, 0.44, z + 0.45),
    box(2.4, 0.05, 0.28, metal, x, 0.44, z - 0.45),
  ];
}

function bookshelf(x, z) {
  const wood = 0x2a1c0a;
  const book1 = 0x334455;
  const book2 = 0x553322;
  const book3 = 0x225533;
  return [
    box(0.8, 1.8, 0.3, wood, x, 0.9, z),
    box(0.7, 0.04, 0.28, wood, x, 0.38, z),
    box(0.7, 0.04, 0.28, wood, x, 0.78, z),
    box(0.7, 0.04, 0.28, wood, x, 1.18, z),
    box(0.7, 0.04, 0.28, wood, x, 1.58, z),
    box(0.1, 0.32, 0.22, book1, x - 0.28, 0.59, z),
    box(0.08, 0.28, 0.22, book2, x - 0.18, 0.57, z),
    box(0.1, 0.34, 0.22, book3, x - 0.08, 0.60, z),
    box(0.09, 0.30, 0.22, book1, x + 0.04, 0.58, z),
  ];
}

// The selectable locations, in menu order
export const LOCATIONS = [
  { id: 'cell_block_a', name: 'Cell Block A' },
  { id: 'cell_block_b', name: 'Cell Block B' },
  { id: 'yard',         name: 'Yard' },
  { id: 'cafeteria',    name: 'Cafeteria' },
  { id: 'library',      name: 'Library' },
  { id: 'infirmary',    name: 'Infirmary' },
  { id: 'solitary',     name: 'Solitary' },
  { id: 'underground',  name: 'Underground' },
  { id: 'warden_office', name: "Warden's Office" },
];

export function buildLocation(locationId) {
  const objects = [];

  switch (locationId) {
    case 'cell_block_a':
    case 'cell_block_b':
    case 'cell': {
      const wallColor = locationId === 'cell_block_b' ? 0x1a1a2a : 0x1e2030;
      const floorColor = 0x141820;
      objects.push(...room(8, 4, 10, wallColor, floorColor));
      objects.push(...cellBars(12, 3.2, 0x445566, 0, -4.8));
      objects.push(...cellBars(12, 3.2, 0x445566, 0, 4.8));
      objects.push(...bunkBed(-2.5, 0, 2));
      objects.push(...bunkBed(2.5, 0, 2));
      objects.push(box(1.2, 0.08, 0.3, 0x667788, 0, 3.88, 0, 0xaabbcc, 0.5));
      return { objects, fogColor: new THREE.Color(0x080c14), fogDensity: 0.18, floorColor };
    }

    case 'yard': {
      const floorColor = 0x1a1c14;
      objects.push(...room(18, 6, 18, 0x1a1e28, floorColor));
      for (let i = -4; i <= 4; i++) {
        objects.push(cylinder(0.04, 0.04, 5.5, 0x445566, i * 2, 2.75, -8.5));
        objects.push(cylinder(0.04, 0.04, 5.5, 0x445566, i * 2, 2.75, 8.5));
      }
      objects.push(cylinder(0.07, 0.07, 4.0, 0x334455, 5, 2.0, -6));
      objects.push(box(1.0, 0.06, 0.6, 0x445566, 5, 4.1, -6.3));
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.025, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.6 })
      );
      hoop.position.set(5, 3.9, -6.6);
      hoop.rotation.x = Math.PI / 2;
      objects.push(hoop);
      return { objects, fogColor: new THREE.Color(0x060810), fogDensity: 0.08, floorColor };
    }

    case 'cafeteria': {
      const floorColor = 0x151816;
      objects.push(...room(14, 4, 12, 0x1c1e20, floorColor));
      objects.push(...cafeteriaTable(-4, -2));
      objects.push(...cafeteriaTable(0, -2));
      objects.push(...cafeteriaTable(4, -2));
      objects.push(...cafeteriaTable(-4, 2));
      objects.push(...cafeteriaTable(0, 2));
      objects.push(...cafeteriaTable(4, 2));
      objects.push(box(3.0, 0.06, 0.15, 0x334455, -3, 3.9, 0, 0xaaccbb, 0.6));
      objects.push(box(3.0, 0.06, 0.15, 0x334455, 3, 3.9, 0, 0xaaccbb, 0.6));
      return { objects, fogColor: new THREE.Color(0x0a0c0a), fogDensity: 0.14, floorColor };
    }

    case 'library': {
      const floorColor = 0x120e08;
      objects.push(...room(12, 4, 10, 0x1a140c, floorColor));
      objects.push(...bookshelf(-4.5, -3));
      objects.push(...bookshelf(-4.5, 0));
      objects.push(...bookshelf(-4.5, 3));
      objects.push(...bookshelf(4.5, -3));
      objects.push(...bookshelf(4.5, 0));
      objects.push(box(2.0, 0.06, 1.2, 0x2a1c0a, 0, 0.75, 0));
      objects.push(cylinder(0.04, 0.04, 0.74, 0x222222, -0.9, 0.37, 0));
      objects.push(cylinder(0.04, 0.04, 0.74, 0x222222, 0.9, 0.37, 0));
      objects.push(box(0.2, 0.24, 0.02, 0x334455, 0.1, 0.9, -0.2));
      return { objects, fogColor: new THREE.Color(0x0a0804), fogDensity: 0.16, floorColor };
    }

    case 'infirmary': {
      const floorColor = 0x161818;
      objects.push(...room(10, 4, 10, 0x1e2020, floorColor));
      for (let i = -1; i <= 1; i++) {
        objects.push(box(0.9, 0.18, 2.0, 0x334444, i * 3, 0.55, -1));
        objects.push(box(0.85, 0.12, 1.85, 0xaabbaa, i * 3, 0.67, -1));
        objects.push(box(0.6, 0.08, 0.4, 0xbbccbb, i * 3, 0.73, -1.7));
      }
      objects.push(box(3.0, 0.06, 0.15, 0x334455, 0, 3.9, 0, 0xccdddd, 0.8));
      return { objects, fogColor: new THREE.Color(0x080c0c), fogDensity: 0.14, floorColor };
    }

    case 'solitary': {
      const floorColor = 0x0c0c10;
      objects.push(...room(4, 3.5, 4, 0x14141c, floorColor));
      objects.push(box(0.9, 0.14, 1.8, 0x1a1a22, 0, 0.07, 0.5));
      objects.push(box(0.6, 0.08, 0.04, 0x334466, 0, 2.8, -1.98, 0x6688bb, 1.2));
      return { objects, fogColor: new THREE.Color(0x040408), fogDensity: 0.3, floorColor };
    }

    case 'underground': {
      const floorColor = 0x0c0a08;
      objects.push(...room(10, 3, 14, 0x14100c, floorColor));
      for (let i = -5; i <= 5; i += 2.5) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(1.2, 0.15, 8, 12, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 })
        );
        arch.position.set(0, 1.2, i);
        arch.rotation.y = Math.PI / 2;
        objects.push(arch);
      }
      objects.push(box(0.15, 0.15, 0.08, 0x554433, -4.8, 1.5, -2, 0xffaa44, 0.8));
      objects.push(box(0.15, 0.15, 0.08, 0x554433, 4.8, 1.5, 2, 0xffaa44, 0.8));
      return { objects, fogColor: new THREE.Color(0x08060a), fogDensity: 0.25, floorColor };
    }

    case 'warden_office': {
      const floorColor = 0x140e08;
      objects.push(...room(8, 3.5, 8, 0x1c1610, floorColor));
      objects.push(box(2.0, 0.08, 1.0, 0x2a1c0a, 0, 0.78, -1));
      objects.push(cylinder(0.06, 0.06, 0.78, 0x1a1208, -0.9, 0.39, -0.5));
      objects.push(cylinder(0.06, 0.06, 0.78, 0x1a1208, 0.9, 0.39, -0.5));
      objects.push(box(0.7, 0.06, 0.7, 0x221810, 0, 0.5, 0.3));
      objects.push(box(0.7, 0.7, 0.06, 0x221810, 0, 0.87, 0.63));
      objects.push(...bookshelf(-3.5, -1.5));
      objects.push(box(1.8, 1.2, 0.04, 0x334466, 0, 2.0, -3.98, 0x6688bb, 0.5));
      objects.push(...cellBars(5, 1.2, 0x445566, 0, -3.95));
      return { objects, fogColor: new THREE.Color(0x0c0804), fogDensity: 0.15, floorColor };
    }

    default: {
      const floorColor = 0x141418;
      objects.push(...room(6, 3.5, 12, 0x181820, floorColor));
      objects.push(box(4.0, 0.06, 0.15, 0x334455, 0, 3.45, 0, 0x8899aa, 0.4));
      return { objects, fogColor: new THREE.Color(0x080810), fogDensity: 0.2, floorColor };
    }
  }
}
