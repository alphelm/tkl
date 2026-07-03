import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

const DEG = Math.PI / 180;
const evaluator = new Evaluator();

/* ---------------------------------------------------------------- *
 *  Low-level geometry helpers
 * ---------------------------------------------------------------- */

function cylinderGeo(r, h, segments = 48) {
  const g = new THREE.CylinderGeometry(r, r, h, segments, 1, false);
  g.translate(0, h / 2, 0);
  return g;
}

// solid annulus (ring) extruded vertically, base at y=0, top at y=h
function annulusGeo(rOuter, rInner, h, segments = 64) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(rInner, 0.01), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: segments });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// a fan-blade baffle: a rectangular fin sheared along its length so the
// outer edge leads/trails the inner edge, producing swirl when patterned
// circularly. Spans local x:[0,length], y:[0,height], z centered w/ shear.
function finGeo(length, height, thickness, sweepRad) {
  const g = new THREE.BoxGeometry(length, height, thickness);
  g.translate(length / 2, height / 2, 0);
  const pos = g.attributes.position;
  const shearPerLength = Math.tan(sweepRad);
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, pos.getZ(i) + pos.getX(i) * shearPerLength);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// cylinder whose axis points radially outward from the Y axis at angleRad,
// centered at world distance centerDist along that angle, at height worldY
function radialCylinderGeo(r, h, angleRad, centerDist, worldY, segments = 24) {
  const g = new THREE.CylinderGeometry(r, r, h, segments, 1, false);
  g.rotateZ(-Math.PI / 2);
  g.rotateY(-angleRad);
  g.translate(centerDist * Math.cos(angleRad), worldY, centerDist * Math.sin(angleRad));
  return g;
}

// box whose local Z (depth) axis points radially outward at angleRad
function radialBoxGeo(w, h, d, angleRad, centerDist, worldY) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(Math.PI / 2 - angleRad);
  g.translate(centerDist * Math.cos(angleRad), worldY, centerDist * Math.sin(angleRad));
  return g;
}

function toBrush(geo) {
  const b = new Brush(geo, new THREE.MeshStandardMaterial());
  b.updateMatrixWorld();
  return b;
}

function csg(a, b, op) {
  const brushA = a.isBrush ? a : toBrush(a);
  const brushB = b.isBrush ? b : toBrush(b);
  brushA.updateMatrixWorld();
  brushB.updateMatrixWorld();
  const result = evaluator.evaluate(brushA, brushB, op);
  result.geometry.computeVertexNormals();
  return result;
}

function mergeAll(geos) {
  const clean = geos.filter((g) => g && g.attributes.position.count > 0);
  return mergeGeometries(clean, false);
}

/* ---------------------------------------------------------------- *
 *  Parameter derivation
 * ---------------------------------------------------------------- */

export function deriveParams(input) {
  const p = { ...input };

  p.colanderR = p.colanderOD / 2;
  p.colanderLipOD = input.colanderLipOD || input.colanderOD + 14;
  p.colanderLipR = p.colanderLipOD / 2;

  p.boxOD = p.colanderLipOD + 2 * p.wallT;
  p.boxR = p.boxOD / 2;

  p.seatDepth = p.colanderLipThk + 2;
  p.seatR = p.colanderLipR + 0.3;

  p.vacPortAngleRad = 0; // reference angle: "the vac side"
  p.spigotOD = p.vacHoseID - 0.3; // default friction-fit calibration
  p.spigotR = p.spigotOD / 2;
  p.portWallT = 2.5;
  p.boreR = Math.max(p.spigotR - p.portWallT, 6);
  p.portLength = 25;

  p.hubR = 10;
  p.diffuserZ = Math.min(p.boxHeight - 20, Math.max(p.floorT + 20, p.boxHeight * 0.5));
  p.spokeSweepDeg = 20;

  p.diffuserR = p.colanderR - 1.2;
  p.diffuserPlateT = 3;

  p.domeBaseR = p.boxR + 0.2; // slip-fit skirt over box rim OD
  p.domeSkirtH = 15;
  p.domeSkirtTop = p.domeSkirtH;
  p.inletAngleRad = Math.PI; // 180 deg opposite vac port

  p.warnings = [];
  if (p.wallT < 3) p.warnings.push('Wall thickness is below the 3 mm minimum for rigidity.');
  if (p.boreR < 8) p.warnings.push('Vac port bore is quite narrow for this hose size — check airflow.');
  if (p.diffuserR < p.hubR + 30) p.warnings.push('Colander is very small relative to the hub/port geometry.');

  return p;
}

