import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// Helper functions
function getRandomPointOnSphere(radius) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const x = radius * Math.sin(phi) * Math.cos(theta)
    const y = radius * Math.sin(phi) * Math.sin(theta)
    const z = radius * Math.cos(phi)
    return new THREE.Vector3(x, y, z)
}

function createConnectionCurve(start, end, midPointOffset = 20) {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    mid.y += (Math.random() - 0.5) * midPointOffset
    mid.x += (Math.random() - 0.5) * midPointOffset
    mid.z += (Math.random() - 0.5) * midPointOffset
    return new THREE.CatmullRomCurve3([start, mid, end])
}

function createStarfield(count = 3000, radius = 1500) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color1 = new THREE.Color('#ffffff')
    const color2 = new THREE.Color('#00d9ff')
    
    for (let i = 0; i < count; i++) {
        const r = radius * (0.5 + Math.random() * 0.5)
        const theta = 2 * Math.PI * Math.random()
        const phi = Math.acos(2 * Math.random() - 1)
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
        
        const mixedColor = color1.clone().lerp(color2, Math.random())
        colors[i * 3] = mixedColor.r
        colors[i * 3 + 1] = mixedColor.g
        colors[i * 3 + 2] = mixedColor.b
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    })
    return new THREE.Points(geometry, material)
}

export class Tree3DRenderer {
    constructor(canvas, familyTree) {
        this.canvas = canvas
        this.familyTree = familyTree
        this.scene = null
        this.camera = null
        this.renderer = null
        this.composer = null
        this.controls = null
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()
        
        // State
        this.viewMode = 'galaxy' // 'galaxy' or 'tree'
        this.selectedFamilyId = null
        this.hoveredFamilyId = null
        this.selectedMemberId = null
        this.hoveredMemberId = null
        
        // Updaters map
        this.updaters = new Map()
        this.clock = new THREE.Clock()
        
        // Groups
        this.familyGroups = new Map()
        this.memberNodes = new Map()
        this.connectionLines = new Map()
        this.particleTrails = new Map()
        
        // Callbacks
        this.onFamilySelect = null
        this.onMemberSelect = null
        this.onViewModeChange = null
        
        this.init()
    }
    
    init() {
        if (!this.canvas) {
            console.error('Canvas element nije dostupan')
            return
        }
        
        // 1. Scene Setup
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color('#000000')
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0015)
        
        // 2. Camera Setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
        this.camera.position.set(0, 50, 200)
        
        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.toneMapping = THREE.ReinhardToneMapping
        
