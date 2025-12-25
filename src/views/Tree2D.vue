<template>
  <div class="tree-2d-container">
    <header class="app-header">
      <h1>2D Prikaz Stabla</h1>
      <div class="header-actions">
        <button @click="expandAll" class="btn-primary">Proširi Sve</button>
        <button @click="collapseAll" class="btn-secondary">Skupi Sve</button>
        <router-link to="/tree-3d" class="btn-primary">3D Prikaz</router-link>
        <router-link to="/home" class="btn-secondary">← Nazad</router-link>
      </div>
    </header>

    <div class="tree-content">
      <div class="tree-canvas" ref="treeCanvasRef" @contextmenu.prevent>
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
          :class="['tree-node', { 
            'root-node': node.id === familyTree.rootProfileId, 
            'selected': selectedNode === node.id,
            'dragging': draggingNode === node.id
          }]"
          :style="{
            left: node.x + 'px',
            top: node.y + 'px'
          }"
          @mousedown="startDrag(node.id, $event)"
          @click.stop="selectNode(node.id)"
          @dblclick.stop="editProfile(node.id)"
          @contextmenu.prevent="showContextMenu(node.id, $event)"
        >
          <div class="node-bubble">
            <div class="node-name">{{ node.name }}</div>
            <div class="node-age" v-if="node.age">{{ node.age }} god.</div>
            <div class="node-status" :class="node.isUnlocked ? 'unlocked' : 'locked'">
              {{ node.isUnlocked ? 'Otključan' : 'Zaključan' }}
            </div>
            <div v-if="selectedNode === node.id" class="node-actions">
              <button 
                class="add-relation-btn"
                @click.stop="showAddMenu(node.id)"
              >
                + Dodaj
              </button>
              <button 
                v-if="node.id !== familyTree.rootProfileId || familyTree.getAllProfiles().length > 1"
                class="delete-btn"
                @click.stop="deleteProfile(node.id)"
                title="Obriši profil"
              >
                🗑️ Obriši
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Kontekstni meni za dodavanje profila -->
      <div 
        v-if="contextMenu.show"
        class="context-menu"
        :style="{
          left: contextMenu.x + 'px',
          top: contextMenu.y + 'px'
        }"
        @click.stop
      >
        <div class="context-menu-item" @click="addRelation('child')">
          Dodaj Dete
        </div>
        <div class="context-menu-item" @click="addRelation('parent')">
          Dodaj Roditelja
        </div>
        <div class="context-menu-item" @click="addRelation('sibling')">
          Dodaj Brat/Sestru
        </div>
        <div class="context-menu-item" @click="addRelation('spouse')">
          Dodaj Supružnika
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="closeContextMenu">
          Otkaži
        </div>
      </div>

      <div v-if="visibleNodes.length === 0" class="empty-state">
        <p>Nema profila. <router-link to="/profile">Dodaj prvi profil</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFamilyTreeStore } from '../stores/familyTree'

const router = useRouter()
const route = useRoute()
const { familyTree } = useFamilyTreeStore()
const treeCanvasRef = ref(null)
const selectedNode = ref(null)
const draggingNode = ref(null)
const expandedProfiles = ref(new Set())
const dragState = ref({ isDragging: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0 })
const contextMenu = ref({ show: false, x: 0, y: 0, profileId: null })
const nodePositions = ref(new Map()) // Ref za čuvanje pozicija tokom drag-a
const refreshKey = ref(0) // Key za force refresh