/* ---------------------------------------------------------------- *
 *  Component 1 — Base Box
 * ---------------------------------------------------------------- */

export function buildBaseBox(p) {
  // shell: floor disc + wall annulus, fused with a 1mm overlap so the
  // union is a genuine solid merge rather than two coincident faces
  const floor = cylinderGeo(p.boxR, p.floorT);
  const wallH = p.boxHeight - p.floorT + 1;
  const wall = annulusGeo(p.boxR, p.boxR - p.wallT, wallH);
  wall.translate(0, p.floorT - 1, 0);
  let brush = csg(floor, wall, ADDITION);

  // colander seat counterbore
  const seatCut = cylinderGeo(p.seatR, p.seatDepth + 4);
  seatCut.translate(0, p.boxHeight - p.seatDepth, 0);
  brush = csg(brush, seatCut, SUBTRACTION);

  // vac port boss + bore
  const bossInner = p.boxR - p.wallT - 6;
  const bossOuter = p.boxR + p.portLength;
  const bossLen = bossOuter - bossInner;
  const bossCenter = (bossInner + bossOuter) / 2;
  const boss = radialCylinderGeo(p.spigotR, bossLen, p.vacPortAngleRad, bossCenter, p.vacPortCenterZ);
  brush = csg(brush, boss, ADDITION);

  const boreLen = bossLen + 12;
  const boreCenter = bossCenter + 2;
  const bore = radialCylinderGeo(p.boreR, boreLen, p.vacPortAngleRad, boreCenter, p.vacPortCenterZ);
  brush = csg(brush, bore, SUBTRACTION);

  // interior spoke baffles (angled fan blades, swirl toward the port)
  const finLen = p.boxR - p.wallT - 2 - p.hubR;
  const finHeight = Math.max(10, p.diffuserZ - p.floorT - 5);
  const finGeos = [];
  for (let i = 0; i < p.spokeCount; i++) {
    const angle = (i * 2 * Math.PI) / p.spokeCount;
    // +1mm height and -1mm start so the fin bites into the floor
    // instead of merely touching it (clean CSG union)
    const g = finGeo(finLen, finHeight + 1, p.wallT, p.spokeSweepDeg * DEG);
    g.translate(p.hubR, p.floorT - 1, 0);
    g.rotateY(angle);
    finGeos.push(g);
  }
  const finsMerged = mergeAll(finGeos);
  if (finsMerged) brush = csg(brush, finsMerged, ADDITION);

  // diffuser support shoulder — anchored to the inner wall (with a 1mm
  // bite into it for a clean union), inner edge sized so the diffuser
  // plate rests on a ~2mm ledge instead of falling through
  const shoulderOuterR = p.boxR - p.wallT + 1;
  const shoulderInnerR = p.diffuserR - 2;
  const shoulder = annulusGeo(shoulderOuterR, shoulderInnerR, 3);
  shoulder.translate(0, p.diffuserZ, 0);
  brush = csg(brush, shoulder, ADDITION);

  return finalizeBrush(brush, 0xb8763f); // roast-copper
}

/* ---------------------------------------------------------------- *
 *  Component 2 — Dome Cover
 * ---------------------------------------------------------------- */

