<template>
  <div class="tree-2d-container">
    <div class="tree-content">
      <div
        class="tree-canvas"
        ref="treeCanvasRef"
        @wheel.prevent="handleWheel"
        @mousedown="startPan"
        @mousemove="handlePan"
        @mouseup="stopPan"
        @mouseleave="stopPan"
        :class="{ 'is-panning': zoomState.isDragging, 'interactive': props.isInteractive }"
      >
        <div class="tree-transform-group" :style="transformStyle">
          <svg class="tree-lines" v-if="visibleNodes.length > 0">
            <line
              v-for="(line, index) in connectionLines"
              :key="`line-${index}`"
              :x1="line.x1"
              :y1="line.y1"
              :x2="line.x2"
              :y2="line.y2"
              class="connection-line"
            />
          </svg>

          <div
            v-for="node in visibleNodes"
            :key="node.id"
            class="tree-node"
            :class="{ 'root-node': node.id === rootId, 'selected': selectedNode === node.id }"
            :style="{ left: node.x + 'px', top: node.y + 'px' }"
            @dblclick.stop="handleNodeClick(node.id)"
            @mousedown.stop="startDrag(node.id, $event)"
          >
            <div class="node-card">
              <div class="node-avatar-wrapper">
                <div class="node-avatar">
                  {{ node.firstName.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="node-info">
                <div class="node-name">
                  {{ node.firstName }} {{ node.lastName }}
                </div>
                <div class="node-details">
                  <span v-if="node.age">{{ node.age }} god</span>
                  <span v-if="node.city || node.country">
                    📍 {{ [node.city, node.country].filter(Boolean).join(', ') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side Panel -->
      <transition name="slide">
        <div v-if="selectedNode" class="side-panel open" ref="sidePanelRef">
          <button class="close-btn" @click="deselectNode">✕</button>
          
          <div class="panel-content" v-if="selectedProfile">
            <div class="panel-header">
              <div class="panel-avatar-large">
                <span>{{ selectedProfile.firstName.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h2>{{ selectedProfile.firstName }} {{ selectedProfile.lastName }}</h2>
                <p class="subtitle">{{ selectedProfile.age ? selectedProfile.age + ' godina' : 'Godine nepoznate' }}</p>
              </div>
            </div>

            <div class="panel-info">
              <div class="info-item">
                <strong>Lokacija:</strong>
                <span>{{ [selectedProfile.city, selectedProfile.country].filter(Boolean).join(', ') || 'Nepoznato' }}</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'

const props = defineProps({
  mapInstance: {
    type: Object,
    default: null  // opciono – ako nema mape, ništa se ne radi
  },
  isInteractive: {
    type: Boolean,
    default: false  // kontroliše da li je stablo interaktivno
  }
})

const emit = defineEmits(['focusOnLocation'])

// === HARD-CODED PODACI SA LAT/LNG ===
const rootId = 'marko'
const profiles = [
  { id: 'petar', firstName: 'Petar', lastName: 'Marković', age: 70, city: 'Beograd', country: 'Srbija', lat: 44.8176, lng: 20.4633 },
  { id: 'marko', firstName: 'Marko', lastName: 'Marković', age: 45, city: 'Beograd', country: 'Srbija', lat: 44.8176, lng: 20.4633, parentId: 'petar', spouseId: 'ana' },
  { id: 'ana',   firstName: 'Ana',   lastName: 'Marković', age: 42, city: 'Beograd', country: 'Srbija', lat: 44.8176, lng: 20.4633, spouseId: 'marko' },
  { id: 'luka',  firstName: 'Luka',  lastName: 'Marković', age: 16, city: 'Beograd', country: 'Srbija', lat: 44.8176, lng: 20.4633, parentId: 'marko' },
  { id: 'sara',  firstName: 'Sara',  lastName: 'Marković', age: 12, city: 'Beograd', country: 'Srbija', lat: 44.8176, lng: 20.4633, parentId: 'marko' },
  { id: 'milan', firstName: 'Milan', lastName: 'Petrović', age: 48, city: 'Novi Sad', country: 'Srbija', lat: 45.2671, lng: 19.8335 },
]

// === STANJE I LAYOUT (isto kao pre) ===
const selectedNode = ref(null)
const nodePositions = ref(new Map())
const dragState = ref({ isDragging: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0 })
const draggingNode = ref(null)

const zoomState = ref({ scale: 1, offsetX: 0, offsetY: 0, isDragging: false, lastX: 0, lastY: 0 })
const treeCanvasRef = ref(null)
const sidePanelRef = ref(null)

const calculateLayout = () => {
  const layout = new Map()
  const nodeWidth = 180    // manje kartice
  const hSpacing = 220
  const vSpacing = 150

  layout.set('marko', { x: 800, y: 400 })
  layout.set('petar', { x: 800, y: 400 - vSpacing })
  layout.set('ana',   { x: 800 + hSpacing, y: 400 })
  layout.set('luka',  { x: 800 - hSpacing / 2, y: 400 + vSpacing })
  layout.set('sara',  { x: 800 + hSpacing / 2, y: 400 + vSpacing })
  layout.set('milan', { x: 1000, y: 100 })

  return layout
}

const baseLayout = calculateLayout()

const visibleNodes = computed(() => {
  return profiles.map(p => {
    const base = baseLayout.get(p.id) || { x: 0, y: 0 }
    const dragPos = nodePositions.value.get(p.id)
    return { ...p, x: dragPos ? dragPos.x : base.x, y: dragPos ? dragPos.y : base.y }
  })
})

const selectedProfile = computed(() => profiles.find(p => p.id === selectedNode.value) || null)

const connectionLines = computed(() => {
  const lines = []
  const cardCenterX = 90 // Pola širine kartice (180px / 2)
  const cardHeight = 60 // Približna visina kartice
  const cardCenterY = cardHeight / 2
  
  profiles.forEach(node => {
    if (node.parentId) {
      const parent = visibleNodes.value.find(n => n.id === node.parentId)
      const child = visibleNodes.value.find(n => n.id === node.id)
      if (parent && child) {
        lines.push({ 
          x1: parent.x + cardCenterX, 
          y1: parent.y + cardHeight, 
          x2: child.x + cardCenterX, 
          y2: child.y 
        })
      }
    }
    if (node.spouseId && node.id < node.spouseId) {
      const a = visibleNodes.value.find(n => n.id === node.id)
      const b = visibleNodes.value.find(n => n.id === node.spouseId)
      if (a && b) {
        lines.push({ 
          x1: a.x + cardCenterX, 
          y1: a.y + cardCenterY, 
          x2: b.x + cardCenterX, 
          y2: b.y + cardCenterY 
        })
      }
    }
  })
  return lines
})

const transformStyle = computed(() => ({
  transform: `translate(${zoomState.value.offsetX}px, ${zoomState.value.offsetY}px) scale(${zoomState.value.scale})`,
  transformOrigin: '0 0'
}))

// === KLJUČNA FUNKCIJA – radi i sa i bez mape ===
const handleNodeClick = (id) => {
  selectNode(id)

  const profile = profiles.find(p => p.id === id)
  if (profile) {
    // Emituj event sa podacima profila da Tree3D otvori modal
    emit('focusOnLocation', profile)
  }
}

const selectNode = (id) => { selectedNode.value = id }
const deselectNode = () => { selectedNode.value = null }

// === ZOOM I PAN FUNKCIJE ===
const handleWheel = (event) => {
  if (!treeCanvasRef.value) {
    console.log('handleWheel: treeCanvasRef nije dostupan')
    return
  }
  if (!props.isInteractive) {
    console.log('handleWheel: isInteractive je false', props.isInteractive)
    return
  }
  console.log('handleWheel: aktivno, isInteractive:', props.isInteractive)
  
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const rect = treeCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  // Zoom na poziciju miša
  const newScale = Math.max(0.1, Math.min(3, zoomState.value.scale * delta))
  const scaleChange = newScale / zoomState.value.scale
  
  // Prilagoditi offset da zoom bude na poziciji miša
  zoomState.value.offsetX = mouseX - (mouseX - zoomState.value.offsetX) * scaleChange
  zoomState.value.offsetY = mouseY - (mouseY - zoomState.value.offsetY) * scaleChange
  zoomState.value.scale = newScale
}

const startPan = (event) => {
  if (!props.isInteractive) {
    console.log('startPan: isInteractive je false')
    return
  }
  console.log('startPan: aktivno')
  if (event.target.closest('.tree-node')) return // Ne panuj ako kliknemo na čvor
  zoomState.value.isDragging = true
  zoomState.value.lastX = event.clientX
  zoomState.value.lastY = event.clientY
}

const handlePan = (event) => {
  if (!zoomState.value.isDragging) return
  
  const deltaX = event.clientX - zoomState.value.lastX
  const deltaY = event.clientY - zoomState.value.lastY
  
  zoomState.value.offsetX += deltaX
  zoomState.value.offsetY += deltaY
  
  zoomState.value.lastX = event.clientX
  zoomState.value.lastY = event.clientY
}

const stopPan = () => {
  zoomState.value.isDragging = false
}

// === DRAG ČVOROVA ===
const startDrag = (nodeId, event) => {
  if (!props.isInteractive) return
  event.stopPropagation()
  draggingNode.value = nodeId
  dragState.value.isDragging = true
  dragState.value.startX = event.clientX
  dragState.value.startY = event.clientY
  
  const node = visibleNodes.value.find(n => n.id === nodeId)
  if (node) {
    dragState.value.nodeX = node.x
    dragState.value.nodeY = node.y
  }
  
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const handleDrag = (event) => {
  if (!dragState.value.isDragging || !draggingNode.value) return
  
  const deltaX = (event.clientX - dragState.value.startX) / zoomState.value.scale
  const deltaY = (event.clientY - dragState.value.startY) / zoomState.value.scale
  
  const newX = dragState.value.nodeX + deltaX
  const newY = dragState.value.nodeY + deltaY
  
  nodePositions.value.set(draggingNode.value, { x: newX, y: newY })
}

const stopDrag = () => {
  dragState.value.isDragging = false
  draggingNode.value = null
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const handleOutsideClick = (event) => {
  if (sidePanelRef.value && !sidePanelRef.value.contains(event.target) && !event.target.closest('.tree-node')) {
    deselectNode()
  }
}

// Watch za isInteractive prop
watch(() => props.isInteractive, (newVal) => {
  console.log('Tree2D: isInteractive promenjeno na:', newVal)
  if (treeCanvasRef.value) {
    if (newVal) {
      treeCanvasRef.value.style.pointerEvents = 'auto'
    } else {
      treeCanvasRef.value.style.pointerEvents = 'none'
    }
  }
}, { immediate: true })

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  if (treeCanvasRef.value) {
    treeCanvasRef.value.scrollTo({
      left: 800 - window.innerWidth / 2,
      top: 400 - window.innerHeight / 2,
      behavior: 'smooth'
    })
  }
  console.log('Tree2D mounted, isInteractive:', props.isInteractive)
})
</script>

<style scoped>
.tree-2d-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: transparent; /* Transparentna za overlay */
  display: flex;
  flex-direction: column;
}
.node-card {
  width: 180px !important;
  padding: 10px 12px !important;
}

.node-avatar {
  width: 40px !important;
  height: 40px !important;
  font-size: 1.2rem !important;
}

.node-name { font-size: 0.95rem !important; }
.node-details { font-size: 0.75rem !important; }

.tree-transform-group { 
  position: relative; 
  width: 100%; 
  height: 100%; 
  transform-origin: 0 0;
  will-change: transform;
}
.tree-node { position: absolute; }
.tree-lines { position: absolute; inset: 0; pointer-events: none; }
.connection-line { stroke: #c4b5fd; stroke-width: 4; stroke-opacity: 0.9; }
.tree-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent; /* Transparentna za overlay */
  cursor: default;
  pointer-events: none !important; /* Po defaultu ne blokira */
}

.tree-canvas.interactive {
  pointer-events: auto !important; /* Kada je interaktivno, blokira */
  cursor: grab;
}

.tree-canvas.interactive.is-panning {
  cursor: grabbing;
}

.tree-canvas.interactive .tree-node {
  cursor: pointer;
}

/* Kartica čvora */
.node-card {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 12px;
  padding: 10px 12px;
  width: 180px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.node-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}

.node-avatar-wrapper {
  margin-right: 10px;
}

.node-avatar, .node-image {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  font-weight: bold;
  overflow: hidden;
  flex-shrink: 0;
}

.node-image {
  background: none;
}

.node-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-details {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.3;
}

/* Side panel */
.side-panel {
  position: absolute;
  top: 0;
  right: -380px; /* Početna pozicija van ekrana */
  width: 380px;
  height: 100%;
  background: white;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  padding: 2rem;
  overflow-y: auto;
  transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.side-panel.open {
  right: 0; /* Kad je otvoren – uđe u ekran */
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.8rem;
  color: #94a3b8;
  cursor: pointer;
}

.panel-header {
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
}

.panel-avatar-large {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: white;
  margin-right: 1.5rem;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.panel-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.panel-header h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  color: #64748b;
  margin-top: 0.5rem;
}

.info-item {
  margin-bottom: 1.2rem;
  line-height: 1.6;
}

.info-item strong {
  color: #334155;
}

.panel-actions {
  margin-top: 3rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn {
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-add { background: #10b981; color: white; }
.btn-add:hover { background: #059669; }

.btn-edit { background: #3b82f6; color: white; }
.btn-edit:hover { background: #2563eb; }

.btn-delete { background: #ef4444; color: white; }
.btn-delete:hover { background: #dc2626; }
.btn-delete:disabled { background: #fca5a5; cursor: not-allowed; }

/* Animacija slide */
.slide-enter-active {
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-enter-from {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(100%);
}

.context-menu {
  position: fixed;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  padding: 0.5rem 0;
  z-index: 10000;
  min-width: 220px;
  border: 1px solid #e2e8f0;
}

.menu-title {
  padding: 0.8rem 1.5rem;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.menu-item {
  padding: 0.9rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #f0f9ff;
}

.menu-item.cancel {
  color: #ef4444;
}

.menu-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 0.5rem 0;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.9);
}

.empty-content {
  text-align: center;
  background: white;
  padding: 3rem;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.1);
}

.empty-content h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #1e293b;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
}
.tree-2d-container { height: 100vh; width: 100vw; overflow: hidden; background: #f5f7fa; display: flex; flex-direction: column; }
.tree-content { flex: 1; position: relative; overflow: hidden; }
.tree-canvas { width: 100%; height: 100%; overflow: hidden; background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%); }
.tree-transform-group {
  position: relative;     /* obavezno – da bi absolute deca imala kontekst */
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.tree-node {
  position: absolute;     /* OVO JE KLJUČNI FIX */
}
.connection-line { stroke: #94a3b8; stroke-width: 3; }

.node-card {
  display: flex; align-items: center; background: white; border-radius: 20px;
  padding: 16px 20px; width: 320px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  cursor: pointer; transition: all 0.3s ease;
}
.node-card:hover { transform: translateY(-6px); box-shadow: 0 16px 35px rgba(0,0,0,0.15); }

.node-avatar-wrapper { margin-right: 16px; }
.node-avatar {
  width: 70px; height: 70px; border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 2rem; font-weight: bold;
}

.node-name { font-size: 1.3rem; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
.node-details { font-size: 0.95rem; color: #64748b; }

.side-panel {
  position: absolute; top: 0; right: -380px; width: 380px; height: 100%;
  background: white; box-shadow: -8px 0 30px rgba(0,0,0,0.12); z-index: 1000;
  padding: 2rem; overflow-y: auto; transition: right 0.4s cubic-bezier(0.25,0.8,0.25,1);
}
.side-panel.open { right: 0; }

.close-btn { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.8rem; color: #94a3b8; cursor: pointer; }

.panel-header { display: flex; align-items: center; margin-bottom: 2rem; }
.panel-avatar-large {
  width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white; margin-right: 1.5rem;
}
.panel-header h2 { font-size: 1.8rem; font-weight: 700; color: #1e293b; }
.subtitle { color: #64748b; margin-top: 0.5rem; }

.info-item { margin-bottom: 1.2rem; line-height: 1.6; }
.info-item strong { color: #334155; }

.slide-enter-active, .slide-leave-active { transition: transform 0.4s cubic-bezier(0.25,0.8,0.25,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

.tree-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;   /* da ne blokira klikove na čvorove */
}
</style>