// Layout algoritam - koristi sačuvane pozicije ako postoje, inače automatski layout
const calculateTreeLayout = () => {
  const profiles = familyTree.getAllProfiles()
  if (profiles.length === 0) return new Map()

  const rootId = familyTree.rootProfileId || profiles[0].id
  const root = profiles.find(p => p.id === rootId)
  if (!root) return new Map()

  const layout = new Map()
  const nodeWidth = 180
  const nodeHeight = 120
  const horizontalSpacing = 250
  const verticalSpacing = 200
  const centerX = 500
  const centerY = 400

  // Helper funkcija za proveru da li profil ima sačuvanu poziciju
  const hasSavedPosition = (profileId) => {
    const pos = familyTree.getProfilePosition(profileId)
    return pos !== null && pos !== undefined
  }

  // Root u centru (ili sačuvana pozicija)
  const rootPos = familyTree.getProfilePosition(rootId)
  if (hasSavedPosition(rootId)) {
    layout.set(rootId, {
      id: rootId,
      profile: root,
      x: rootPos.x,
      y: rootPos.y,
      level: 0
    })
  } else {
    layout.set(rootId, {
      id: rootId,
      profile: root,
      x: centerX - nodeWidth / 2,
      y: centerY - nodeHeight / 2,
      level: 0
    })
  }

  // Grupiši profile po tipu veze
  const children = profiles.filter(p => p.parentId === rootId)
  const siblings = root.parentId ? profiles.filter(p => 
    p.parentId === root.parentId && p.id !== rootId
  ) : []
  const parents = root.parentId ? [profiles.find(p => p.id === root.parentId)].filter(Boolean) : []

  // 1. Pozicioniraj DECA (ispod root profila, pozitivna Y)
  children.forEach((child, index) => {
    if (hasSavedPosition(child.id)) {
      const savedPos = familyTree.getProfilePosition(child.id)
      layout.set(child.id, {
        id: child.id,
        profile: child,
        x: savedPos.x,
        y: savedPos.y,
        level: 1
      })
    } else {
      const childX = centerX + (index - (children.length - 1) / 2) * horizontalSpacing
      const childY = centerY + verticalSpacing // Ispod root profila
      layout.set(child.id, {
        id: child.id,
        profile: child,
        x: childX - nodeWidth / 2,
        y: childY - nodeHeight / 2,
        level: 1
      })
    }
  })

  // 2. Pozicioniraj BRAĆA/SESTRE (isti Y kao root, samo različiti X)
  siblings.forEach((sibling, index) => {
    if (hasSavedPosition(sibling.id)) {
      const savedPos = familyTree.getProfilePosition(sibling.id)
      layout.set(sibling.id, {
        id: sibling.id,
        profile: sibling,
        x: savedPos.x,
        y: savedPos.y,
        level: 0
      })
    } else {
      // Pozicioniraj sve braću/sestre (uključujući root) u istom redu
      const allSiblings = [root, ...siblings]
      const siblingIndex = allSiblings.findIndex(s => s.id === sibling.id)
      const totalSiblings = allSiblings.length
      const siblingX = centerX + (siblingIndex - (totalSiblings - 1) / 2) * horizontalSpacing
      layout.set(sibling.id, {
        id: sibling.id,
        profile: sibling,
        x: siblingX - nodeWidth / 2,
        y: centerY - nodeHeight / 2, // Isti Y kao root
        level: 0
      })
    }
  })

  // 3. Pozicioniraj RODITELJE (iznad root profila, negativna Y)
  parents.forEach((parent, index) => {
    if (hasSavedPosition(parent.id)) {
      const savedPos = familyTree.getProfilePosition(parent.id)
      layout.set(parent.id, {
        id: parent.id,
        profile: parent,
        x: savedPos.x,
        y: savedPos.y,
        level: -1
      })
    } else {
      layout.set(parent.id, {
        id: parent.id,
        profile: parent,
        x: centerX - nodeWidth / 2,
        y: centerY - verticalSpacing - nodeHeight / 2, // Iznad root profila
        level: -1
      })
    }
  })

  // 4. Rekurzivno pozicioniraj decu svih profila
  const positionChildrenRecursive = (parentId, parentPos) => {
    const children = profiles.filter(p => p.parentId === parentId && !layout.has(p.id))
    children.forEach((child, index) => {
      if (hasSavedPosition(child.id)) {
        const savedPos = familyTree.getProfilePosition(child.id)
        layout.set(child.id, {
          id: child.id,
          profile: child,
          x: savedPos.x,
          y: savedPos.y,
          level: (layout.get(parentId)?.level || 0) + 1
        })
      } else {
        const childX = parentPos.x + nodeWidth / 2 + (index - (children.length - 1) / 2) * horizontalSpacing
        const childY = parentPos.y + nodeHeight / 2 + verticalSpacing // Ispod roditelja
        layout.set(child.id, {
          id: child.id,
          profile: child,
          x: childX - nodeWidth / 2,
          y: childY - nodeHeight / 2,
          level: (layout.get(parentId)?.level || 0) + 1
        })
        positionChildrenRecursive(child.id, { x: childX, y: childY })
      }
    })
  }

  // Pozicioniraj decu svih već pozicioniranih profila
  Array.from(layout.keys()).forEach(profileId => {
    const nodeData = layout.get(profileId)
    if (nodeData) {
      positionChildrenRecursive(profileId, { 
        x: nodeData.x + nodeWidth / 2, 
        y: nodeData.y + nodeHeight / 2 
      })
    }
  })

  // 5. Pozicioniraj braću/sestre za sve profile (ne samo root)
  profiles.forEach(profile => {
    if (!layout.has(profile.id) && profile.parentId) {
      const parent = profiles.find(p => p.id === profile.parentId)
      if (parent) {
        const allSiblings = profiles.filter(p => p.parentId === profile.parentId)
        const siblingIndex = allSiblings.findIndex(s => s.id === profile.id)
        
        // Pronađi Y poziciju prvog sibling-a koji je već pozicioniran
        let siblingY = null
        for (const sibling of allSiblings) {
          if (layout.has(sibling.id)) {
            siblingY = layout.get(sibling.id).y
            break
          }
        }
        
        // Ako nema pozicioniranog sibling-a, koristi Y roditelja
        if (siblingY === null) {
          const parentPos = layout.get(profile.parentId)
          if (parentPos) {
            siblingY = parentPos.y
          }
        }
        
        if (siblingY !== null && siblingIndex >= 0) {
          if (hasSavedPosition(profile.id)) {
            const savedPos = familyTree.getProfilePosition(profile.id)
            layout.set(profile.id, {
              id: profile.id,
              profile: profile,
              x: savedPos.x,
              y: savedPos.y,
              level: layout.get(profile.parentId)?.level || 0
            })
          } else {
            // Pozicioniraj sve braću/sestre u istom redu
            const totalSiblings = allSiblings.length
            // Pronađi X poziciju prvog sibling-a ili roditelja
            let baseX = centerX
            for (const sibling of allSiblings) {
              if (layout.has(sibling.id)) {
                baseX = layout.get(sibling.id).x + nodeWidth / 2
                break
              }
            }
            if (baseX === centerX) {
              const parentPos = layout.get(profile.parentId)
              if (parentPos) {
                baseX = parentPos.x + nodeWidth / 2
              }
            }
            
            const siblingX = baseX + (siblingIndex - (totalSiblings - 1) / 2) * horizontalSpacing
            layout.set(profile.id, {
              id: profile.id,
              profile: profile,
              x: siblingX - nodeWidth / 2,
              y: siblingY, // Isti Y kao ostala braća/sestre
              level: layout.get(profile.parentId)?.level || 0
            })
          }
        }
      }
    }
  })

  return layout
}