        // 4. Post-processing (Bloom)
        const renderScene = new RenderPass(this.scene, this.camera)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        )
        this.composer = new EffectComposer(this.renderer)
        this.composer.addPass(renderScene)
        this.composer.addPass(bloomPass)
        
        // 5. Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 2)
        this.scene.add(ambientLight)
        
        // 6. Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05
        this.controls.minDistance = 20
        this.controls.maxDistance = 800
        this.controls.enablePan = true
        
        // 7. Add Starfield
        const stars = createStarfield(3000, 1500)
        this.scene.add(stars)
        
        // 8. Resize Handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(window.innerWidth, window.innerHeight)
            this.composer.setSize(window.innerWidth, window.innerHeight)
        })
        
        // 9. Animation Loop
        this.animate()
        
        // 10. Setup Event Listeners
        this.setupEventListeners()
    }
    
    animate() {
        requestAnimationFrame(() => this.animate())
        
        const delta = this.clock.getDelta()
        const time = this.clock.getElapsedTime()
        
        // Update controls
        this.controls.update()
        
        // Run all registered updaters
        this.updaters.forEach(callback => {
            callback(delta, time)
        })
        
        // Render
        this.composer.render()
    }
    
    registerUpdater(id, callback) {
        this.updaters.set(id, callback)
    }
    
    unregisterUpdater(id) {
        this.updaters.delete(id)
    }
    
    setupEventListeners() {
        // Mouse move for raycasting
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        })
        
        // Click handler
        window.addEventListener('click', () => {
            if (this.viewMode === 'galaxy') {
                if (this.hoveredFamilyId) {
                    this.selectedFamilyId = this.hoveredFamilyId
                    if (this.onFamilySelect) {
                        this.onFamilySelect(this.selectedFamilyId)
                    }
                } else {
                    this.selectedFamilyId = null
                    if (this.onFamilySelect) {
                        this.onFamilySelect(null)
                    }
                }
            } else if (this.viewMode === 'tree') {
                if (this.hoveredMemberId) {
                    this.selectedMemberId = this.hoveredMemberId
                    if (this.onMemberSelect) {
                        const member = this.getMemberById(this.hoveredMemberId)
                        if (member) {
                            this.onMemberSelect(member)
                        }
                    }
                } else {
                    this.selectedMemberId = null
                }
            }
        })
        
        // Galaxy mode raycasting
        this.registerUpdater('galaxy-interaction', () => {
            if (this.viewMode !== 'galaxy') return
            
            this.raycaster.setFromCamera(this.mouse, this.camera)
            const familyGroups = Array.from(this.familyGroups.values())
            const intersects = this.raycaster.intersectObjects(familyGroups, true)
            
            if (intersects.length > 0) {
                let obj = intersects[0].object
                while (obj.parent && !(obj.parent instanceof THREE.Group && obj.parent.userData.familyId)) {
                    obj = obj.parent
                }
                const group = obj.parent
                if (group && group.userData.familyId) {
                    this.hoveredFamilyId = group.userData.familyId
                    document.body.style.cursor = 'pointer'
                    return
                }
            }
            this.hoveredFamilyId = null
            document.body.style.cursor = 'default'
        })
        
        // Tree mode raycasting
        this.registerUpdater('tree-interaction', () => {
            if (this.viewMode !== 'tree') return
            
            this.raycaster.setFromCamera(this.mouse, this.camera)
            const interactables = []
            this.scene.traverse(obj => {
                if (obj.userData.isMemberNode) {
                    interactables.push(obj)
                }
            })
            const intersects = this.raycaster.intersectObjects(interactables, true)
            
            if (intersects.length > 0) {
                let obj = intersects[0].object
                while (obj.parent && !obj.userData.memberId) {
                    obj = obj.parent
                }
                if (obj.userData.memberId) {
                    this.hoveredMemberId = obj.userData.memberId
                    document.body.style.cursor = 'pointer'
                    return
                }
            }
            this.hoveredMemberId = null
            document.body.style.cursor = 'default'
        })
    }
    
    // Group profiles into families (nuclear families)
    groupProfilesIntoFamilies(profiles) {
        const families = new Map()
        const processed = new Set()
        
        profiles.forEach(profile => {
            if (processed.has(profile.id)) return
            
            // Find nuclear family (parents + children)
            const nuclearFamily = this.findNuclearFamily(profile, profiles)
            const familyId = `family_${profile.id}`
            
            nuclearFamily.forEach(p => processed.add(p.id))
            families.set(familyId, nuclearFamily)
        })
        
        return families
    }
    
    findNuclearFamily(profile, allProfiles) {
        const family = new Set([profile])
        
        // Add parents
        if (profile.parentId) {
            const parent = allProfiles.find(p => p.id === profile.parentId)
            if (parent) {
                family.add(parent)
                // Add siblings (children of same parent)
                allProfiles.forEach(p => {
                    if (p.parentId === profile.parentId && p.id !== profile.id) {
                        family.add(p)
                    }
                })
            }
        }
        
        // Add children
        allProfiles.forEach(p => {
            if (p.parentId === profile.id) {
                family.add(p)
            }
        })
        
        return Array.from(family)
    }
    
    // Render galaxy view
    renderGalaxyView() {
        // Clear tree view
        this.clearTreeView()
        
        const profiles = this.familyTree.getAllProfiles()
        const families = this.groupProfilesIntoFamilies(profiles)
        
        // Generate colors for families
        const colors = [0x00d9ff, 0xb84fff, 0x00ffaa, 0xff0055, 0x4400ff, 0xffaa00, 0xffffff, 0x9900ff]
        
        // Create family clusters
        let colorIndex = 0
        families.forEach((familyProfiles, familyId) => {
            const color = colors[colorIndex % colors.length]
            colorIndex++
            
            // Position families in space
            const familyIndex = Array.from(families.keys()).indexOf(familyId)
            const angle = (familyIndex / Math.max(1, families.size)) * Math.PI * 2
            const radius = 80 + familyIndex * 30
            const position = new THREE.Vector3(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 50,
                Math.sin(angle) * radius
            )
            
            this.createFamilyCluster(familyId, familyProfiles, position, color)
        })
        
        // Create connections between families
        this.createFamilyConnections(families)
        
        // Set camera for galaxy view
        this.camera.position.set(0, 50, 200)
        this.controls.target.set(0, 0, 0)
        this.controls.update()
    }
    
    createFamilyCluster(familyId, profiles, position, color) {
        const group = new THREE.Group()
        group.position.copy(position)
        group.userData.familyId = familyId
        this.familyGroups.set(familyId, group)
        
        // 1. Central "Star" of the family
        const centerGeometry = new THREE.SphereGeometry(4, 32, 32)
        const centerMaterial = new THREE.MeshBasicMaterial({
            color: color,
            toneMapped: false
        })
        const centerMesh = new THREE.Mesh(centerGeometry, centerMaterial)
        
        // Add point light
        const light = new THREE.PointLight(color, 3, 150)
        centerMesh.add(light)
        group.add(centerMesh)
        
        // 2. Family Members (Orbiting nodes)
        const memberMeshes = []
        const orbitRadius = 18
        profiles.forEach((member, i) => {
            const size = 1 + Math.random() * 1.5
            const geometry = new THREE.SphereGeometry(size, 16, 16)
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color).offsetHSL(0, 0, 0.2),
                emissive: new THREE.Color(color),
                emissiveIntensity: 0.8,
                roughness: 0.2,
                metalness: 0.8
            })
            const mesh = new THREE.Mesh(geometry, material)
            
            // Distribute in a cloud around center
            const pos = getRandomPointOnSphere(orbitRadius * (0.6 + Math.random() * 0.6))
            mesh.position.copy(pos)
            
            // Store initial position for animation
            mesh.userData = {
                initialPos: pos.clone(),
                orbitSpeed: (Math.random() - 0.5) * 0.8,
                orbitAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
            }
            group.add(mesh)
            memberMeshes.push(mesh)
        })
        
        // 3. Selection Ring
        const ringGeo = new THREE.RingGeometry(orbitRadius + 8, orbitRadius + 9, 64)
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = Math.PI / 2
        ring.visible = false
        group.add(ring)
        
        this.scene.add(group)
        
        // Animation
        const isSelected = this.selectedFamilyId === familyId
        this.registerUpdater(`family-${familyId}`, (delta, time) => {
            // Rotate the entire group slowly
            group.rotation.y += 0.05 * delta
            
            // Animate members
            memberMeshes.forEach(mesh => {
                const { initialPos, orbitSpeed, orbitAxis } = mesh.userData
                mesh.position.copy(initialPos)
                mesh.position.applyAxisAngle(orbitAxis, orbitSpeed * time)
            })
            
            // Pulse the center light
            light.intensity = 3 + Math.sin(time * 2) * 1
            
            // Show ring if selected
            ring.visible = isSelected
            if (isSelected) {
                ring.rotation.z -= delta * 0.5
                ring.scale.setScalar(1 + Math.sin(time * 3) * 0.05)
                ring.material.opacity = 0.5 + Math.sin(time * 5) * 0.2
            }
        })
    }
    
    createFamilyConnections(families) {
        const familyArray = Array.from(families.entries())
        
        for (let i = 0; i < familyArray.length; i++) {
            for (let j = i + 1; j < familyArray.length; j++) {
                const [familyId1, profiles1] = familyArray[i]
                const [familyId2, profiles2] = familyArray[j]
                
                // Check if they have common members
                const commonProfiles = profiles1.filter(p1 => 
                    profiles2.some(p2 => p2.id === p1.id)
                )
                
                if (commonProfiles.length > 0) {
                    const group1 = this.familyGroups.get(familyId1)
                    const group2 = this.familyGroups.get(familyId2)
                    
                    if (group1 && group2) {
                        const start = group1.position.clone()
                        const end = group2.position.clone()
                        const family1 = Array.from(families.values())[i]
                        const color = 0xb84fff // Purple connection color
                        this.createParticleTrail(start, end, color, `${familyId1}-${familyId2}`)
                    }
                }
            }
        }
    }
    
    createParticleTrail(startPos, endPos, color, id) {
        const start = startPos instanceof THREE.Vector3 ? startPos : new THREE.Vector3(...startPos)
        const end = endPos instanceof THREE.Vector3 ? endPos : new THREE.Vector3(...endPos)
        
        // Create curve
        const curve = createConnectionCurve(start, end)
        
        // 1. Static Line
        const points = curve.getPoints(50)
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15
        })
        const line = new THREE.Line(geometry, material)
        this.scene.add(line)
        this.particleTrails.set(`${id}-static`, line)
        
        // 2. Animated Particles
        const particleCount = 20
        const particleGeo = new THREE.BufferGeometry()
        const particlePositions = new Float32Array(particleCount * 3)
        const progressArray = new Float32Array(particleCount)
        const speedArray = new Float32Array(particleCount)
        
        for (let i = 0; i < particleCount; i++) {
            progressArray[i] = Math.random()
            speedArray[i] = 0.1 + Math.random() * 0.2
            const point = curve.getPoint(progressArray[i])
            particlePositions[i * 3] = point.x
            particlePositions[i * 3 + 1] = point.y
            particlePositions[i * 3 + 2] = point.z
        }
        
        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
        const particleMat = new THREE.PointsMaterial({
            color: color,
            size: 1.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })
        const particles = new THREE.Points(particleGeo, particleMat)
        this.scene.add(particles)
        this.particleTrails.set(`${id}-particles`, particles)
        
        // Save data for animation
        particles.userData = {
            curve: curve,
            progressArray: progressArray,
            speedArray: speedArray,
            particleCount: particleCount
        }
        
        // Animation
        this.registerUpdater(`trail-${id}`, (delta) => {
            const positions = particles.geometry.attributes.position.array
            for (let i = 0; i < particleCount; i++) {
                progressArray[i] += speedArray[i] * delta * 0.5
                if (progressArray[i] > 1) progressArray[i] = 0
                
                const point = curve.getPoint(progressArray[i])
                positions[i * 3] = point.x
                positions[i * 3 + 1] = point.y
                positions[i * 3 + 2] = point.z
            }
            particles.geometry.attributes.position.needsUpdate = true
        })
    }
    
    // Render tree view
    renderTreeView(familyId) {
        // Clear galaxy view
        this.clearGalaxyView()
        
        // Get family profiles
        const families = this.groupProfilesIntoFamilies(this.familyTree.getAllProfiles())
        const familyProfiles = families.get(familyId)
        if (!familyProfiles) return
        
        // Get family color
        const colors = [0x00d9ff, 0xb84fff, 0x00ffaa, 0xff0055, 0x4400ff, 0xffaa00, 0xffffff, 0x9900ff]
        const familyIndex = Array.from(families.keys()).indexOf(familyId)
        const baseColor = colors[familyIndex % colors.length]
        
        // Calculate 3D layout
        const memberPositions = this.calculateTreeLayout(familyProfiles)
        
        // Create member nodes with different colors per generation
        familyProfiles.forEach(profile => {
            const position = memberPositions.get(profile.id) || new THREE.Vector3()
            const generation = this.getGeneration(profile, familyProfiles)
            // Different color per generation
            const generationColors = [
                0x00d9ff, // Generation 0 (root) - cyan
                0xb84fff, // Generation 1 - purple
                0x00ffaa, // Generation 2 - green
                0xff0055, // Generation 3 - pink
                0xffaa00, // Generation 4 - orange
                0xffffff, // Generation 5+ - white
            ]
            const color = generationColors[Math.min(generation, generationColors.length - 1)]
            this.createMemberNode(profile, position, color)
        })
        
        // Create connections with base color
        this.createTreeConnections(familyProfiles, memberPositions, baseColor)
        
        // Set camera for tree view
        this.camera.position.set(0, 50, 200)
        this.controls.target.set(0, 0, -50)
        this.controls.update()
    }
    
    calculateTreeLayout(profiles) {
        const positions = new Map()
        const generations = {}
        
        // Group by generation
        profiles.forEach(m => {
            const gen = this.getGeneration(m, profiles)
            if (!generations[gen]) generations[gen] = []
            generations[gen].push(m)
        })
        
        // Calculate positions
        Object.keys(generations).forEach(genKey => {
            const gen = parseInt(genKey)
            const members = generations[gen]
            const z = -gen * 80 // Depth into screen
            members.forEach((member, index) => {
                const spread = 60
                const x = (index - (members.length - 1) / 2) * spread
                const y = gen === 0 ? 0 : (Math.random() - 0.5) * 40
                positions.set(member.id, new THREE.Vector3(x, y, z))
            })
        })
        
        return positions
    }
    
    getGeneration(profile, allProfiles) {
        if (!profile.parentId) return 0
        const parent = allProfiles.find(p => p.id === profile.parentId)
        if (!parent) return 0
        return this.getGeneration(parent, allProfiles) + 1
    }
    
    createMemberNode(profile, position, color) {
        const group = new THREE.Group()
        group.position.copy(position)
        group.userData = {
            memberId: profile.id,
            isMemberNode: true
        }
        this.memberNodes.set(profile.id, group)
        
        // 1. Main Sphere
        const generation = this.getGeneration(profile, this.familyTree.getAllProfiles())
        const size = generation === 0 ? 6 : generation === 1 ? 4 : 3
        const geometry = new THREE.SphereGeometry(size, 32, 32)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const mesh = new THREE.Mesh(geometry, material)
        group.add(mesh)
        
        // 2. Glow Shell
        const glowGeo = new THREE.SphereGeometry(size * 1.4, 32, 32)
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        })
        const glowMesh = new THREE.Mesh(glowGeo, glowMat)
        group.add(glowMesh)
        
        // 3. Selection Ring
        const ringGeo = new THREE.RingGeometry(size * 1.8, size * 2, 32)
        const ringMat = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.visible = false
        group.add(ring)
        
        // 4. Point Light
        const light = new THREE.PointLight(color, 1, 50)
        light.intensity = 0.5
        group.add(light)
        
        // 5. Name Label (Sprite) - positioned in front of the sphere
        const label = this.createNameLabel(profile.name || 'Unknown', color)
        label.position.set(0, 0, size + 12) // Position in front of the sphere (positive Z)
        group.add(label)
        
        this.scene.add(group)
        
        // Animation
        const isHovered = this.hoveredMemberId === profile.id
        const isSelected = this.selectedMemberId === profile.id
        this.registerUpdater(`member-${profile.id}`, (delta, time) => {
            // Hover effect
            const targetScale = isHovered ? 1.3 : 1.0
            mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            
            // Pulse glow
            glowMesh.scale.setScalar(1 + Math.sin(time * 3) * 0.05)
            glowMesh.rotation.y += delta * 0.2
            
            // Selection ring animation
            ring.visible = isSelected
            if (isSelected) {
                ring.rotation.z -= delta
                ring.rotation.x = Math.sin(time) * 0.2
                ring.rotation.y = Math.cos(time) * 0.2
            }
            
            // Always face camera for label
            if (label && this.camera) {
                label.lookAt(this.camera.position)
            }
        })
    }
    
    createNameLabel(name, color) {
        // Create canvas for text - larger size for better readability
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.width = 1024
        canvas.height = 256
        
        // Transparent background (no background, no border)
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        // Text - larger and bolder
        context.fillStyle = '#ffffff'
        context.font = 'Bold 48px Arial'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        
        // Add text shadow for better readability
        context.shadowColor = 'rgba(0, 0, 0, 0.8)'
        context.shadowBlur = 10
        context.shadowOffsetX = 2
        context.shadowOffsetY = 2
        
        context.fillText(name, canvas.width / 2, canvas.height / 2)
        
        // Create sprite
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1
        })
        
        const sprite = new THREE.Sprite(spriteMaterial)
        // Larger scale for better visibility
        sprite.scale.set(80, 20, 1)
        
        return sprite
    }
    
    createTreeConnections(profiles, positions, color) {
        const group = new THREE.Group()
        this.connectionLines.set('tree-connections', group)
        this.scene.add(group)
        
        profiles.forEach(profile => {
            if (profile.parentId) {
                const start = positions.get(profile.parentId)
                const end = positions.get(profile.id)
                if (start && end) {
                    const curve = createConnectionCurve(start, end, 30)
                    const geometry = new THREE.TubeGeometry(curve, 20, 0.5, 8, false)
                    const material = new THREE.MeshBasicMaterial({
                        color: color,
                        transparent: true,
                        opacity: 0.3,
                        blending: THREE.AdditiveBlending
                    })
                    const mesh = new THREE.Mesh(geometry, material)
                    group.add(mesh)
                }
            }
        })
    }
    
    clearGalaxyView() {
        // Remove family groups
        this.familyGroups.forEach(group => {
            this.scene.remove(group)
            this.unregisterUpdater(`family-${group.userData.familyId}`)
        })
        this.familyGroups.clear()
        
        // Remove particle trails
        this.particleTrails.forEach(trail => {
            this.scene.remove(trail)
        })
        this.particleTrails.clear()
    }
    
    clearTreeView() {
        // Remove member nodes
        this.memberNodes.forEach(node => {
            this.scene.remove(node)
            this.unregisterUpdater(`member-${node.userData.memberId}`)
        })
        this.memberNodes.clear()
        
        // Remove connections
        this.connectionLines.forEach(line => {
            this.scene.remove(line)
        })
        this.connectionLines.clear()
    }
    
    setViewMode(mode) {
        this.viewMode = mode
        if (this.onViewModeChange) {
            this.onViewModeChange(mode)
        }
    }
    
    getMemberById(memberId) {
        const profiles = this.familyTree.getAllProfiles()
        return profiles.find(p => p.id === memberId)
    }
    
    // Public API
    renderTree() {
        this.renderGalaxyView()
    }
    
    switchToTreeView(familyId) {
        this.setViewMode('tree')
        this.renderTreeView(familyId)
    }
    
    switchToGalaxyView() {
        this.setViewMode('galaxy')
        this.renderGalaxyView()
    }
    
    destroy() {
        // Cleanup
        this.clearGalaxyView()
        this.clearTreeView()
        this.updaters.clear()
        
        if (this.composer) {
            this.composer.dispose()
        }
        if (this.renderer) {
            this.renderer.dispose()
        }
    }
}
