import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DRACO_DECODER_PATH, MODEL_URL } from '../config'
import { COLORS, STATIONS } from './stations'
import { FocusLight, StationLabel, useRockGeometry } from './props'
import { whiteboardTexture } from './textures'
import { Director } from './Director'
import { Path } from './Path'
import { Plan } from './platforms/Plan'
import { Create } from './platforms/Create'
import { Build } from './platforms/Build'
import { Amplify } from './platforms/Amplify'
import { Deliver } from './platforms/Deliver'

/** Each station's platform slab in the export. AMPLIFY borrows DELIVER's. */
const PLATFORM = { plan: 'Cube', create: 'Cube.005', build: 'Cube.007', deliver: 'Cube.009' }

/** Ground level: the underside of the rock slabs sits in it. */
export const GROUND_Y = -0.3

const STATION_COMPONENTS = { plan: Plan, create: Create, build: Build, amplify: Amplify, deliver: Deliver }

const Y = new THREE.Vector3(0, 1, 0)
const rad = THREE.MathUtils.degToRad

/**
 * Every top-level node in the export by its Blender name. GLTFLoader sanitises
 * names on the way in (`Cube.005` arrives as `Cube005`), so stations.js keeps
 * the names an artist would recognise and they are translated once, here.
 */
function indexNodes(scene) {
  const byName = new Map()
  for (const object of scene.children) byName.set(object.name, object)
  return (name) => byName.get(THREE.PropertyBinding.sanitizeNodeName(name))
}

/** Restyles the export's materials into the scene's palette, by node. */
function restyle(scene, whiteboard) {
  const clay = new THREE.MeshStandardMaterial({ color: COLORS.clay, roughness: 0.72 })
  const platform = new THREE.MeshStandardMaterial({ color: COLORS.platform, roughness: 0.92 })
  const furniture = new THREE.MeshStandardMaterial({ color: '#3b3070', roughness: 0.8 })
  const frame = new THREE.MeshStandardMaterial({ color: '#2a2350', roughness: 0.6 })
  const metal = new THREE.MeshStandardMaterial({ color: '#2b2547', roughness: 0.45, metalness: 0.5 })
  const backdrop = new THREE.MeshStandardMaterial({
    color: '#f3eccf',
    emissive: '#f7e7a8',
    emissiveIntensity: 0.12,
    roughness: 0.9,
  })
  const bulb = new THREE.MeshStandardMaterial({
    color: '#fff3d0',
    emissive: '#ffe7a6',
    emissiveIntensity: 4,
    toneMapped: false,
  })
  const board = new THREE.MeshStandardMaterial({ map: whiteboard, roughness: 0.4, side: THREE.DoubleSide })

  const sanitize = THREE.PropertyBinding.sanitizeNodeName
  const within = (object, names) => {
    const wanted = names.map(sanitize)
    for (let o = object; o; o = o.parent) if (wanted.includes(o.name)) return true
    return false
  }

  scene.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    const is = (...names) => within(object, names)

    if (/^Low_?poly/i.test(object.name) || /^Low_?poly/i.test(object.parent?.name ?? '')) {
      object.material = clay
    } else if (is(...Object.values(PLATFORM))) object.material = platform
    else if (is('Whiteboard')) {
      object.material = board
      object.castShadow = false
    } else if (is('Cube.001')) object.material = frame
    else if (is('Cube.002', 'Cube.008', 'Chair_03')) object.material = furniture
    else if (is('Cube.006')) object.material = backdrop
    else if (is('Large Light Bulb', 'Light Single bulb', 'Tripod')) {
      // Lamp rigs carry several materials; the tube and the bulb glass glow,
      // everything else is the stand.
      object.material = /Tube Light|Glass|Filament/.test(object.material.name) ? bulb : metal
    }
  })
}

/**
 * Lifts each station out of the export and re-places it (see STATIONS in
 * stations.js). Two groups per station:
 *
 *   outer — at the station's place in the scene, swung by its `turn`. Its
 *           local frame is the station's frame: origin at the platform, front
 *           toward +Z. Everything added in code goes in here.
 *   inner — undoes the export's own placement, so the nodes moved into it
 *           keep their transforms exactly as authored.
 *
 * Built once per loaded scene and cached on it: the nodes are *moved*, so a
 * second pass (a remount, StrictMode's double render) must not try again.
 */