const calculateAutoPosition = (profile, centerX, centerY) => {
  const nodeWidth = 180
  const nodeHeight = 120
  const horizontalSpacing = 250
  const verticalSpacing = 200

  if (profile.id === familyTree.rootProfileId) {
    return { x: centerX - nodeWidth / 2, y: centerY - nodeHeight / 2, level: 0 }
  }

  if (profile.parentId) {
    const parent = familyTree.getProfile(profile.parentId)
    if (parent) {
      const parentPos = familyTree.getProfilePosition(profile.parentId)
      if (parentPos) {
        // Pozicija ispod roditelja (dete)
        const siblings = familyTree.getAllProfiles().filter(p => 
          p.parentId === profile.parentId && p.id !== profile.id
        )
        const siblingIndex = siblings.length
        const x = parentPos.x + (siblingIndex - siblings.length / 2) * horizontalSpacing
        const y = parentPos.y + verticalSpacing
        return { x: x - nodeWidth / 2, y: y - nodeHeight / 2, level: 1 }
      }
    }
  }

  // Default pozicija
  return { x: centerX, y: centerY, level: 0 }
}

const visibleNodes = computed(() => {
  // Force refresh kada se promeni refreshKey
  refreshKey.value
  
  const layout = calculateTreeLayout()
  if (!layout || layout.size === 0) return []
  
  const nodes = Array.from(layout.values()).map(nodeData => {
    // Ako postoji pozicija u nodePositions (tokom drag-a), koristi je
    const dragPosition = nodePositions.value.get(nodeData.id)
    return {
      id: nodeData.id,
      name: nodeData.profile.name,
      age: nodeData.profile.age,
      isUnlocked: nodeData.profile.isUnlocked,
      x: dragPosition ? dragPosition.x : nodeData.x,
      y: dragPosition ? dragPosition.y : nodeData.y,
      level: nodeData.level
    }
  })
  
  // Ažuriraj veličinu canvas-a da uključi sve profile
  if (treeCanvasRef.value && nodes.length > 0) {
    const maxX = Math.max(...nodes.map(n => n.x + 180))
    const maxY = Math.max(...nodes.map(n => n.y + 120))
    const minX = Math.min(...nodes.map(n => n.x))
    const minY = Math.min(...nodes.map(n => n.y))
    
    const canvasWidth = Math.max(1000, maxX + 100, Math.abs(minX) + 100)
    const canvasHeight = Math.max(800, maxY + 100, Math.abs(minY) + 100)
    
    treeCanvasRef.value.style.minWidth = canvasWidth + 'px'
    treeCanvasRef.value.style.minHeight = canvasHeight + 'px'
  }
  
  return nodes
})