function domeProfile(t, p) {
  // t in [0, PI/2]: 0 = base of dome curve (skirt top), PI/2 = apex
  const r = p.domeBaseR * Math.cos(t);
  const y = p.domeSkirtTop + p.domeRise * Math.sin(t);
  return { r, y };
}

export function buildDomeCover(p) {
  const steps = 20;
  const pts = [];
  const innerR0 = p.domeBaseR - p.wallT;
  const innerRise = p.domeRise - p.wallT;

  pts.push(new THREE.Vector2(p.domeBaseR, 0));
  pts.push(new THREE.Vector2(p.domeBaseR, p.domeSkirtTop));
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(p.domeBaseR * Math.cos(t), p.domeSkirtTop + p.domeRise * Math.sin(t)));
  }
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(innerR0 * Math.cos(t), 0.01), p.domeSkirtTop + innerRise * Math.sin(t)));
  }
  pts.push(new THREE.Vector2(innerR0, 0));

  const latheGeo = new THREE.LatheGeometry(pts, 64);

  let brush = toBrush(latheGeo);
  brush.geometry.computeVertexNormals();

  // directional inlet slot, opposite the vac port
  const slotY = p.domeSkirtTop * 0.6 + 6;
  const slot = radialBoxGeo(60, 15, p.wallT + 8, p.inletAngleRad, p.domeBaseR, slotY);
  brush = csg(brush, slot, SUBTRACTION);

  // internal deflector fin angled down/inward off the slot — biased
  // outward so its root genuinely overlaps the shell (clean union)
  // even after the downward tilt shortens its effective radial reach
  const fin = new THREE.BoxGeometry(50, 2, 30);
  fin.rotateX(-35 * DEG);
  fin.rotateY(Math.PI / 2 - p.inletAngleRad);
  const finDist = p.domeBaseR - p.wallT - 8;
  fin.translate(finDist * Math.cos(p.inletAngleRad), slotY + 10, finDist * Math.sin(p.inletAngleRad));
  brush = csg(brush, fin, ADDITION);

  // crown vents biased toward the vac-port side, to help loft chaff
  // into the downward airflow before it settles
  const ventCount = 8;
  const arc = Math.PI;
  const ventGeos = [];
  const tVent = 0.62 * (Math.PI / 2);
  const { r: ventR, y: ventY } = domeProfile(tVent, p);
  for (let i = 0; i < ventCount; i++) {
    const ang = p.vacPortAngleRad - arc / 2 + ((i + 0.5) * arc) / ventCount;
    const v = radialBoxGeo(18, 5, p.wallT + 6, ang, ventR, ventY);
    ventGeos.push(v);
  }
  const ventsMerged = mergeAll(ventGeos);
  if (ventsMerged) brush = csg(brush, ventsMerged, SUBTRACTION);

  // handle loop near the crown, sized and positioned to actually sit on
  // the real shell surface there (not an arbitrary guessed radius)
  const tHandle = 0.9 * (Math.PI / 2);
  const handlePt = domeProfile(tHandle, p);
  const handle = new THREE.TorusGeometry(Math.max(handlePt.r, 10), p.wallT + 2, 12, 28);
  handle.rotateX(Math.PI / 2);
  handle.translate(0, handlePt.y, 0);
  brush = csg(brush, handle, ADDITION);

  return finalizeBrush(brush, 0x3f7ea6); // blueprint teal-blue
}

/* ---------------------------------------------------------------- *
 *  Component 3 — Interior Diffuser
 * ---------------------------------------------------------------- */

