<template>
  <div class="tree-2d-container">
    <AppHeader />

    <!-- Uklonjen page-header sa naslovom i dugmićima da bi canvas bio full-screen -->
    
    <div class="tree-content">
      <div
        class="tree-canvas"
        ref="treeCanvasRef"
        @wheel.prevent="handleWheel"
        @mousedown="startPan"
        @mousemove="handlePan"
        @mouseup="stopPan"
        @mouseleave="stopPan"
        :style="{ cursor: zoomState.isDragging ? 'grabbing' : 'grab' }"
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
            :class="{ 'root-node': node.id === familyTree.rootProfileId, 'selected': selectedNode === node.id }"
            :style="{ left: node.x + 'px', top: node.y + 'px' }"
            @click.stop="selectNode(node.id)"
            @dblclick.stop="editProfile(node.id)"
            @contextmenu.prevent="showContextMenu(node.id, $event)"
            @mousedown.stop="startDrag(node.id, $event)"
          >
            <div class="node-card">
              <div class="node-avatar-wrapper">
                <img v-if="node.profileImage" :src="node.profileImage" alt="Slika" class="node-image" />
                <div v-else class="node-avatar">
                  {{ (node.profile?.firstName || node.name)?.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="node-info">
                <div class="node-name">
                  {{ node.profile?.firstName || node.name }} {{ node.profile?.lastName || '' }}
                </div>
                <div class="node-details">
                  <span v-if="node.age">{{ node.age }} god</span>
                  <span v-if="node.profile?.city || node.profile?.country">
                    📍 {{ [node.profile?.city, node.profile?.country].filter(Boolean).join(', ') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side Panel – otvara se samo kad se klikne na čvor -->
      <transition
  name="slide"
  @enter="onPanelEnter"
  @leave="onPanelLeave"
>
        <div v-if="selectedNode" class="side-panel open" ref="sidePanelRef">
          <button class="close-btn" @click="deselectNode">✕</button>
          
          <div class="panel-content" v-if="selectedProfile">
            <div class="panel-header">
              <div class="panel-avatar-large">
                <img v-if="selectedProfile.profileImage" :src="selectedProfile.profileImage" alt="Profil" />
                <span v-else>{{ selectedProfile.name.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h2>{{ selectedProfile.name }}</h2>
                <p class="subtitle">{{ selectedProfile.age ? selectedProfile.age + ' godina' : 'Godine nepoznate' }}</p>
              </div>
            </div>

            <div class="panel-info">
              <div class="info-item">
                <strong>Lokacija:</strong>
                <span>{{ [selectedProfile.profile?.city, selectedProfile.profile?.country].filter(Boolean).join(', ') || 'Nepoznato' }}</span>
              </div>
              <div class="info-item">
                <strong>Biografija:</strong>
                <span>{{ selectedProfile.profile?.bio || 'Nema biografije.' }}</span>
              </div>
            </div>

            <div class="panel-actions">
              <button class="btn btn-add" @click="showQuickAddMenu(selectedNode)">
                👨‍👩‍👧‍👦 Dodaj rođaka
              </button>
              <button class="btn btn-edit" @click="editProfile(selectedNode)">
                ✏️ Uredi profil
              </button>
              <button 
                class="btn btn-delete" 
                @click="deleteProfile(selectedNode)"
                :disabled="selectedNode === familyTree.rootProfileId && familyTree.getAllProfiles().length > 1"
              >
                🗑️ Obriši profil
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- Kontekstni meni za dodavanje rođaka -->
      <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
        <div class="menu-title">Dodaj rođaka</div>
        <div class="menu-item" @click="addRelation('child')">👶 Dete</div>
        <div class="menu-item" @click="addRelation('parent')">👴 Roditelj</div>
        <div class="menu-item" @click="addRelation('sibling')">👦 Brat / 👧 Sestra</div>
        <div class="menu-item" @click="addRelation('spouse')">💍 Supružnik</div>
        <div class="menu-divider"></div>
        <div class="menu-item cancel" @click="closeContextMenu">Otkaži</div>
      </div>

      <!-- Empty state -->
      <div v-if="visibleNodes.length === 0" class="empty-state">
        <div class="empty-content">
          <h2>Počni svoje porodično stablo</h2>
          <p>Dodajte prvi profil da započnete</p>
          <button @click="showStartModal = true" class="btn-large">+ Dodaj profil</button>
        </div>
      </div>
    </div>

    <StartBuildingTreeModal :show="showStartModal" @close="showStartModal = false" @saved="handleProfileCreated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFamilyTreeStore } from '../stores/familyTree'
import AppHeader from '../components/AppHeader.vue'
import StartBuildingTreeModal from '../components/StartBuildingTreeModal.vue'

const router = useRouter()
const route = useRoute()
const { familyTree } = useFamilyTreeStore()

const treeCanvasRef = ref(null)
const sidePanelRef = ref(null)
const selectedNode = ref(null)
const draggingNode = ref(null)
const dragState = ref({ isDragging: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0 })
const contextMenu = ref({ show: false, x: 0, y: 0, profileId: null })
const nodePositions = ref(new Map())
const refreshKey = ref(0)
const showStartModal = ref(false)

// Zoom i pan
const onPanelEnter = (el) => {
  el.style.visibility = 'visible'
  el.style.pointerEvents = 'auto'
}

const onPanelLeave = (el, done) => {
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  done()
}
const zoomState = ref({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastX: 0,
  lastY: 0
})

const transformStyle = computed(() => ({
  transform: `translate(${zoomState.value.offsetX}px, ${zoomState.value.offsetY}px) scale(${zoomState.value.scale})`
}))

const selectedProfile = computed(() => {
  if (!selectedNode.value) return null
  return familyTree.getProfile(selectedNode.value)
})

// === LAYOUT LOGIKA ===
const calculateTreeLayout = () => {
  const profiles = familyTree.getAllProfiles()
  if (profiles.length === 0) return new Map()

  const rootId = familyTree.rootProfileId || profiles[0]?.id
  const root = profiles.find(p => p.id === rootId)
  if (!root) return new Map()

  const layout = new Map()
  const nodeWidth = 300    // malo veće zbog horizontalne kartice
  const nodeHeight = 100
  const horizontalSpacing = 320
  const verticalSpacing = 220
  const centerX = 800
  const centerY = 600

  const hasSavedPosition = (id) => {
    const pos = familyTree.getProfilePosition(id)
    return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
  }

  // Root pozicija
  let rootX = centerX - nodeWidth / 2
  let rootY = centerY - nodeHeight / 2
  if (hasSavedPosition(rootId)) {
    const saved = familyTree.getProfilePosition(rootId)
    rootX = saved.x
    rootY = saved.y
  }
  layout.set(rootId, { id: rootId, profile: root, x: rootX, y: rootY })

  // Rekurzivno pozicioniranje dece
  const positionChildren = (parentId, parentCenterX, parentCenterY) => {
    const children = profiles.filter(p => p.parentId === parentId)
    children.forEach((child, i) => {
      const saved = hasSavedPosition(child.id) ? familyTree.getProfilePosition(child.id) : null
      let childX, childY
      if (saved) {
        childX = saved.x
        childY = saved.y
      } else {
        childX = parentCenterX + (i - (children.length - 1) / 2) * horizontalSpacing - nodeWidth / 2
        childY = parentCenterY + verticalSpacing
      }
      layout.set(child.id, { id: child.id, profile: child, x: childX, y: childY })
      positionChildren(child.id, childX + nodeWidth / 2, childY + nodeHeight / 2)
    })
  }

  positionChildren(rootId, rootX + nodeWidth / 2, rootY + nodeHeight)

  // Supružnici – pored partnera
  profiles.forEach(p => {
    if (p.spouseId && !layout.has(p.id)) {
      const spouse = profiles.find(s => s.id === p.spouseId)
      if (spouse && layout.has(spouse.id)) {
        const sp = layout.get(spouse.id)
        const saved = hasSavedPosition(p.id) ? familyTree.getProfilePosition(p.id) : null
        if (saved) {
          layout.set(p.id, { id: p.id, profile: p, x: saved.x, y: saved.y })
        } else {
          layout.set(p.id, { id: p.id, profile: p, x: sp.x + horizontalSpacing, y: sp.y })
        }
      }
    }
  })

  return layout
}

const visibleNodes = computed(() => {
  refreshKey.value // force re-calc

  const layout = calculateTreeLayout()
  if (layout.size === 0) return []

  const nodes = []
  for (const data of layout.values()) {
    const dragPos = nodePositions.value.get(data.id)
    nodes.push({
      id: data.id,
      name: data.profile.name || 'Nepoznato',
      profileImage: data.profile.profileImage,
      profile: data.profile,
      age: data.profile.age,
      x: dragPos ? dragPos.x : data.x,
      y: dragPos ? dragPos.y : data.y
    })
  }

  // Ažuriraj veličinu canvasa
  if (treeCanvasRef.value && nodes.length > 0) {
    const padding = 400
    const maxX = Math.max(...nodes.map(n => n.x + 300)) + padding
    const maxY = Math.max(...nodes.map(n => n.y + 100)) + padding
    const minX = Math.min(...nodes.map(n => n.x)) - padding
    const minY = Math.min(...nodes.map(n => n.y)) - padding

    treeCanvasRef.value.style.width = `${Math.max(1600, maxX - minX)}px`
    treeCanvasRef.value.style.height = `${Math.max(1200, maxY - minY)}px`
  }

  return nodes
})

const connectionLines = computed(() => {
  const lines = []
  const processedSpouses = new Set()

  visibleNodes.value.forEach(node => {
    const profile = node.profile

    // Roditelj → dete
    if (profile.parentId) {
      const parentNode = visibleNodes.value.find(n => n.id === profile.parentId)
      if (parentNode) {
        lines.push({
          x1: parentNode.x + 150,
          y1: parentNode.y + 50,
          x2: node.x + 150,
          y2: node.y
        })
      }
    }

    // Supružnici
    if (profile.spouseId && !processedSpouses.has(profile.id)) {
      const partnerNode = visibleNodes.value.find(n => n.id === profile.spouseId)
      if (partnerNode) {
        const key = [profile.id, profile.spouseId].sort().join('-')
        if (!processedSpouses.has(key)) {
          lines.push({
            x1: node.x + 150,
            y1: node.y + 50,
            x2: partnerNode.x + 150,
            y2: partnerNode.y + 50
          })
          processedSpouses.add(key)
        }
      }
    }
  })

  return lines
})

// === FUNKCIJE (ostaju iste kao pre) ===
const selectNode = (nodeId) => {
  selectedNode.value = nodeId
  closeContextMenu()
}

const deselectNode = () => {
  selectedNode.value = null
}

const editProfile = (id) => {
  router.push(`/home?profileId=${id}`)
}

const showContextMenu = (profileId, event) => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    profileId
  }
}

const showQuickAddMenu = (profileId) => {
  const node = visibleNodes.value.find(n => n.id === profileId)
  if (node) {
    contextMenu.value = {
      show: true,
      x: node.x + 320,
      y: node.y + 60,
      profileId
    }
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const addRelation = (relationType) => {
  const profileId = contextMenu.value.profileId
  closeContextMenu()
  router.push({ path: '/home', query: { relation: relationType, relatedTo: profileId } })
}

const deleteProfile = (profileId) => {
  const profile = familyTree.getProfile(profileId)
  if (confirm(`Obrisati "${profile.name}"?`)) {
    familyTree.deleteProfile(profileId)
    deselectNode()
    refreshKey.value++
  }
}

// Drag funkcija (samo ako nije root)
const startDrag = (nodeId, event) => {
  if (nodeId === familyTree.rootProfileId) return
  const node = visibleNodes.value.find(n => n.id === nodeId)
  if (!node) return

  draggingNode.value = nodeId
  dragState.value = {
    isDragging: true,
    startX: event.clientX,
    startY: event.clientY,
    nodeX: node.x,
    nodeY: node.y
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const handleDrag = (event) => {
  if (!dragState.value.isDragging) return
  const deltaX = event.clientX - dragState.value.startX
  const newX = dragState.value.nodeX + deltaX
  const newY = dragState.value.nodeY

  nodePositions.value.set(draggingNode.value, { x: newX, y: newY })
}

const stopDrag = () => {
  if (draggingNode.value && nodePositions.value.has(draggingNode.value)) {
    const pos = nodePositions.value.get(draggingNode.value)
    familyTree.updateProfilePosition(draggingNode.value, pos.x, pos.y)
    nodePositions.value.delete(draggingNode.value)
    refreshKey.value++
  }
  draggingNode.value = null
  dragState.value.isDragging = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Zoom točkićem
const handleWheel = (event) => {
  const rect = treeCanvasRef.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const delta = event.deltaY < 0 ? 1.15 : 0.85
  const newScale = Math.max(0.3, Math.min(zoomState.value.scale * delta, 4))

  const ratio = newScale / zoomState.value.scale
  zoomState.value.offsetX = mouseX - (mouseX - zoomState.value.offsetX) * ratio
  zoomState.value.offsetY = mouseY - (mouseY - zoomState.value.offsetY) * ratio
  zoomState.value.scale = newScale
}

// Pan
const startPan = (event) => {
  if (event.target.closest('.tree-node')) return
  zoomState.value.isDragging = true
  zoomState.value.lastX = event.clientX
  zoomState.value.lastY = event.clientY
}

const handlePan = (event) => {
  if (!zoomState.value.isDragging) return
  const dx = event.clientX - zoomState.value.lastX
  const dy = event.clientY - zoomState.value.lastY
  zoomState.value.offsetX += dx
  zoomState.value.offsetY += dy
  zoomState.value.lastX = event.clientX
  zoomState.value.lastY = event.clientY
}

const stopPan = () => {
  zoomState.value.isDragging = false
}

// Klik van panela ili čvora zatvara panel
const handleOutsideClick = (event) => {
  if (sidePanelRef.value && !sidePanelRef.value.contains(event.target) && !event.target.closest('.tree-node')) {
    deselectNode()
  }
  if (!event.target.closest('.context-menu')) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

// Refresh na promenu profila
watch(() => familyTree.getAllProfiles().length, () => {
  refreshKey.value++
})
onMounted(() => {
  // SAMO ZA TEST – simulacija više članova porodice
  if (familyTree.getAllProfiles().length === 1) {
    const root = familyTree.getAllProfiles()[0]
    
    // Dodaj supružnika
    familyTree.addProfile({
      name: 'Ana Marković',
      firstName: 'Ana',
      lastName: 'Marković',
      gender: 'female',
      age: 42,
      spouseId: root.id
    })

    // Dodaj dvoje dece
    familyTree.addProfile({
      name: 'Luka Marković',
      firstName: 'Luka',
      lastName: 'Marković',
      gender: 'male',
      age: 16,
      parentId: root.id
    })

    familyTree.addProfile({
      name: 'Sara Marković',
      firstName: 'Sara',
      lastName: 'Marković',
      gender: 'female',
      age: 12,
      parentId: root.id
    })

    // Dodaj roditelja (oca od Marka)
    const otac = familyTree.addProfile({
      name: 'Petar Marković',
      firstName: 'Petar',
      lastName: 'Marković',
      gender: 'male',
      age: 70
    })
    familyTree.updateProfile(root.id, { ...root, parentId: otac.id })

    refreshKey.value++
  }

  // Centriraj na root
  setTimeout(() => {
    if (visibleNodes.value.length > 0) {
      const rootNode = visibleNodes.value.find(n => n.id === familyTree.rootProfileId)
      if (rootNode && treeCanvasRef.value) {
        treeCanvasRef.value.scrollTo({
          left: rootNode.x - window.innerWidth / 2 + 150,
          top: rootNode.y - window.innerHeight / 2 + 50,
          behavior: 'smooth'
        })
      }
    }
  }, 200)
})
</script>

<style scoped>
.tree-2d-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.tree-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
}

/* Kartica čvora */
.node-card {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 20px;
  padding: 16px 20px;
  width: 320px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.node-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 35px rgba(0,0,0,0.15);
}

.node-avatar-wrapper {
  margin-right: 16px;
}

.node-avatar, .node-image {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  font-weight: bold;
  overflow: hidden;
}

.node-image {
  background: none;
}

.node-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.node-details {
  font-size: 0.95rem;
  color: #64748b;
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
</style>