const connectionLines = computed(() => {
  const lines = []
  const profiles = familyTree.getAllProfiles()
  
  profiles.forEach(profile => {
    if (profile.parentId) {
      const childNode = visibleNodes.value.find(n => n.id === profile.id)
      const parentNode = visibleNodes.value.find(n => n.id === profile.parentId)
      
      if (childNode && parentNode) {
        lines.push({
          x1: parentNode.x + 90,
          y1: parentNode.y + 60,
          x2: childNode.x + 90,
          y2: childNode.y + 60
        })
      }
    }
  })

  return lines
})

const selectNode = (nodeId) => {
  selectedNode.value = selectedNode.value === nodeId ? null : nodeId
  closeContextMenu()
}

const editProfile = (id) => {
  router.push(`/profile/${id}`)
}

const startDrag = (nodeId, event) => {
  if (nodeId === familyTree.rootProfileId) return // Root se ne može pomerati
  
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
  event.preventDefault()
}

const handleDrag = (event) => {
  if (!dragState.value.isDragging) return

  const deltaX = event.clientX - dragState.value.startX
  // const deltaY = event.clientY - dragState.value.startY // Y ostaje isti

  // Dozvoli samo horizontalno pomeranje (levo-desno)
  const newX = dragState.value.nodeX + deltaX
  const newY = dragState.value.nodeY // Y ostaje isti

  // Ažuriraj poziciju u nodePositions ref-u
  if (draggingNode.value) {
    nodePositions.value.set(draggingNode.value, { x: newX, y: newY })
    // Strelice će se automatski ažurirati jer connectionLines koristi visibleNodes
  }
}

const stopDrag = () => {
  if (dragState.value.isDragging && draggingNode.value) {
    const dragPosition = nodePositions.value.get(draggingNode.value)
    if (dragPosition) {
      // Sačuvaj novu poziciju
      familyTree.updateProfilePosition(draggingNode.value, dragPosition.x, dragPosition.y)
      // Obriši privremenu poziciju iz nodePositions
      nodePositions.value.delete(draggingNode.value)
      // Force refresh layout-a
      refreshKey.value++
    }
  }

  dragState.value.isDragging = false
  draggingNode.value = null
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const showContextMenu = (profileId, event) => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    profileId: profileId
  }
  selectedNode.value = profileId
}

const closeContextMenu = () => {
  contextMenu.value = { show: false, x: 0, y: 0, profileId: null }
}

const showAddMenu = (profileId) => {
  const node = visibleNodes.value.find(n => n.id === profileId)
  if (node) {
    contextMenu.value = {
      show: true,
      x: node.x + 180,
      y: node.y + 60,
      profileId: profileId
    }
  }
}

const addRelation = async (relationType) => {
  const profileId = contextMenu.value.profileId
  if (!profileId) return

  closeContextMenu()

  // Navigiraj na stranicu za dodavanje profila sa parametrima
  const relationMap = {
    child: 'child',
    parent: 'parent',
    sibling: 'sibling',
    spouse: 'spouse'
  }

  router.push({
    path: '/profile',
    query: {
      relation: relationMap[relationType],
      relatedTo: profileId
    }
  })
}

const deleteProfile = (profileId) => {
  if (!profileId) return

  const profile = familyTree.getProfile(profileId)
  if (!profile) return

  // Potvrda brisanja
  const confirmMessage = `Da li ste sigurni da želite da obrišete profil "${profile.name}"?\n\nNapomena: Ako profil ima decu, njihova veza sa roditeljem će biti uklonjena.`
  
  if (confirm(confirmMessage)) {
    const success = familyTree.deleteProfile(profileId)
    if (success) {
      selectedNode.value = null
      refreshKey.value++
      // Scroll do root profila
      setTimeout(() => {
        if (treeCanvasRef.value && familyTree.rootProfileId) {
          const rootNode = visibleNodes.value.find(n => n.id === familyTree.rootProfileId)
          if (rootNode) {
            treeCanvasRef.value.scrollTo({
              left: rootNode.x - window.innerWidth / 2,
              top: rootNode.y - window.innerHeight / 2,
              behavior: 'smooth'
            })
          }
        }
      }, 100)
    } else {
      alert('Greška pri brisanju profila. Ne možete obrisati poslednji profil.')
    }
  }
}

