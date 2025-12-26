import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { CanvasTexture } from 'three'

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
        this.mapMode = 'globe' // 'globe' or 'flat'
        this.selectedFamilyId = null
        this.hoveredFamilyId = null
        this.selectedMemberId = null
        this.hoveredMemberId = null
        this.cameraDistance = 150 // Track camera distance for zoom-based sizing
        this.lastZoomLevel = undefined // Track last zoom level for re-rendering
        this.lastShowIndividual = undefined // Track if we were showing individual profiles
        this.lastViewMode = undefined // Track current view mode (countries/cities/individual)
        this.earthGeometryDetailLevel = 64 // Track current Earth geometry detail level
        this.zoomWatcherTimeout = null // Track zoom watcher timeout to prevent multiple re-renders
        this.earthTiles = new Map() // Cache for loaded OSM tiles
        this.currentTileZoom = 0 // Current tile zoom level
        this.isUpdatingTiles = false // Prevent concurrent tile updates
        this.flatMapTiles = new Map() // Cache for flat map OSM tiles
        this.currentFlatMapTileZoom = 0 // Current flat map tile zoom level
        this.isUpdatingFlatMapTiles = false // Prevent concurrent flat map tile updates
        
        // Updaters map
        this.updaters = new Map()
        this.clock = new THREE.Clock()
        
        // Groups
        this.familyGroups = new Map()
        this.memberNodes = new Map()
        this.connectionLines = new Map()
        this.particleTrails = new Map()
        this.earthGroup = null
        
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
        this.scene.background = new THREE.Color('#001122') // Dark blue space color
        this.scene.fog = new THREE.FogExp2(0x001122, 0.0005)
        
        // 2. Camera Setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
        this.camera.position.set(0, 50, 200)
        
        // 3. Renderer Setup
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: true,
                powerPreference: "default",
                failIfMajorPerformanceCaveat: false,
                preserveDrawingBuffer: false
            })
            this.renderer.setSize(window.innerWidth, window.innerHeight)
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            this.renderer.toneMapping = THREE.ReinhardToneMapping
            
            console.log('WebGL renderer kreiran uspešno')
            console.log('WebGL context:', this.renderer.getContext())
        } catch (error) {
            console.error('Greška pri kreiranju WebGL renderera:', error)
            // Try simpler configuration
            try {
                console.log('Pokušavam jednostavniju konfiguraciju...')
                this.renderer = new THREE.WebGLRenderer({
                    canvas: this.canvas
                })
                this.renderer.setSize(window.innerWidth, window.innerHeight)
                this.renderer.setPixelRatio(1)
                
                if (!this.renderer.getContext()) {
                    throw new Error('WebGL context not created')
                }
                console.log('Jednostavnija konfiguracija uspešna')
            } catch (fallbackError) {
                console.error('Fallback konfiguracija ne radi:', fallbackError)
                this.showWebGLError()
                return
            }
        }
        
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5) // Brighter ambient light
        this.scene.add(ambientLight)
        
        // Add directional light for better visibility
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.position.set(50, 50, 50)
        this.scene.add(directionalLight)
        
        // 6. Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05 // Reduced damping for smoother movement
        this.controls.minDistance = 0.1 // Allow very close zoom to see details
        this.controls.maxDistance = 5000 // Increased max distance for better zoom out
        this.controls.enablePan = true
        this.controls.enableZoom = true
        this.controls.zoomSpeed = 2.0 // Faster zoom for better control
        this.controls.screenSpacePanning = true // Enable screen space panning for better control
        this.controls.autoRotate = false // Disable auto-rotation
        this.controls.enableRotate = true
        // Set initial target to origin
        this.controls.target.set(0, 0, 0)
        this.controls.update()
        
        // Track camera distance for zoom-based sizing and detail level
        this.registerUpdater('camera-distance-tracker', () => {
            const oldDistance = this.cameraDistance
            
            // Don't aggressively reset target - allow panning
            // Only prevent extreme drift (very large values)
            if (this.controls && this.controls.target) {
                const targetX = this.controls.target.x
                const targetY = this.controls.target.y
                const targetZ = this.controls.target.z
                const drift = Math.sqrt(targetX * targetX + targetY * targetY + targetZ * targetZ)
                // Only reset if drift is very large (allow normal panning)
                if (drift > 100) {
                    this.controls.target.set(0, 0, 0)
                }
            }
            
            this.cameraDistance = this.camera.position.distanceTo(this.controls.target)
            
            // Update texture detail based on zoom level
            const zoomLevel = this.getZoomLevel()
            const shouldUseDetailedTexture = zoomLevel > 0.2 // Use detailed texture when zoomed in more than 20%
            const shouldUseHighDetailTexture = zoomLevel > 0.5 // Use very high detail texture when zoomed in more than 50%
            const shouldUseHighDetailGeometry = zoomLevel > 0.5 // Use high detail geometry when zoomed in more than 50%
            
            // Update Earth texture with OpenStreetMap tiles for detailed map
            // Always use OSM tiles for better detail (even at low zoom)
            if (this.mapMode === 'globe' && this.earthMaterial && this.earthGroup) {
                // Calculate appropriate tile zoom level based on camera distance
                // Higher zoom level = more detailed tiles
                const tileZoom = Math.min(18, Math.max(3, Math.floor(3 + zoomLevel * 15)))
                
                // Update if zoom level changed significantly or if not yet loaded
                if ((Math.abs(this.currentTileZoom - tileZoom) >= 1 || this.currentTileZoom === 0) && !this.isUpdatingTiles) {
                    console.log('Triggering OSM tile update for globe, zoomLevel:', zoomLevel, 'tileZoom:', tileZoom)
                    this.updateEarthTextureWithOSMTiles(tileZoom)
                    this.currentTileZoom = tileZoom
                }
            }
            
            // Update Flat Map texture with OpenStreetMap tiles for detailed map
            if (this.mapMode === 'flat' && this.flatMapMaterial && this.flatMapGroup) {
                // Calculate appropriate tile zoom level based on camera distance
                const tileZoom = Math.min(18, Math.max(3, Math.floor(3 + zoomLevel * 15)))
                
                // Update if zoom level changed significantly or if not yet loaded
                if ((Math.abs(this.currentFlatMapTileZoom - tileZoom) >= 1 || this.currentFlatMapTileZoom === 0) && !this.isUpdatingFlatMapTiles) {
                    console.log('Triggering OSM tile update for flat map, zoomLevel:', zoomLevel, 'tileZoom:', tileZoom)
                    this.updateFlatMapTextureWithOSMTiles(tileZoom)
                    this.currentFlatMapTileZoom = tileZoom
                }
            }
            
            // Dynamically adjust texture filtering for better detail when zoomed in
            if (this.earthMaterial && this.earthMaterial.map) {
                const currentTexture = this.earthMaterial.map
                
                // When very close, use NearestFilter for sharper pixels (no interpolation)
                if (zoomLevel > 0.7) {
                    if (currentTexture.magFilter !== THREE.NearestFilter) {
                        currentTexture.magFilter = THREE.NearestFilter
                        currentTexture.needsUpdate = true
                    }
                } else {
                    // When further away, use LinearFilter for smoother appearance
                    if (currentTexture.magFilter !== THREE.LinearFilter) {
                        currentTexture.magFilter = THREE.LinearFilter
                        currentTexture.needsUpdate = true
                    }
                }
                
                // Increase anisotropy to maximum when zoomed in
                const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
                if (zoomLevel > 0.5 && currentTexture.anisotropy < maxAnisotropy) {
                    currentTexture.anisotropy = maxAnisotropy
                    currentTexture.needsUpdate = true
                }
            }
            
            // Update Earth geometry detail when zoomed in - progressive detail increase
            if (this.earthMesh && this.earthGroup && this.earthGeometry) {
                const currentSegments = this.earthGeometryDetailLevel || 64
                let targetSegments = 64
                
                if (zoomLevel > 0.7) {
                    targetSegments = 512 // Very high detail when extremely close
                } else if (zoomLevel > 0.5) {
                    targetSegments = 384 // High detail when very close
                } else if (zoomLevel > 0.3) {
                    targetSegments = 256 // Medium-high detail when close
                } else if (zoomLevel > 0.15) {
                    targetSegments = 128 // Medium detail
                } else if (zoomLevel > 0.05) {
                    targetSegments = 96 // Slightly more detail even at medium zoom
                }
                
                if (currentSegments !== targetSegments) {
                    // Recreate geometry with more segments for better detail
                    const earthRadius = this.earthGeometry.parameters.radius || 50
                    const newGeometry = new THREE.SphereGeometry(earthRadius, targetSegments, targetSegments)
                    const oldGeometry = this.earthMesh.geometry
                    this.earthMesh.geometry = newGeometry
                    this.earthGeometry = newGeometry
                    this.earthGeometryDetailLevel = targetSegments
                    // Dispose old geometry to free memory
                    if (oldGeometry && oldGeometry !== newGeometry) {
                        oldGeometry.dispose()
                    }
                }
            }
            
            // Update Earth texture if zoomed in enough
            if (this.earthMaterial && this.earthGroup) {
                // Increase texture detail/anisotropy when zoomed in
                if (this.earthMaterial.map) {
                    // Use maximum anisotropy for best quality
                    this.earthMaterial.map.anisotropy = shouldUseDetailedTexture ? 16 : (shouldUseHighDetailTexture ? 16 : 8)
                    this.earthMaterial.map.minFilter = THREE.LinearMipmapLinearFilter
                    this.earthMaterial.map.magFilter = THREE.LinearFilter
                    this.earthMaterial.map.needsUpdate = true
                }
                // Also update material properties for better visibility - adjust based on zoom
                this.earthMaterial.roughness = shouldUseHighDetailTexture ? 0.2 : 0.3 // Less rough when zoomed in for sharper details
                this.earthMaterial.metalness = shouldUseHighDetailTexture ? 0.05 : 0.1 // Less metallic when zoomed in for better color visibility
            }
            
            // Update flat map texture if zoomed in enough
            if (this.flatMapMaterial && this.flatMapGroup) {
                if (this.flatMapMaterial.map) {
                    this.flatMapMaterial.map.anisotropy = shouldUseDetailedTexture ? 16 : (shouldUseHighDetailTexture ? 16 : 8)
                    this.flatMapMaterial.map.minFilter = THREE.LinearMipmapLinearFilter
                    this.flatMapMaterial.map.magFilter = THREE.LinearFilter
                    this.flatMapMaterial.map.needsUpdate = true
                }
                // Also update material properties for better visibility
                this.flatMapMaterial.roughness = shouldUseHighDetailTexture ? 0.2 : 0.3
                this.flatMapMaterial.metalness = shouldUseHighDetailTexture ? 0.05 : 0.1
            }
            
            // Dynamically load higher resolution texture for flat map when zoomed in
            if (shouldUseHighDetailTexture && this.flatMapMaterial && this.flatMapMaterial.map) {
                if (!this.flatMapMaterial.map.userData.highDetailLoaded) {
                    const loader = new THREE.TextureLoader()
                    loader.load(
                        'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
                        (texture) => {
                            if (texture && this.flatMapMaterial) {
                                texture.anisotropy = 16
                                texture.minFilter = THREE.LinearMipmapLinearFilter
                                texture.magFilter = THREE.LinearFilter
                                texture.generateMipmaps = true
                                this.flatMapMaterial.map = texture
                                this.flatMapMaterial.map.userData.highDetailLoaded = true
                                this.flatMapMaterial.needsUpdate = true
                            }
                        },
                        undefined,
                        (err) => {
                            console.warn('Failed to load high detail flat map texture:', err)
                        }
                    )
                }
            }
        })
        
        // 7. Create Earth
        this.createEarth()
        
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
        
        // Allow panning - don't reset target unless it's extremely far
        if (this.controls && this.controls.target) {
            const drift = this.controls.target.length()
            // Only reset if drift is extremely large (allow normal panning and zooming)
            if (drift > 200) {
                this.controls.target.set(0, 0, 0)
            }
        }
        
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
    
    checkWebGLAvailability() {
        try {
            // Try multiple ways to check WebGL
            const canvas = document.createElement('canvas')
            
            // Try webgl2 first
            let gl = canvas.getContext('webgl2')
            if (gl) return true
            
            // Try webgl
            gl = canvas.getContext('webgl')
            if (gl) return true
            
            // Try experimental-webgl
            gl = canvas.getContext('experimental-webgl')
            if (gl) return true
            
            return false
        } catch (e) {
            console.warn('WebGL check error:', e)
            // Even if check fails, try to create renderer anyway
            return true
        }
    }
    
    showWebGLError() {
        if (this.canvas) {
            const ctx = this.canvas.getContext('2d')
            if (ctx) {
                this.canvas.width = window.innerWidth
                this.canvas.height = window.innerHeight
                ctx.fillStyle = '#000000'
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
                ctx.fillStyle = '#ffffff'
                ctx.font = '24px Arial'
                ctx.textAlign = 'center'
                ctx.fillText('WebGL nije dostupan', this.canvas.width / 2, this.canvas.height / 2 - 20)
                ctx.font = '16px Arial'
                ctx.fillText('Proverite podešavanja browsera ili grafičkog drajvera', this.canvas.width / 2, this.canvas.height / 2 + 20)
            }
        }
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
                if (this.hoveredMemberId && (this.hoveredMemberId.startsWith('country-') || this.hoveredMemberId.startsWith('city-'))) {
                    const marker = this.memberNodes.get(this.hoveredMemberId)
                    if (marker && marker.userData.profiles && marker.userData.profiles.length > 0) {
                        // Select first profile from that country/city
                        this.selectedMemberId = marker.userData.profiles[0].id
                        if (this.onMemberSelect) {
                            this.onMemberSelect(marker.userData.profiles[0])
                        }
                    }
                } else {
                    this.selectedMemberId = null
                    if (this.onMemberSelect) {
                        this.onMemberSelect(null)
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
        
        // Galaxy mode raycasting (for country, city, and individual markers)
        this.registerUpdater('galaxy-interaction', () => {
            if (this.viewMode !== 'galaxy') return
            
            this.raycaster.setFromCamera(this.mouse, this.camera)
            
            // Check country, city, and individual markers
            const markers = Array.from(this.memberNodes.values()).filter(node => 
                node.userData.isCountryMarker || node.userData.isCityMarker || node.userData.isIndividualMarker
            )
            const intersects = this.raycaster.intersectObjects(markers, true)
            
            if (intersects.length > 0) {
                let obj = intersects[0].object
                while (obj.parent && (!obj.userData || (!obj.userData.country && !obj.userData.key && !obj.userData.profileId))) {
                    obj = obj.parent
                }
                if (obj.userData && obj.userData.profileId) {
                    this.hoveredMemberId = `individual-${obj.userData.profileId}`
                    document.body.style.cursor = 'pointer'
                    return
                }
                if (obj.userData && obj.userData.country && !obj.userData.key) {
                    this.hoveredMemberId = `country-${obj.userData.country}`
                    document.body.style.cursor = 'pointer'
                    return
                }
                if (obj.userData && obj.userData.key) {
                    this.hoveredMemberId = `city-${obj.userData.key}`
                    document.body.style.cursor = 'pointer'
                    return
                }
            }
            
            this.hoveredMemberId = null
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
        
        // Add spouse
        if (profile.spouseId) {
            const spouse = allProfiles.find(p => p.id === profile.spouseId)
            if (spouse) {
                family.add(spouse)
            }
        }
        // Check if someone has this profile as spouse
        allProfiles.forEach(p => {
            if (p.spouseId === profile.id) {
                family.add(p)
            }
        })
        
        // Add parents
        if (profile.parentId) {
            const parent = allProfiles.find(p => p.id === profile.parentId)
            if (parent) {
                family.add(parent)
                // Add parent's spouse
                if (parent.spouseId) {
                    const parentSpouse = allProfiles.find(p => p.id === parent.spouseId)
                    if (parentSpouse) {
                        family.add(parentSpouse)
                    }
                }
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
    
    // Convert lat/lng to 3D position on sphere
    latLngToVector3(lat, lng, radius) {
        const phi = (90 - lat) * (Math.PI / 180) // Convert latitude to radians
        const theta = (lng + 180) * (Math.PI / 180) // Convert longitude to radians
        
        const x = -(radius * Math.sin(phi) * Math.cos(theta))
        const y = radius * Math.cos(phi)
        const z = radius * Math.sin(phi) * Math.sin(theta)
        
        return new THREE.Vector3(x, y, z)
    }
    
    // Create Earth sphere
    createEarth() {
        if (this.earthGroup) {
            this.scene.remove(this.earthGroup)
            this.unregisterUpdater('earth-rotation')
        }
        
        this.earthGroup = new THREE.Group()
        const earthRadius = 50
        
        // Create Earth sphere - start with base detail, will increase when zoomed
        const geometry = new THREE.SphereGeometry(earthRadius, 64, 64)
        
        // Store geometry reference for dynamic detail updates
        this.earthGeometry = geometry
        
        // Create Earth material with texture
        // Use a high-resolution map texture - try to find one with better country borders
        const loader = new THREE.TextureLoader()
        
        // Start with a simple placeholder texture - will be replaced with OSM tiles
        // Create a temporary canvas texture as placeholder
        const canvas = document.createElement('canvas')
        canvas.width = 2048
        canvas.height = 1024
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#6ba3d1'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        const earthTexture = new THREE.CanvasTexture(canvas)
        earthTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
        earthTexture.minFilter = THREE.LinearMipmapLinearFilter
        earthTexture.magFilter = THREE.LinearFilter
        earthTexture.wrapS = THREE.RepeatWrapping
        earthTexture.wrapT = THREE.RepeatWrapping
        earthTexture.generateMipmaps = true
        earthTexture.userData.isPlaceholder = true
        
        console.log('Earth placeholder texture created - will be replaced with OSM tiles')
        
        const material = new THREE.MeshStandardMaterial({
            map: earthTexture,
            color: 0xffffff,
            roughness: 0.1, // Very low roughness for sharper details
            metalness: 0.05, // Very low metalness for better color visibility
            emissive: 0x4a6a8a, // Brighter emissive for better visibility
            emissiveIntensity: 0.3 // Higher emissive intensity
        })
        
        // Store material reference for dynamic detail updates
        this.earthMaterial = material
        
        const earthMesh = new THREE.Mesh(geometry, material)
        this.earthMesh = earthMesh // Store reference for dynamic updates
        this.earthGroup.add(earthMesh)
        
        // Add atmosphere glow
        const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.02, 64, 64)
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a90e2,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        })
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
        this.earthGroup.add(atmosphere)
        
        // Add lighting for Earth
        const earthLight = new THREE.DirectionalLight(0xffffff, 1)
        earthLight.position.set(100, 50, 50)
        this.earthGroup.add(earthLight)
        
        this.scene.add(this.earthGroup)
        
        // Earth rotation disabled - static view
        
        // Immediately start loading OSM tiles for detailed map
        // Use initial zoom level (will update as user zooms)
        setTimeout(() => {
            if (this.mapMode === 'globe' && this.earthMaterial) {
                const initialZoom = 4 // Start with zoom level 4 for reasonable detail and performance
                console.log('Starting initial OSM tile load with zoom:', initialZoom)
                this.updateEarthTextureWithOSMTiles(initialZoom)
                this.currentTileZoom = initialZoom
            }
        }, 500) // Small delay to ensure everything is initialized
    }
    
    // Convert lat/lng to tile coordinates (for OpenStreetMap)
    latLngToTile(lat, lng, zoom) {
        const n = Math.pow(2, zoom)
        const x = Math.floor((lng + 180) / 360 * n)
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)
        return { x, y, z: zoom }
    }
    
    // Load a single OSM tile image
    loadOSMTile(z, x, y) {
        const tileKey = `${z}/${x}/${y}`
        
        // Check cache first
        if (this.earthTiles.has(tileKey)) {
            return Promise.resolve(this.earthTiles.get(tileKey))
        }
        
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                this.earthTiles.set(tileKey, img)
                resolve(img)
            }
            img.onerror = () => {
                // If tile fails to load, create a placeholder
                const canvas = document.createElement('canvas')
                canvas.width = 256
                canvas.height = 256
                const ctx = canvas.getContext('2d')
                ctx.fillStyle = '#6ba3d1'
                ctx.fillRect(0, 0, 256, 256)
                const placeholder = new Image()
                placeholder.src = canvas.toDataURL()
                this.earthTiles.set(tileKey, placeholder)
                resolve(placeholder)
            }
            // Use OpenStreetMap tile server (free and open source)
            img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
        })
    }
    
    // Update Earth texture with OpenStreetMap tiles for detailed map
    async updateEarthTextureWithOSMTiles(zoom) {
        if (!this.earthMaterial || !this.earthGroup || this.isUpdatingTiles) return
        
        this.isUpdatingTiles = true
        console.log('Updating Earth texture with OSM tiles, zoom level:', zoom)
        
        try {
            // Create a large canvas for the texture - use higher resolution for better detail
            const canvas = document.createElement('canvas')
            canvas.width = 8192 // Increased from 4096 for better detail
            canvas.height = 4096 // Increased from 2048 for better detail
            const ctx = canvas.getContext('2d')
            
            // Fill with base ocean color
            ctx.fillStyle = '#6ba3d1'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Calculate how many tiles we need
            const tilesPerRow = Math.pow(2, zoom)
            const tilesPerCol = Math.pow(2, zoom)
            
            // Load ALL tiles for the entire world map (not just a grid)
            // This ensures full coverage and better detail
            const gridSize = tilesPerRow // Load all tiles horizontally
            const startX = 0
            const startY = 0
            
            const tilePromises = []
            
            // Load tiles with better quality rendering
            for (let ty = startY; ty < tilesPerCol; ty++) {
                for (let tx = startX; tx < tilesPerRow; tx++) {
                    // Normalize tile coordinates (OSM uses wrap-around)
                    const normalizedX = ((tx % tilesPerRow) + tilesPerRow) % tilesPerRow
                    const normalizedY = Math.max(0, Math.min(tilesPerCol - 1, ty))
                    
                    tilePromises.push(
                        this.loadOSMTile(zoom, normalizedX, normalizedY).then(img => {
                            if (img && img.width > 0 && img.height > 0) {
                                // Calculate position on canvas - ensure precise positioning
                                const canvasX = (tx / tilesPerRow) * canvas.width
                                const canvasY = (ty / tilesPerCol) * canvas.height
                                const canvasTileWidth = (1 / tilesPerRow) * canvas.width
                                const canvasTileHeight = (1 / tilesPerCol) * canvas.height
                                
                                // Use high-quality image rendering
                                ctx.imageSmoothingEnabled = true
                                ctx.imageSmoothingQuality = 'high'
                                ctx.drawImage(img, canvasX, canvasY, canvasTileWidth, canvasTileHeight)
                            }
                        }).catch(err => {
                            console.warn(`Failed to load tile ${zoom}/${normalizedX}/${normalizedY}:`, err)
                        })
                    )
                }
            }
            
            // Wait for all tiles to load (with longer timeout for more tiles)
            await Promise.race([
                Promise.all(tilePromises),
                new Promise(resolve => setTimeout(resolve, 15000)) // 15 second timeout for more tiles
            ])
            
            console.log(`Loaded ${tilePromises.length} tiles for zoom level ${zoom}, canvas size: ${canvas.width}x${canvas.height}`)
            
            // Create texture from canvas with maximum quality settings
            const texture = new THREE.CanvasTexture(canvas)
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.magFilter = THREE.LinearFilter // Will be adjusted based on zoom
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            texture.generateMipmaps = true
            texture.flipY = false // Important for correct orientation
            
            // Update material
            if (this.earthMaterial.map && this.earthMaterial.map !== texture) {
                this.earthMaterial.map.dispose()
            }
            this.earthMaterial.map = texture
            this.earthMaterial.needsUpdate = true
            
            console.log('Earth texture updated with OSM tiles')
            
        } catch (err) {
            console.warn('Failed to update Earth texture with OSM tiles:', err)
        } finally {
            this.isUpdatingTiles = false
        }
    }
    
    // Create a marker at a specific location on Earth
    createLocationMarker(profile, position, color) {
        const group = new THREE.Group()
        group.position.copy(position)
        group.userData = {
            profileId: profile.id,
            isLocationMarker: true
        }
        
        // Point towards center of Earth
        group.lookAt(0, 0, 0)
        group.rotateX(-Math.PI / 2) // Point upward from Earth surface
        
        // Create marker sphere
        const geometry = new THREE.SphereGeometry(1.5, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const marker = new THREE.Mesh(geometry, material)
        group.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(2, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        group.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 1, 20)
        group.add(light)
        
        // Add name label
        const label = this.createNameLabel(profile.name || `${profile.firstName} ${profile.lastName}` || 'Unknown', color)
        label.position.set(0, 3, 0) // Above the marker
        group.add(label)
        
        this.scene.add(group)
        this.memberNodes.set(profile.id, group)
        
        // Animation
        const isHovered = this.hoveredMemberId === profile.id
        this.registerUpdater(`location-marker-${profile.id}`, (delta, time) => {
            const targetScale = isHovered ? 1.5 : 1.0
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            
            glow.scale.setScalar(1 + Math.sin(time * 3) * 0.1)
            
            // Always face camera for label
            if (label && this.camera) {
                label.lookAt(this.camera.position)
            }
        })
    }
    
    // Group profiles by country and count members per country
    groupProfilesByCountry(profiles) {
        const countryGroups = new Map()
        
        profiles.forEach(profile => {
            if (!profile.location || !profile.location.lat || !profile.location.lng) return
            
            const country = profile.country || profile.location.country || 'Unknown'
            const lat = profile.location.lat
            const lng = profile.location.lng
            
            if (!countryGroups.has(country)) {
                countryGroups.set(country, {
                    country: country,
                    lat: lat,
                    lng: lng,
                    profiles: [],
                    count: 0
                })
            }
            
            const group = countryGroups.get(country)
            group.profiles.push(profile)
            group.count++
            // Use average location for country marker
            group.lat = (group.lat * (group.count - 1) + lat) / group.count
            group.lng = (group.lng * (group.count - 1) + lng) / group.count
        })
        
        return countryGroups
    }
    
    // Group profiles by city for detailed zoom view
    groupProfilesByCity(profiles) {
        const cityGroups = new Map()
        
        profiles.forEach(profile => {
            if (!profile.location || !profile.location.lat || !profile.location.lng) return
            
            const city = profile.city || profile.location.city || 'Unknown'
            const country = profile.country || profile.location.country || ''
            const key = `${city}, ${country}`
            const lat = profile.location.lat
            const lng = profile.location.lng
            
            if (!cityGroups.has(key)) {
                cityGroups.set(key, {
                    city: city,
                    country: country,
                    key: key,
                    lat: lat,
                    lng: lng,
                    profiles: [],
                    count: 0
                })
            }
            
            const group = cityGroups.get(key)
            group.profiles.push(profile)
            group.count++
            // Use average location for city marker
            group.lat = (group.lat * (group.count - 1) + lat) / group.count
            group.lng = (group.lng * (group.count - 1) + lng) / group.count
        })
        
        return cityGroups
    }
    
    // Get zoom level based on camera distance
    getZoomLevel() {
        const baseDistance = 150
        const currentDistance = this.cameraDistance || baseDistance
        // Normalize: 0 = far (country view), 1 = very close (individual profiles)
        // Allow zooming extremely close (down to 0.01)
        return Math.max(0, Math.min(1, (baseDistance - currentDistance) / (baseDistance - 0.01)))
    }
    
    // Check if zoomed enough to show cities (instead of countries)
    shouldShowCities() {
        const zoomLevel = this.getZoomLevel()
        // Show cities when zoomed in more than 60% (allow more zoom before switching)
        return zoomLevel > 0.6
    }
    
    // Check if zoomed enough to show individual profiles
    shouldShowIndividualProfiles() {
        const zoomLevel = this.getZoomLevel()
        // Show individual profiles when zoomed in more than 90% (allow more zoom before switching)
        return zoomLevel > 0.9
    }
    
    // Convert lat/lng to flat map coordinates
    latLngToFlatMap(lat, lng) {
        // Map lat/lng to flat plane coordinates
        // X: -100 to 100 (longitude: -180 to 180)
        // Z: -50 to 50 (latitude: -90 to 90)
        const x = (lng / 180) * 100
        const z = -(lat / 90) * 50
        return new THREE.Vector3(x, 0, z)
    }
    
        // Create flat map plane
    createFlatMap() {
        if (this.flatMapGroup) {
            this.scene.remove(this.flatMapGroup)
        }
        
        this.flatMapGroup = new THREE.Group()
        
        // Create large plane for map
        const planeGeometry = new THREE.PlaneGeometry(200, 100)
        
        // Start with placeholder texture - will be replaced with OSM tiles
        const canvas = document.createElement('canvas')
        canvas.width = 4096
        canvas.height = 2048
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#6ba3d1'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        const mapTexture = new THREE.CanvasTexture(canvas)
        mapTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
        mapTexture.minFilter = THREE.LinearMipmapLinearFilter
        mapTexture.magFilter = THREE.LinearFilter
        mapTexture.wrapS = THREE.RepeatWrapping
        mapTexture.wrapT = THREE.RepeatWrapping
        mapTexture.generateMipmaps = true
        mapTexture.userData.isPlaceholder = true
        
        console.log('Flat map placeholder texture created - will be replaced with OSM tiles')
        
        const planeMaterial = new THREE.MeshStandardMaterial({
            map: mapTexture,
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.05,
            emissive: 0x4a6a8a,
            emissiveIntensity: 0.3
        })
        
        // Store material reference for OSM tile updates
        this.flatMapMaterial = planeMaterial
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial)
        plane.rotation.x = -Math.PI / 2 // Rotate to be horizontal
        this.flatMapGroup.add(plane)
        
        // Add grid for reference
        const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222)
        this.flatMapGroup.add(gridHelper)
        
        this.scene.add(this.flatMapGroup)
        
        // Immediately start loading OSM tiles for flat map
        setTimeout(() => {
            if (this.mapMode === 'flat' && this.flatMapMaterial) {
                const initialZoom = 4 // Start with zoom level 4
                console.log('Starting initial OSM tile load for flat map with zoom:', initialZoom)
                this.updateFlatMapTextureWithOSMTiles(initialZoom)
                this.currentFlatMapTileZoom = initialZoom
            }
        }, 500)
    }
    
    // Update Flat Map texture with OpenStreetMap tiles for detailed map
    async updateFlatMapTextureWithOSMTiles(zoom) {
        if (!this.flatMapMaterial || !this.flatMapGroup || this.isUpdatingFlatMapTiles) return
        
        this.isUpdatingFlatMapTiles = true
        console.log('Updating Flat Map texture with OSM tiles, zoom level:', zoom)
        
        try {
            // Create a large canvas for the texture
            const canvas = document.createElement('canvas')
            canvas.width = 8192
            canvas.height = 4096
            const ctx = canvas.getContext('2d')
            
            // Fill with base ocean color
            ctx.fillStyle = '#6ba3d1'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Calculate how many tiles we need
            const tilesPerRow = Math.pow(2, zoom)
            const tilesPerCol = Math.pow(2, zoom)
            
            // Load ALL tiles for the entire world map
            const tilePromises = []
            
            // Load tiles with better quality rendering
            for (let ty = 0; ty < tilesPerCol; ty++) {
                for (let tx = 0; tx < tilesPerRow; tx++) {
                    // Normalize tile coordinates (OSM uses wrap-around)
                    const normalizedX = ((tx % tilesPerRow) + tilesPerRow) % tilesPerRow
                    const normalizedY = Math.max(0, Math.min(tilesPerCol - 1, ty))
                    
                    tilePromises.push(
                        this.loadOSMTile(zoom, normalizedX, normalizedY).then(img => {
                            if (img && img.width > 0 && img.height > 0) {
                                // Calculate position on canvas - ensure precise positioning
                                const canvasX = (tx / tilesPerRow) * canvas.width
                                const canvasY = (ty / tilesPerCol) * canvas.height
                                const canvasTileWidth = (1 / tilesPerRow) * canvas.width
                                const canvasTileHeight = (1 / tilesPerCol) * canvas.height
                                
                                // Use high-quality image rendering
                                ctx.imageSmoothingEnabled = true
                                ctx.imageSmoothingQuality = 'high'
                                ctx.drawImage(img, canvasX, canvasY, canvasTileWidth, canvasTileHeight)
                            }
                        }).catch(err => {
                            console.warn(`Failed to load flat map tile ${zoom}/${normalizedX}/${normalizedY}:`, err)
                        })
                    )
                }
            }
            
            // Wait for all tiles to load (with longer timeout for more tiles)
            await Promise.race([
                Promise.all(tilePromises),
                new Promise(resolve => setTimeout(resolve, 15000)) // 15 second timeout
            ])
            
            console.log(`Loaded ${tilePromises.length} tiles for flat map zoom level ${zoom}, canvas size: ${canvas.width}x${canvas.height}`)
            
            // Create texture from canvas with maximum quality settings
            const texture = new THREE.CanvasTexture(canvas)
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.magFilter = THREE.LinearFilter
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            texture.generateMipmaps = true
            texture.flipY = false
            
            // Update material
            if (this.flatMapMaterial.map && this.flatMapMaterial.map !== texture) {
                this.flatMapMaterial.map.dispose()
            }
            this.flatMapMaterial.map = texture
            this.flatMapMaterial.needsUpdate = true
            
            console.log('Flat Map texture updated with OSM tiles')
            
        } catch (err) {
            console.warn('Failed to update Flat Map texture with OSM tiles:', err)
        } finally {
            this.isUpdatingFlatMapTiles = false
        }
    }
    
    // Create country marker on globe
    createCountryMarker(group, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            country: group.country,
            isCountryMarker: true,
            profiles: group.profiles
        }
        
        // Point towards center of Earth
        markerGroup.lookAt(0, 0, 0)
        markerGroup.rotateX(-Math.PI / 2)
        
        // Create marker sphere (size based on member count)
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 1, 30)
        markerGroup.add(light)
        
        // Add very small label with country name only (no count)
        const labelText = group.country
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.3) // Make label much smaller
        label.position.set(0, size + 1, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`country-${group.country}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `country-${group.country}`
        this.registerUpdater(`country-marker-${group.country}`, (delta, time) => {
            // Scale based on zoom level
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - (zoomLevel * 0.3) // Reduce size as you zoom in
            const baseScale = isHovered ? 1.2 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 3) * 0.1) * zoomScale)
            
            // Scale label based on zoom (gets smaller as you zoom in)
            if (label) {
                const labelScale = Math.max(0.15, 0.3 - zoomLevel * 0.2) // Label gets smaller as you zoom
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Create city marker on globe
    createCityMarker(group, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            city: group.city,
            country: group.country,
            key: group.key,
            isCityMarker: true,
            profiles: group.profiles
        }
        
        // Point towards center of Earth
        markerGroup.lookAt(0, 0, 0)
        markerGroup.rotateX(-Math.PI / 2)
        
        // Create marker sphere
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 1, 20)
        markerGroup.add(light)
        
        // Very small label with city name (no country)
        const labelText = group.city
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.25) // Make label much smaller
        label.position.set(0, size + 0.8, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`city-${group.key}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `city-${group.key}`
        this.registerUpdater(`city-marker-${group.key}`, (delta, time) => {
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - ((zoomLevel - 0.5) * 0.3)
            const baseScale = isHovered ? 1.2 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 3) * 0.1) * zoomScale)
            
            if (label) {
                const labelScale = Math.max(0.2, 0.25 - (zoomLevel - 0.5) * 0.15)
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Create city marker on flat map
    createCityMarkerFlat(group, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            city: group.city,
            country: group.country,
            key: group.key,
            isCityMarker: true,
            profiles: group.profiles
        }
        
        // Create marker sphere
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 1, 20)
        markerGroup.add(light)
        
        // Very small label with city name (no country)
        const labelText = group.city
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.25) // Make label much smaller
        label.position.set(0, size + 0.8, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`city-${group.key}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `city-${group.key}`
        this.registerUpdater(`city-marker-flat-${group.key}`, (delta, time) => {
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - ((zoomLevel - 0.5) * 0.3)
            const baseScale = isHovered ? 1.2 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 3) * 0.1) * zoomScale)
            
            if (label) {
                const labelScale = Math.max(0.2, 0.25 - (zoomLevel - 0.5) * 0.15)
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Create individual profile marker on globe
    createIndividualProfileMarker(profile, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            profileId: profile.id,
            profile: profile,
            isIndividualMarker: true
        }
        
        // Point towards center of Earth
        markerGroup.lookAt(0, 0, 0)
        markerGroup.rotateX(-Math.PI / 2)
        
        // Create marker sphere
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.9
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.4, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 0.8, 15)
        markerGroup.add(light)
        
        // Very small label with profile name
        const labelText = profile.name || `${profile.firstName} ${profile.lastName}`.trim()
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.2) // Very small label
        label.position.set(0, size + 0.5, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`individual-${profile.id}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `individual-${profile.id}`
        this.registerUpdater(`individual-marker-${profile.id}`, (delta, time) => {
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - (zoomLevel - 0.8) * 0.3
            const baseScale = isHovered ? 1.3 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 4) * 0.15) * zoomScale)
            
            if (label) {
                const labelScale = Math.max(0.15, 0.2 - (zoomLevel - 0.8) * 0.15)
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Create individual profile marker on flat map
    createIndividualProfileMarkerFlat(profile, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            profileId: profile.id,
            profile: profile,
            isIndividualMarker: true
        }
        
        // Create marker sphere
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.9
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.4, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 0.8, 15)
        markerGroup.add(light)
        
        // Very small label with profile name
        const labelText = profile.name || `${profile.firstName} ${profile.lastName}`.trim()
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.2) // Very small label
        label.position.set(0, size + 0.5, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`individual-${profile.id}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `individual-${profile.id}`
        this.registerUpdater(`individual-marker-flat-${profile.id}`, (delta, time) => {
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - (zoomLevel - 0.8) * 0.3
            const baseScale = isHovered ? 1.3 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 4) * 0.15) * zoomScale)
            
            if (label) {
                const labelScale = Math.max(0.15, 0.2 - (zoomLevel - 0.8) * 0.15)
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Create country marker on flat map
    createCountryMarkerFlat(group, position, color, size) {
        const markerGroup = new THREE.Group()
        markerGroup.position.copy(position)
        markerGroup.userData = {
            country: group.country,
            isCountryMarker: true,
            profiles: group.profiles
        }
        
        // Create marker sphere (size based on member count)
        const geometry = new THREE.SphereGeometry(size, 16, 16)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        })
        const marker = new THREE.Mesh(geometry, material)
        markerGroup.add(marker)
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16)
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        markerGroup.add(glow)
        
        // Add point light
        const light = new THREE.PointLight(color, 1, 30)
        markerGroup.add(light)
        
        // Add very small label with country name only (no count)
        const labelText = group.country
        const label = this.createNameLabel(labelText, color)
        label.scale.setScalar(0.3) // Make label much smaller
        label.position.set(0, size + 1, 0)
        markerGroup.add(label)
        
        this.scene.add(markerGroup)
        this.memberNodes.set(`country-${group.country}`, markerGroup)
        
        // Animation with zoom-based scaling
        const isHovered = this.hoveredMemberId === `country-${group.country}`
        this.registerUpdater(`country-marker-flat-${group.country}`, (delta, time) => {
            // Scale based on zoom level
            const zoomLevel = this.getZoomLevel()
            const zoomScale = 1 - (zoomLevel * 0.3) // Reduce size as you zoom in
            const baseScale = isHovered ? 1.2 : 1.0
            const targetScale = baseScale * zoomScale
            
            marker.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
            glow.scale.setScalar((1 + Math.sin(time * 3) * 0.1) * zoomScale)
            
            // Scale label based on zoom (gets smaller as you zoom in)
            if (label) {
                const labelScale = Math.max(0.15, 0.3 - zoomLevel * 0.2) // Label gets smaller as you zoom
                label.scale.setScalar(labelScale)
                if (this.camera) {
                    label.lookAt(this.camera.position)
                }
            }
        })
    }
    
    // Render 3D globe view
    renderGlobeView(profilesWithLocation, preserveCamera = false) {
        // Ensure Earth is created
        if (!this.earthGroup) {
            this.createEarth()
        }
        
        // Remove flat map if exists
        if (this.flatMapGroup) {
            this.scene.remove(this.flatMapGroup)
            this.flatMapGroup = null
        }
        
        // NO MARKERS - just the detailed map
        
        // Set camera to view Earth (only if not already set - don't reset if user is zooming)
        if (!preserveCamera && this.camera.position.length() < 10) {
            this.camera.position.set(0, 0, 150)
            // Reset controls for globe view - ensure zoom limits are correct
            this.controls.target.set(0, 0, 0)
            this.controls.minDistance = 0.1 // Allow very close zoom to see details
            this.controls.maxDistance = 5000 // Allow far zoom out
            this.controls.zoomSpeed = 2.0 // Faster zoom for better control
            this.controls.dampingFactor = 0.05 // Reduced damping for smoother movement
            this.controls.screenSpacePanning = true // Enable screen space panning
            this.controls.update()
        } else if (preserveCamera) {
            // Just update zoom limits without resetting camera
            this.controls.minDistance = 0.1
            this.controls.maxDistance = 5000
            this.controls.zoomSpeed = 2.0
        }
        
        console.log('Globe view rendered')
    }
    
    // Render 2D flat map view
    renderFlatMapView(profilesWithLocation, preserveCamera = false) {
        // Remove Earth if exists
        if (this.earthGroup) {
            this.scene.remove(this.earthGroup)
            this.earthGroup = null
        }
        
        // Create flat map
        if (!this.flatMapGroup) {
            this.createFlatMap()
        }
        
        // NO MARKERS - just the detailed map
        
        // Set camera to view flat map (only if not preserving camera position)
        if (!preserveCamera) {
            this.camera.position.set(0, 50, 0)
            this.camera.lookAt(0, 0, 0)
            
            // Reset controls for flat map view - ensure zoom limits are correct
            this.controls.target.set(0, 0, 0)
            this.controls.minDistance = 0.1 // Allow very close zoom to see details
            this.controls.maxDistance = 5000 // Allow far zoom out
            this.controls.zoomSpeed = 2.0 // Faster zoom for better control
            this.controls.dampingFactor = 0.05 // Reduced damping for smoother movement
            this.controls.screenSpacePanning = true // Enable screen space panning
            this.controls.update()
        } else {
            // Just update zoom limits without resetting camera
            this.controls.minDistance = 0.1
            this.controls.maxDistance = 5000
            this.controls.zoomSpeed = 2.0
        }
        
        console.log('Flat map view rendered')
    }
    
    // Render map view with profiles on their locations
    renderGalaxyView() {
        // Clear tree view
        this.clearTreeView()
        
        const profiles = this.familyTree.getAllProfiles()
        console.log('Rendering map view with profiles:', profiles.length)
        
        if (profiles.length === 0) {
            console.warn('No profiles to render')
            return
        }
        
        const profilesWithLocation = profiles.filter(p => p.location && p.location.lat && p.location.lng)
        
        console.log('Profiles with location:', profilesWithLocation.length)
        
        if (profilesWithLocation.length === 0) {
            console.warn('No profiles with location data')
            return
        }
        
        if (this.mapMode === 'globe') {
            this.renderGlobeView(profilesWithLocation)
        } else {
            this.renderFlatMapView(profilesWithLocation)
        }
        
        // Watch for zoom changes and re-render when zoom level changes significantly
        // Use a debounced approach to avoid too frequent re-renders
        this.registerUpdater('zoom-watcher', () => {
            const currentZoom = this.getZoomLevel()
            const shouldShowIndividual = this.shouldShowIndividualProfiles()
            const lastShowIndividual = this.lastShowIndividual !== undefined ? this.lastShowIndividual : false
            
            // Re-render when switching between individual/grouped views
            if (shouldShowIndividual !== lastShowIndividual) {
                if (this.zoomWatcherTimeout) {
                    clearTimeout(this.zoomWatcherTimeout)
                }
                this.zoomWatcherTimeout = setTimeout(() => {
                    if (this.mapMode === 'globe') {
                        this.renderGlobeView(profilesWithLocation, true) // Preserve camera position
                    } else {
                        this.renderFlatMapView(profilesWithLocation, true) // Preserve camera position
                    }
                    this.zoomWatcherTimeout = null
                }, 200) // Increased delay to prevent too frequent re-renders
                this.lastShowIndividual = shouldShowIndividual
            }
            
            // Also re-render on significant zoom changes (every 15% change, not 10%)
            if (this.lastZoomLevel !== undefined && Math.abs(currentZoom - this.lastZoomLevel) > 0.15) {
                if (this.zoomWatcherTimeout) {
                    clearTimeout(this.zoomWatcherTimeout)
                }
                this.zoomWatcherTimeout = setTimeout(() => {
                    if (this.mapMode === 'globe') {
                        this.renderGlobeView(profilesWithLocation, true) // Preserve camera position
                    } else {
                        this.renderFlatMapView(profilesWithLocation, true) // Preserve camera position
                    }
                    this.zoomWatcherTimeout = null
                }, 300) // Increased delay to prevent too frequent re-renders
                this.lastZoomLevel = currentZoom
            } else if (this.lastZoomLevel === undefined) {
                this.lastZoomLevel = currentZoom
            }
        })
    }
    
    createFamilyCluster(familyId, profiles, position, color) {
        console.log(`Creating family cluster ${familyId} with ${profiles.length} profiles`)
        
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
        console.log(`Family cluster ${familyId} added to scene. Scene children count:`, this.scene.children.length)
        
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
        // Remove country and city markers
        this.memberNodes.forEach((node, id) => {
            if (node.userData.isCountryMarker) {
                this.scene.remove(node)
                this.unregisterUpdater(`country-marker-${node.userData.country}`)
                this.unregisterUpdater(`country-marker-flat-${node.userData.country}`)
            }
            if (node.userData.isCityMarker) {
                this.scene.remove(node)
                this.unregisterUpdater(`city-marker-${node.userData.key}`)
                this.unregisterUpdater(`city-marker-flat-${node.userData.key}`)
            }
        })
        
        // Remove old markers from memberNodes map
        const markers = Array.from(this.memberNodes.entries()).filter(([id, node]) => 
            node.userData.isCountryMarker || node.userData.isCityMarker
        )
        markers.forEach(([id]) => {
            this.memberNodes.delete(id)
        })
        
        // Remove family groups (if any remain from old code)
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
        
        if (this.earthGroup) {
            this.scene.remove(this.earthGroup)
        }
        
        if (this.flatMapGroup) {
            this.scene.remove(this.flatMapGroup)
        }
        
        if (this.composer) {
            this.composer.dispose()
        }
        if (this.renderer) {
            this.renderer.dispose()
        }
    }
}