export function buildDiffuserPlate(p) {
  const disc = cylinderGeo(p.diffuserR, p.diffuserPlateT, 72);
  let brush = toBrush(disc);
  brush.geometry.computeVertexNormals();

  // graduated holes: small near the vac port, large on the far side,
  // so suction is balanced across the whole colander surface
  const hubKeep = 15 / 2;
  const rimMargin = 8;
  const rMax = p.diffuserR - rimMargin;
  const minDia = 2.6;
  const maxDia = 7.2;
  const holeGeos = [];
  let r = hubKeep + 7;
  let ring = 0;
  let holeCount = 0;
  const HOLE_BUDGET = 170;
  while (r < rMax && holeCount < HOLE_BUDGET) {
    const avgDia = (minDia + maxDia) / 2;
    const pitch = avgDia * 2.7;
    const circumference = 2 * Math.PI * r;
    const count = Math.max(6, Math.min(Math.floor(circumference / pitch), HOLE_BUDGET - holeCount));
    const angleOffset = (ring % 2) * (Math.PI / count);
    for (let i = 0; i < count; i++) {
      const ang = angleOffset + (i * 2 * Math.PI) / count;
      const angDist = Math.abs(((ang - p.vacPortAngleRad + Math.PI) % (2 * Math.PI)) - Math.PI);
      const t = angDist / Math.PI;
      const dia = minDia + (maxDia - minDia) * t;
      const x = r * Math.cos(ang);
      const z = r * Math.sin(ang);
      const hg = cylinderGeo(dia / 2, p.diffuserPlateT + 4, 10);
      hg.translate(x, -2, z);
      holeGeos.push(hg);
      holeCount++;
    }
    r += pitch * 0.95;
    ring++;
  }
  const holesMerged = mergeAll(holeGeos);
  if (holesMerged) brush = csg(brush, holesMerged, SUBTRACTION);

  // stiffening ribs on the underside, overlapping 1mm up into the plate
  // (plate spans y:[0, diffuserPlateT]) for a clean union
  const ribGeos = [];
  const ribCount = 6;
  for (let i = 0; i < ribCount; i++) {
    const ang = (i * 2 * Math.PI) / ribCount + Math.PI / ribCount;
    const rg = radialBoxGeo(2, 3, p.diffuserR - hubKeep - 2, ang, (p.diffuserR + hubKeep) / 2, -0.5);
    ribGeos.push(rg);
  }
  const ribsMerged = mergeAll(ribGeos);
  if (ribsMerged) brush = csg(brush, ribsMerged, ADDITION);

  return finalizeBrush(brush, 0xc9c2b4); // neutral plate

}

function finalizeBrush(brush, color) {
  const geo = brush.geometry;
  geo.deleteAttribute('uv');
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide })
  );
  mesh.triCount = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  return mesh;
}

/* ---------------------------------------------------------------- *
 *  Model + holeCount metadata for the UI dimension readout
 * ---------------------------------------------------------------- */

export function buildAll(input) {
  const p = deriveParams(input);
  const t0 = performance.now();
  const baseBox = buildBaseBox(p);
  const dome = buildDomeCover(p);
  const diffuser = buildDiffuserPlate(p);
  const ms = performance.now() - t0;
  return { p, baseBox, dome, diffuser, ms };
}

/* ---------------------------------------------------------------- *
 *  STL export
 * ---------------------------------------------------------------- */

const exporter = new STLExporter();

export function meshToSTLBlob(mesh) {
  const result = exporter.parse(mesh, { binary: true });
  return new Blob([result], { type: 'application/sla' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------------------------------------------------------- *
 *  Three.js scene / app wiring
 * ---------------------------------------------------------------- */

export function initScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  camera.position.set(340, 260, 340);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 90, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  const hemi = new THREE.HemisphereLight(0xdce8f5, 0x2a2016, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2df, 1.6);
  key.position.set(220, 320, 180);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 0.55);
  rim.position.set(-260, 120, -220);
  scene.add(rim);

  const grid = new THREE.GridHelper(600, 24, 0x6a8fae, 0x2c4257);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);

  const groups = {
    baseBox: new THREE.Group(),
    dome: new THREE.Group(),
    diffuser: new THREE.Group(),
  };
  scene.add(groups.baseBox, groups.dome, groups.diffuser);

  function setMesh(group, mesh) {
    group.clear();
    if (mesh) group.add(mesh);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function render() {
    resize();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  return { scene, camera, renderer, controls, groups, setMesh };
}