const expandAll = () => {
  familyTree.getAllProfiles().forEach(profile => {
    if (familyTree.getChildren(profile.id).length > 0 || profile.parentId) {
      expandedProfiles.value.add(profile.id)
    }
  })
}

const collapseAll = () => {
  expandedProfiles.value.clear()
  if (familyTree.rootProfileId) {
    expandedProfiles.value.add(familyTree.rootProfileId)
  }
}

// Watch za promene u profilima
watch(() => familyTree.getAllProfiles().length, () => {
  refreshKey.value++
}, { immediate: false })

// Watch za promene u route-u (kada se vrati sa ProfileEdit)
watch(() => route.path, (newPath) => {
  if (newPath === '/tree-2d') {
    // Force refresh kada se vrati na tree-2d
    refreshKey.value++
    
    // Scroll do root profila
    setTimeout(() => {
      if (treeCanvasRef.value && familyTree.rootProfileId) {
        const rootNode = visibleNodes.value.find(n => n.id === familyTree.rootProfileId)
        if (rootNode) {
          treeCanvasRef.value.scrollTo({
            left: rootNode.x - window.innerWidth / 2,
            top: rootNode.y - window.innerHeight / 2,
            behavior: 'smooth'
          })
        }
      }
    }, 100)
  }
})

onMounted(() => {
  if (familyTree.rootProfileId) {
    expandedProfiles.value.add(familyTree.rootProfileId)
  }
  
  // Zatvori kontekstni meni kada klikneš van njega
  document.addEventListener('click', closeContextMenu)
  
  // Scroll do root profila nakon što se stablo učita
  setTimeout(() => {
    if (treeCanvasRef.value && familyTree.rootProfileId) {
      const rootNode = visibleNodes.value.find(n => n.id === familyTree.rootProfileId)
      if (rootNode) {
        treeCanvasRef.value.scrollTo({
          left: rootNode.x - window.innerWidth / 2,
          top: rootNode.y - window.innerHeight / 2,
          behavior: 'smooth'
        })
      }
    }
  }, 100)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.tree-2d-container {
  min-height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.app-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.app-header h1 {
  color: #667eea;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-primary, .btn-secondary {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.3s;
  font-size: 0.9rem;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.tree-content {
  width: 100%;
  height: calc(100vh - 80px);
  position: relative;
  overflow: auto;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  min-width: 1000px;
  min-height: 800px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.tree-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  stroke: #667eea;
  stroke-width: 2;
  opacity: 0.6;
  marker-end: url(#arrowhead);
}

.tree-node {
  position: absolute;
  z-index: 10;
  cursor: move;
  transition: transform 0.1s ease;
}

.tree-node.root-node {
  cursor: default;
}

.tree-node.dragging {
  z-index: 100;
  opacity: 0.8;
}

.tree-node:hover {
  transform: scale(1.05);
  z-index: 20;
}

.tree-node.selected {
  z-index: 15;
}

.tree-node.selected .node-bubble {
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.3);
}

.node-bubble {
  width: 180px;
  min-height: 120px;
  background: white;
  border-radius: 20px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 3px solid #667eea;
  transition: all 0.3s ease;
  position: relative;
}

.root-node .node-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #5568d3;
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  cursor: default;
}

.node-name {
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.root-node .node-name {
  color: white;
}

.node-age {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.root-node .node-age {
  color: rgba(255, 255, 255, 0.9);
}

.node-status {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 600;
  margin-top: 0.5rem;
}

.node-status.unlocked {
  background: #d4edda;
  color: #155724;
}

.node-status.locked {
  background: #f8d7da;
  color: #721c24;
}

.root-node .node-status.unlocked {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

.root-node .node-status.locked {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.node-actions {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.add-relation-btn {
  padding: 0.4rem 0.8rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.3s;
}

.add-relation-btn:hover {
  background: #5568d3;
}

.delete-btn {
  padding: 0.4rem 0.8rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.delete-btn:hover {
  background: #dc2626;
}

.context-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 180px;
  padding: 0.5rem 0;
}

.context-menu-item {
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.9rem;
}

.context-menu-item:hover {
  background: #f0f0f0;
}

.context-menu-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 0.5rem 0;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.empty-state a {
  color: #667eea;
  text-decoration: none;
}
</style>