function buildStations(scene, whiteboard) {
  if (scene.userData.stations) return scene.userData.stations

  restyle(scene, whiteboard)
  const find = indexNodes(scene)

  const stations = STATIONS.map((station) => {
    const outer = new THREE.Group()
    outer.name = `station:${station.id}`
    outer.position.set(...station.position)
    outer.rotation.y = rad(station.turn)

    const inner = new THREE.Group()
    if (station.source) {
      const phi = rad(station.front)
      inner.rotation.y = -phi
      inner.position.set(-station.source[0], 0, -station.source[1]).applyAxisAngle(Y, -phi)
      for (const name of station.nodes) {
        const object = find(name)
        if (object) inner.add(object)
        else console.warn(`[ProcessScene] no node "${name}" in ${MODEL_URL}`)
      }
    }
    outer.add(inner)
    return { station, outer, platform: station.source ? find(PLATFORM[station.id]) : null }
  })

  // AMPLIFY: DELIVER's slab and two of the crew, cloned onto a platform of its
  // own. Placed in the station's frame, so these numbers are local.
  const amplify = stations.find((s) => s.station.id === 'amplify')
  const deliver = stations.find((s) => s.station.id === 'deliver')
  const slab = deliver.platform.clone()
  slab.position.set(0, deliver.platform.position.y, 0)
  slab.rotation.set(0, 0.5, 0)
  amplify.outer.add(slab)
  amplify.platform = slab

  const standing = find('Lowpoly Male Standing')?.clone() ?? new THREE.Group()
  standing.position.set(-0.55, 0.2, 0.15)
  standing.rotation.set(0, -0.35, 0)
  const cheering = find('Low poly man dancing')?.clone() ?? new THREE.Group()
  cheering.position.set(0.55, 0.2, -0.35)
  cheering.rotation.set(0, 0.2, 0)
  amplify.outer.add(standing, cheering)

  for (const { outer } of stations) outer.updateMatrixWorld(true)

  scene.userData.stations = stations
  return stations
}

export function ProcessScene() {
  const { scene } = useGLTF(MODEL_URL, DRACO_DECODER_PATH)
  const whiteboard = useMemo(() => whiteboardTexture(), [])
  const stations = useMemo(() => buildStations(scene, whiteboard.texture), [scene, whiteboard])

  return (
    <>
      <Director />
      <Lights />
      <Ground />
      <Path />

      {stations.map(({ station, outer, platform }, index) => {
        const Dressing = STATION_COMPONENTS[station.id]
        return (
          <primitive key={station.id} object={outer}>
            <Base station={outer} platform={platform} seed={index + 1} />
            <Dressing index={index} group={outer} whiteboard={whiteboard} />
            <StationLabel index={index} position={[-0.6, 3.0, 0.2]} />
            <FocusLight index={index} position={[0.8, 3.1, 1.6]} color="#ece8ff" />
          </primitive>
        )
      })}
    </>
  )
}

/**
 * Under each platform: a chunk of rock, and the lime and pink blocks set into
 * its rim. Placed in the platform's own frame within the station — its
 * position and yaw, not its squashed scale — so it follows however the slab was
 * set down.
 */
function Base({ station, platform, seed }) {
  const rock = useRockGeometry(seed)
  const frame = useMemo(() => {
    const relative = new THREE.Matrix4().copy(station.matrixWorld).invert().multiply(platform.matrixWorld)
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    relative.decompose(position, quaternion, new THREE.Vector3())
    const yaw = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ').y
    const sx = Math.abs(platform.scale.x)
    const sy = Math.abs(platform.scale.y)
    const sz = Math.abs(platform.scale.z)
    return {
      position,
      yaw,
      halfX: sx * 1.1,
      halfZ: sz * 1.1,
      top: position.y + sy,
      bottom: position.y - sy * 1.1,
    }
  }, [station, platform])

  const { position, yaw, halfX, halfZ, top, bottom } = frame
  const depth = bottom - GROUND_Y

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, yaw, 0]}>
      <mesh
        geometry={rock}
        position={[0, bottom - 0.02, 0]}
        scale={[halfX * 1.12, depth + 0.38, halfZ * 1.12]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={COLORS.rock} roughness={1} flatShading />
      </mesh>

      {/* Accents set into the rim. */}
      <mesh position={[halfX * 0.92, top - 0.12, halfZ * 0.25]} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.42]} />
        <meshStandardMaterial color={COLORS.pink} roughness={0.6} />
      </mesh>
      <mesh position={[-halfX * 0.3, top - 0.1, halfZ * 0.95]} castShadow>
        <boxGeometry args={[0.38, 0.1, 0.14]} />
        <meshStandardMaterial color={COLORS.lime} roughness={0.6} />
      </mesh>
      <mesh position={[halfX * 0.2, top + 0.01, -halfZ * 0.9]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.26, 0.04, 0.2]} />
        <meshStandardMaterial color={COLORS.lime} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -2]} receiveShadow>
      <circleGeometry args={[60, 48]} />
      <meshStandardMaterial color={COLORS.ground} roughness={1} />
    </mesh>
  )
}

function Lights() {
  // A light's target has to be in the scene graph to have a world matrix.
  const target = useMemo(() => {
    const object = new THREE.Object3D()
    object.position.set(0, 0, -0.5)
    return object
  }, [])
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#b9b0ff', '#241a4e', 1.35]} />
      <directionalLight
        target={target}
        position={[-5, 14, 9]}
        intensity={2.4}
        color="#fff4ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      {/* Pink rim from behind the line, to cut the figures off the ground. */}
      <directionalLight position={[6, 5, -12]} intensity={1.2} color="#ff7a9a" />
    </>
  )
}

useGLTF.preload(MODEL_URL, DRACO_DECODER_PATH)
