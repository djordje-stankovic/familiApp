<template>
  <div class="tree-3d-container">
    <canvas ref="canvasRef" class="canvas-container"></canvas>

    <!-- Galaxy UI Overlay -->
    <div v-if="viewMode === 'galaxy'" class="galaxy-ui">
      <div class="galaxy-header">
        <button @click="handleBackToProfile" class="back-button-galaxy">
          <span class="back-icon">←</span>
          <span>NAZAD</span>
        </button>
      </div>
      <div class="galaxy-title">
        <h1>Family Tree</h1>
        <p>Family Network Visualization</p>
      </div>
      
      <!-- Map Mode Toggle -->
      <div class="map-mode-toggle">
        <button 
          @click="switchToGlobe" 
          :class="['mode-btn', { active: mapMode === 'globe' }]"
        >
          🌍 Globe
        </button>
        <button 
          @click="switchToFlat" 
          :class="['mode-btn', { active: mapMode === 'flat' }]"
        >
          🗺️ Fleet
        </button>
      </div>

      <div class="galaxy-instructions">
        <div class="instruction-item">
          <span class="icon">🖱️</span>
          <span>Click cluster to inspect</span>
        </div>
        <div class="instruction-item">
          <span class="icon">🔍</span>
          <span>Scroll to zoom</span>
        </div>
      </div>
    </div>

    <!-- Tree View Controls -->
    <div v-if="viewMode === 'tree'" class="tree-controls">
      <!-- Top Left: Header & Back -->
      <div class="tree-header">
        <div class="tree-nav-buttons">
          <button @click="handleBackToGalaxy" class="back-button">
            <span class="back-icon">←</span>
            <span>BACK TO GALAXY</span>
          </button>
          <button @click="handleBackToProfile" class="back-button">
            <span class="back-icon">🏠</span>
            <span>NAZAD NA PROFIL</span>
          </button>
        </div>

        <div class="tree-title">
          <h1 :style="{ textShadow: `0 0 20px ${selectedFamilyColor}80` }">
            {{ selectedFamilyName }}
          </h1>
          <div class="member-count">
            <span class="icon">👥</span>
            <span>{{ memberCount }} MEMBERS</span>
          </div>
        </div>
      </div>

      <!-- Top Right: Actions -->
      <div class="tree-actions">
        <button @click="handleAddMember" class="add-member-btn" :style="{
          backgroundColor: selectedFamilyColor,
          boxShadow: `0 0 20px ${selectedFamilyColor}40`
        }">
          <span class="icon">+</span>
          <span>Add Member</span>
        </button>
      </div>

      <!-- Bottom Right: Navigation Controls -->
      <div class="tree-nav-controls">
        <div class="controls-panel">
          <button @click="handleZoomIn" class="control-btn" title="Zoom In">
            <span>🔍+</span>
          </button>
          <button @click="handleZoomOut" class="control-btn" title="Zoom Out">
            <span>🔍-</span>
          </button>
          <div class="control-divider"></div>
          <button @click="handleResetCamera" class="control-btn" title="Reset View">
            <span>↻</span>
          </button>
        </div>
      </div>

      <!-- Bottom Left: Instructions -->
      <div class="tree-instructions">
        <p>• DRAG TO ROTATE</p>
        <p>• SCROLL TO ZOOM</p>
        <p>• RIGHT CLICK TO PAN</p>
        <p>• CLICK NODE FOR DETAILS</p>
      </div>
    </div>

    <!-- Overlay for closing panel -->
    <div 
      v-if="viewMode === 'tree' && selectedMember" 
      class="panel-overlay"
      @click="closeMemberPanel"
    ></div>

    <!-- Member Detail Panel - Tree Mode -->
    <div 
      v-if="viewMode === 'tree' && selectedMember" 
      class="member-detail-panel"
      :class="{ 'panel-open': selectedMember }"
      @click.stop
    >
      <div class="member-detail-header">
        <h2>{{ selectedMember.name }}</h2>
        <button @click="closeMemberPanel" class="close-btn">×</button>
      </div>

      <div class="member-detail-content">
        <!-- Profile Images -->
        <div v-if="hasImages" class="member-images">
          <div 
            v-for="(image, index) in selectedMember.images" 
            :key="index"
            class="image-container"
          >
            <img 
              v-if="image" 
              :src="image" 
              :alt="`${selectedMember.name} - Slika ${index + 1}`"
              class="member-image"
            />
            <div v-else class="image-placeholder">
              <span>Nema slike</span>
            </div>
          </div>
        </div>

        <!-- Profile Details -->
        <div class="member-info">
          <div class="info-section">
            <h3>Osnovni Podaci</h3>
            <div class="info-item">
              <span class="info-label">Ime:</span>
              <span class="info-value">{{ selectedMember.name }}</span>
            </div>
            <div v-if="selectedMember.age" class="info-item">
              <span class="info-label">Godine:</span>
              <span class="info-value">{{ selectedMember.age }}</span>
            </div>
            <div v-if="selectedMember.relation" class="info-item">
              <span class="info-label">Veza:</span>
              <span class="info-value">{{ getRelationLabel(selectedMember.relation) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value" :class="selectedMember.isUnlocked ? 'unlocked' : 'locked'">
                {{ selectedMember.isUnlocked ? 'Otključan' : 'Zaključan' }}
              </span>
            </div>
          </div>

          <div v-if="selectedMember.description" class="info-section">
            <h3>Opis</h3>
            <p class="description-text">{{ selectedMember.description }}</p>
          </div>

          <!-- Family Relations -->
          <div class="info-section">
            <h3>Porodične Veze</h3>
            <div v-if="parent" class="info-item">
              <span class="info-label">Roditelj:</span>
              <span class="info-value clickable" @click="selectMember(parent.id)">
                {{ parent.name }}
              </span>
            </div>
            <div v-if="children.length > 0" class="info-item">
              <span class="info-label">Deca:</span>
              <div class="children-list">
                <span 
                  v-for="child in children" 
                  :key="child.id"
                  class="info-value clickable"
                  @click="selectMember(child.id)"
                >
                  {{ child.name }}
                </span>
              </div>
            </div>
            <div v-if="siblings.length > 0" class="info-item">
              <span class="info-label">Braća/Sestre:</span>
              <div class="siblings-list">
                <span 
                  v-for="sibling in siblings" 
                  :key="sibling.id"
                  class="info-value clickable"
                  @click="selectMember(sibling.id)"
                >
                  {{ sibling.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="member-actions">
            <router-link 
              :to="`/profile/${selectedMember.id}`" 
              class="action-btn edit-btn"
            >
              <span class="icon">✏️</span>
              <span>Uredi Profil</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Panel - Galaxy Mode -->
    <div v-if="viewMode === 'galaxy' && selectedFamily" class="detail-panel">
      <div class="detail-header">
        <div>
          <h2>{{ selectedFamily.name }}</h2>
          <p class="detail-id">ID: {{ selectedFamily.id }}</p>
        </div>
        <button @click="closeDetailPanel" class="close-btn">×</button>
      </div>

      <div class="detail-content">
        <button @click="handleViewTree" class="view-tree-btn">
          <span class="icon">🌳</span>
          <span>View Family Tree</span>
        </button>

        <section class="detail-section">
          <h3>Overview</h3>
          <p>{{ selectedFamily.description || 'No description available' }}</p>
        </section>

        <section class="detail-section">
          <h3>Members ({{ selectedFamily.members.length }})</h3>
          <div class="members-list">
            <div v-for="member in selectedFamily.members.slice(0, 5)" :key="member.id" class="member-item">
              <div>
                <div class="member-name">{{ member.name }}</div>
                <div class="member-role">{{ member.role || 'Member' }}</div>
              </div>
            </div>
            <div v-if="selectedFamily.members.length > 5" class="more-members">
              + {{ selectedFamily.members.length - 5 }} more members visible in tree view
            </div>
          </div>
        </section>

        <section class="detail-stats">
          <div class="stat-item">
            <div class="stat-value">{{ selectedFamily.connections?.length || 0 }}</div>
            <div class="stat-label">Alliances</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ selectedFamily.members.length }}</div>
            <div class="stat-label">Population</div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { useFamilyTreeStore } from '../stores/familyTree'
import { Tree3DRenderer } from '../components/Tree3DRenderer.js'

const router = useRouter()

const { familyTree } = useFamilyTreeStore()
const canvasRef = ref(null)
const treeRenderer = ref(null)
const viewMode = ref('galaxy') // 'galaxy' or 'tree'
const mapMode = ref('globe') // 'globe' or 'flat'
const selectedFamilyId = ref(null)
const selectedMemberId = ref(null)

// Computed
const selectedFamily = computed(() => {
  if (!selectedFamilyId.value) return null
  
  const profiles = familyTree.getAllProfiles()
  const families = treeRenderer.value?.groupProfilesIntoFamilies?.(profiles) || new Map()
  const familyProfiles = families.get(selectedFamilyId.value)
  
  if (!familyProfiles) return null
  
  // Get family name from root profile
  const rootProfile = familyProfiles.find(p => p.id === familyTree.rootProfileId) || familyProfiles[0]
  const familyName = rootProfile?.name || 'Porodica'
  
  // Get connections (families with common members)
  const connections = []
  families.forEach((otherProfiles, otherId) => {
    if (otherId !== selectedFamilyId.value) {
      const common = familyProfiles.filter(p1 => otherProfiles.some(p2 => p2.id === p1.id))
      if (common.length > 0) {
        connections.push(otherId)
      }
    }
  })
  
  return {
    id: selectedFamilyId.value,
    name: familyName,
    description: `Family with ${familyProfiles.length} members`,
    members: familyProfiles.map(p => ({
      id: p.id,
      name: p.name,
      role: p.relation || 'Member'
    })),
    connections: connections
  }
})

const selectedFamilyName = computed(() => selectedFamily.value?.name || 'Family')
const selectedFamilyColor = computed(() => '#00d9ff') // Default color
const memberCount = computed(() => selectedFamily.value?.members.length || 0)

// Selected member profile
const selectedMember = computed(() => {
  if (!selectedMemberId.value) return null
  return familyTree.getProfile(selectedMemberId.value)
})

onMounted(async () => {
  await nextTick()
  
  if (!canvasRef.value) {
    console.error('Canvas ref nije dostupan')
    return
  }
  
  setTimeout(() => {
    try {
      // Use canvas directly from template
      const canvas = canvasRef.value
      
      // Set canvas size
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      
      console.log('Canvas element:', canvas)
      console.log('Canvas size:', canvas.width, 'x', canvas.height)
      
      // Try to create renderer - it will handle WebGL errors internally
      treeRenderer.value = new Tree3DRenderer(canvas, familyTree)
      
      if (!treeRenderer.value || !treeRenderer.value.renderer) {
        console.error('WebGL renderer nije uspešno kreiran')
        return
      }
      
      // Setup callbacks
      treeRenderer.value.onFamilySelect = (familyId) => {
        selectedFamilyId.value = familyId
      }
      
      treeRenderer.value.onMemberSelect = (member) => {
        if (member && member.id) {
          selectedMemberId.value = member.id
          console.log('Selected member:', member)
        }
      }
      
      treeRenderer.value.onViewModeChange = (mode) => {
        viewMode.value = mode
      }
      
      // Sync map mode
      treeRenderer.value.mapMode = mapMode.value
      
      console.log('Initial profiles count:', familyTree.getAllProfiles().length)
      
      // Render initial view
      if (familyTree.getAllProfiles().length > 0) {
        treeRenderer.value.renderTree()
      } else {
        console.warn('No profiles found, cannot render 3D view')
      }
      
      // Watch for profile changes and re-render
      watch(() => familyTree.getAllProfiles().length, (newLength, oldLength) => {
        console.log('Profile count changed:', oldLength, '->', newLength)
        if (treeRenderer.value && viewMode.value === 'galaxy' && newLength > 0) {
          console.log('Re-rendering galaxy view due to profile change')
          treeRenderer.value.renderTree()
        }
      })
      
      // Watch for map mode changes
      watch(() => mapMode.value, (newMode) => {
        if (treeRenderer.value) {
          treeRenderer.value.mapMode = newMode
          if (viewMode.value === 'galaxy') {
            treeRenderer.value.renderTree()
          }
        }
      })
    } catch (error) {
      console.error('Greška pri inicijalizaciji 3D renderera:', error)
    }
  }, 100)
})

onUnmounted(() => {
  if (treeRenderer.value) {
    treeRenderer.value.destroy()
  }
})

const handleViewTree = () => {
  if (selectedFamilyId.value && treeRenderer.value) {
    treeRenderer.value.switchToTreeView(selectedFamilyId.value)
  }
}

const handleBackToGalaxy = () => {
  if (treeRenderer.value) {
    treeRenderer.value.switchToGalaxyView()
    selectedFamilyId.value = null
  }
}

const handleBackToProfile = () => {
  // Navigate to home/profile page
  router.push('/home')
}

const switchToGlobe = () => {
  mapMode.value = 'globe'
}

const switchToFlat = () => {
  mapMode.value = 'flat'
}

const closeDetailPanel = () => {
  selectedFamilyId.value = null
}

const closeMemberPanel = () => {
  selectedMemberId.value = null
}

const selectMember = (memberId) => {
  selectedMemberId.value = memberId
}

const hasImages = computed(() => {
  if (!selectedMember.value || !selectedMember.value.images) return false
  return selectedMember.value.images.some(img => img !== null)
})

const parent = computed(() => {
  if (!selectedMember.value || !selectedMember.value.parentId) return null
  return familyTree.getProfile(selectedMember.value.parentId)
})

const children = computed(() => {
  if (!selectedMember.value) return []
  return familyTree.getChildren(selectedMember.value.id)
})

const siblings = computed(() => {
  if (!selectedMember.value || !selectedMember.value.parentId) return []
  const allSiblings = familyTree.getAllProfiles().filter(p => 
    p.parentId === selectedMember.value.parentId && p.id !== selectedMember.value.id
  )
  return allSiblings
})

const getRelationLabel = (relation) => {
  const labels = {
    'parent': 'Roditelj',
    'child': 'Dete',
    'sibling': 'Brat/Sestra',
    'spouse': 'Supružnik'
  }
  return labels[relation] || relation
}

const handleAddMember = () => {
  // TODO: Implement add member modal
  console.log('Add member clicked')
}

const handleZoomIn = () => {
  if (treeRenderer.value && treeRenderer.value.camera) {
    const direction = new THREE.Vector3()
    treeRenderer.value.camera.getWorldDirection(direction)
    treeRenderer.value.camera.position.add(direction.multiplyScalar(20))
  }
}

const handleZoomOut = () => {
  if (treeRenderer.value && treeRenderer.value.camera) {
    const direction = new THREE.Vector3()
    treeRenderer.value.camera.getWorldDirection(direction)
    treeRenderer.value.camera.position.add(direction.multiplyScalar(-20))
  }
}

const handleResetCamera = () => {
  if (treeRenderer.value && treeRenderer.value.camera) {
    treeRenderer.value.camera.position.set(0, 50, 200)
    treeRenderer.value.camera.lookAt(0, 0, -50)
    if (treeRenderer.value.controls) {
      treeRenderer.value.controls.target.set(0, 0, -50)
      treeRenderer.value.controls.update()
    }
  }
}
</script>

<style scoped>
.tree-3d-container {
  width: 100%;
  height: 100vh;
  background: #000000;
  position: relative;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* Galaxy UI */
.galaxy-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.galaxy-header {
  position: absolute;
  top: 24px;
  left: 24px;
  pointer-events: auto;
  z-index: 11;
}

.back-button-galaxy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button-galaxy:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
}

.back-button-galaxy .back-icon {
  font-size: 16px;
}

.galaxy-title {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  text-align: center;
}

.galaxy-title h1 {
  font-size: 2.5rem;
  font-weight: bold;
  color: white;
  margin: 0 0 8px 0;
  text-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
  letter-spacing: -0.02em;
}

.galaxy-title p {
  color: #00d9ff;
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
  margin: 0;
}

.map-mode-toggle {
  position: absolute;
  top: 24px;
  right: 24px;
  display: flex;
  gap: 8px;
  pointer-events: auto;
  z-index: 11;
}

.mode-btn {
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
}

.mode-btn.active {
  background: rgba(0, 217, 255, 0.8);
  border-color: rgba(0, 217, 255, 0.6);
  color: white;
}

.galaxy-instructions {
  position: absolute;
  bottom: 24px;
  left: 24px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.instruction-item .icon {
  width: 12px;
  height: 12px;
}

/* Tree Controls */
.tree-controls {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 20;
}

.tree-header {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  pointer-events: auto;
}

.tree-nav-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.back-button:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.back-icon {
  font-size: 16px;
}

.tree-title h1 {
  font-size: 1.875rem;
  font-weight: bold;
  color: white;
  margin: 0 0 4px 0;
}

.member-count {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #67e3f9;
  font-size: 0.875rem;
  font-family: monospace;
}

.tree-actions {
  position: absolute;
  top: 24px;
  right: 24px;
  pointer-events: auto;
}

.add-member-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.add-member-btn:hover {
  transform: scale(1.05);
}

.add-member-btn:active {
  transform: scale(0.95);
}

.tree-nav-controls {
  position: absolute;
  bottom: 24px;
  right: 24px;
  pointer-events: auto;
}

.controls-panel {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 20px;
}

.control-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.control-divider {
  height: 1px;
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}

.tree-instructions {
  position: absolute;
  bottom: 24px;
  left: 24px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.75rem;
  font-family: monospace;
  pointer-events: none;
}

.tree-instructions p {
  margin: 4px 0;
}

/* Panel Overlay */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
  pointer-events: auto;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Member Detail Panel */
.member-detail-panel {
  position: fixed;
  top: 0;
  right: -450px;
  width: 450px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  pointer-events: auto;
}

.member-detail-panel.panel-open {
  right: 0;
}

.member-detail-header {
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(20px);
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.member-detail-header h2 {
  font-size: 1.5rem;
  font-weight: bold;
  background: linear-gradient(to right, #67e3f9, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.member-detail-content {
  padding: 24px;
}

/* Member Images */
.member-images {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.image-container {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.member-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.875rem;
}

/* Member Info */
.member-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section:last-child {
  border-bottom: none;
}

.info-section h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.info-label {
  color: #9ca3af;
  font-size: 0.875rem;
  min-width: 100px;
  flex-shrink: 0;
}

.info-value {
  color: #e5e7eb;
  font-size: 0.875rem;
  flex: 1;
}

.info-value.unlocked {
  color: #10b981;
}

.info-value.locked {
  color: #ef4444;
}

.info-value.clickable {
  color: #67e3f9;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.info-value.clickable:hover {
  color: #a855f7;
}

.children-list,
.siblings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.description-text {
  color: #d1d5db;
  line-height: 1.6;
  margin: 0;
  font-size: 0.875rem;
}

/* Member Actions */
.member-actions {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  border: none;
  font-size: 0.875rem;
}

.edit-btn {
  background: linear-gradient(to right, #0891b2, #2563eb);
  color: white;
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.2);
}

.edit-btn:hover {
  background: linear-gradient(to right, #06b6d4, #3b82f6);
  transform: scale(1.02);
}

/* Detail Panel */
.detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  max-width: 384px;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  color: white;
  overflow-y: auto;
  z-index: 40;
  pointer-events: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.detail-header h2 {
  font-size: 1.875rem;
  font-weight: bold;
  background: linear-gradient(to right, #67e3f9, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 4px 0;
}

.detail-id {
  color: #9ca3af;
  font-size: 0.875rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.view-tree-btn {
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(to right, #0891b2, #2563eb);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.2);
}

.view-tree-btn:hover {
  background: linear-gradient(to right, #06b6d4, #3b82f6);
  transform: scale(1.02);
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  font-weight: 600;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-section p {
  color: #d1d5db;
  line-height: 1.6;
  margin: 0;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;
}

.member-item:hover {
  border-color: rgba(6, 182, 212, 0.3);
}

.member-name {
  font-weight: 500;
  color: #bae6fd;
  margin-bottom: 4px;
}

.member-role {
  font-size: 0.75rem;
  color: rgba(196, 181, 253, 0.8);
}

.more-members {
  text-align: center;
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  margin-top: 8px;
}

.detail-stats {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-item {
  background: linear-gradient(to bottom right, rgba(147, 51, 234, 0.2), rgba(59, 130, 246, 0.2));
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
