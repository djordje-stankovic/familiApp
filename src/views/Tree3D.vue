<template>
  <div class="map-page-container" @mousemove="handleMouseMove" @mouseleave="isMouseOverTree = false">
    <!-- Header -->
    <div class="map-page-header">
      <button @click="handleBackToProfile" class="back-button-map">
        <span class="back-icon">←</span>
        <span>NAZAD</span>
      </button>
      <div class="map-page-title">
        <h1>Porodično stablo sveta</h1>
        <p>Članovi porodice širom planete</p>
      </div>
    </div>

    <!-- MapLibre mapa -->
    <div ref="mapContainer" class="maptiler-map"></div>

    <!-- 2D TREE OVERLAY – brutalno vidljiv, a proziran -->
    <div 
      ref="treeOverlayRef"
      class="tree-overlay" 
      :class="{ 'hidden': selectedProfile, 'tree-active': isMouseOverTree }"
    >
      <Tree2D 
        :mapInstance="mapInstance" 
        :isInteractive="isMouseOverTree"
        @focusOnLocation="handleProfileClick" 
      />
      
      <!-- Debug box-ovi za svaku karticu - PRIVREMENO ONEMOGUĆENO -->
      <!-- <template v-if="cardBoxes && cardBoxes.length > 0">
        <div 
          v-for="(node, index) in cardBoxes" 
          :key="`box-${index}`"
          class="card-interaction-box"
          :style="{
            left: node.left + 'px',
            top: node.top + 'px',
            width: node.width + 'px',
            height: node.height + 'px'
          }"
        ></div>
      </template> -->
    </div>

    <!-- Bottom Modal za detalje profila -->
    <transition name="slide-up">
      <div v-if="selectedProfile" class="profile-modal">
        <button @click="closeProfileModal" class="modal-close-btn">✕</button>
        
        <div class="modal-content">
          <!-- Leva sekcija - Galerija slika (1/3) -->
          <div class="modal-gallery">
            <div class="gallery-main">
              <img :src="currentImage" :alt="selectedProfile.firstName" />
            </div>
            <div class="gallery-thumbnails">
              <div
                v-for="(img, index) in selectedProfile.images"
                :key="index"
                class="thumbnail"
                :class="{ active: currentImageIndex === index }"
                @click="currentImageIndex = index"
              >
                <img :src="img" :alt="`${selectedProfile.firstName} ${index + 1}`" />
              </div>
            </div>
          </div>

          <!-- Desne sekcije - Detalji (2/3) -->
          <div class="modal-details">
            <div class="profile-header">
              <div class="profile-avatar-large">
                <span>{{ selectedProfile.firstName.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h2>{{ selectedProfile.firstName }} {{ selectedProfile.lastName }}</h2>
                <p class="profile-subtitle">
                  {{ selectedProfile.age ? selectedProfile.age + ' godina' : 'Godine nepoznate' }}
                </p>
              </div>
            </div>

            <div class="profile-info-section">
              <div class="info-item">
                <strong>📍 Lokacija:</strong>
                <span>{{ [selectedProfile.city, selectedProfile.country].filter(Boolean).join(', ') || 'Nepoznato' }}</span>
              </div>
              
              <div class="info-item" v-if="selectedProfile.bio">
                <strong>📝 Biografija:</strong>
                <p class="bio-text">{{ selectedProfile.bio }}</p>
              </div>

              <div class="info-item" v-if="selectedProfile.occupation">
                <strong>💼 Zanimanje:</strong>
                <span>{{ selectedProfile.occupation }}</span>
              </div>

              <div class="info-item" v-if="selectedProfile.birthDate">
                <strong>🎂 Datum rođenja:</strong>
                <span>{{ selectedProfile.birthDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import Tree2D from './Tree2D.vue'  // <-- putanja do tvoje 2D komponente

const router = useRouter()
const mapContainer = ref(null)
const mapInstance = ref(null)
const selectedProfile = ref(null)
const currentImageIndex = ref(0)
const isMouseOverTree = ref(false)
const treeOverlayRef = ref(null)
const cardBoxes = ref([])

// Funkcija za ažuriranje pozicija box-ova
const updateCardBoxes = () => {
  if (!treeOverlayRef.value) {
    cardBoxes.value = []
    return
  }
  
  try {
    const boxes = []
    const treeNodes = treeOverlayRef.value.querySelectorAll('.tree-node')
    const padding = 30
    
    if (treeNodes.length === 0) {
      cardBoxes.value = []
      return
    }
    
    const overlayRect = treeOverlayRef.value.getBoundingClientRect()
    
    treeNodes.forEach((node) => {
      try {
        const rect = node.getBoundingClientRect()
        
        // Proveri da li su dimenzije validne
        if (rect.width > 0 && rect.height > 0) {
          boxes.push({
            left: rect.left - overlayRect.left - padding,
            top: rect.top - overlayRect.top - padding,
            width: rect.width + (padding * 2),
            height: rect.height + (padding * 2)
          })
        }
      } catch (e) {
        console.warn('Greška pri računanju box-a za kartu:', e)
      }
    })
    
    cardBoxes.value = boxes
  } catch (e) {
    console.warn('Greška pri ažuriranju box-ova:', e)
    cardBoxes.value = []
  }
}

// Ažuriraj box-ove kada se promeni pozicija miša ili kada se komponenta mount-uje
let cardBoxInterval = null

onMounted(() => {
  console.log('🚀 Tree3D mounted')
  
  // Dodaj programski event listener kao backup
  const container = document.querySelector('.map-page-container')
  if (container) {
    container.addEventListener('mousemove', handleMouseMove)
    console.log('✅ Event listener dodat programski')
  }
  
  // Sačekaj da se Tree2D učita
  setTimeout(() => {
    updateCardBoxes()
    console.log('📦 Tree2D učitan, box-ovi ažurirani')
  }, 1000)
  
  // Ažuriraj box-ove periodično (za zoom/pan promene)
  cardBoxInterval = setInterval(() => {
    if (treeOverlayRef.value && !selectedProfile.value) {
      updateCardBoxes()
    }
  }, 300)
  
  // Takođe ažuriraj na resize
  window.addEventListener('resize', updateCardBoxes)
  
  // Cleanup
  onUnmounted(() => {
    if (cardBoxInterval) {
      clearInterval(cardBoxInterval)
    }
    window.removeEventListener('resize', updateCardBoxes)
    if (container) {
      container.removeEventListener('mousemove', handleMouseMove)
    }
  })
})

const handleMouseMove = (event) => {
  if (!treeOverlayRef.value) {
    return
  }
  
  // PRVO proveri šta je tačno na poziciji miša koristeći elementFromPoint
  // Ovo je važno jer event.target može biti canvas ispod kartice
  const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY)
  
  // Proveri da li je element na poziciji miša kartica ili deo kartice
  const isOverCardElement = elementAtPoint?.closest('.tree-node') !== null ||
                            elementAtPoint?.closest('.node-card') !== null ||
                            elementAtPoint?.classList.contains('tree-node') ||
                            elementAtPoint?.classList.contains('node-card')
  
  if (isOverCardElement) {
    isMouseOverTree.value = true
    return
  }
  
  // Proveri sve kartice i njihove bounding box-ove sa proširenom oblast
  const treeNodes = treeOverlayRef.value.querySelectorAll('.tree-node')
  let isInAnyCardBox = false
  const padding = 30 // Veći padding za lakše hvatanje
  
  for (const node of treeNodes) {
    const rect = node.getBoundingClientRect()
    // Proširena oblast oko kartice (padding za lakše hvatanje)
    const expandedRect = {
      left: rect.left - padding,
      right: rect.right + padding,
      top: rect.top - padding,
      bottom: rect.bottom + padding
    }
    
    if (event.clientX >= expandedRect.left && 
        event.clientX <= expandedRect.right &&
        event.clientY >= expandedRect.top && 
        event.clientY <= expandedRect.bottom) {
      isInAnyCardBox = true
      break
    }
  }
  
  // Ako nije preko kartice, proveri da li je preko mape
  if (!isInAnyCardBox) {
    const target = event.target
    const isOverMap = target.closest('.maptiler-map') !== null ||
                      target.closest('.maplibregl-canvas') !== null ||
                      target.closest('.maplibregl-popup') !== null ||
                      target.classList.contains('maplibregl-canvas') ||
                      target.classList.contains('maplibregl-popup') ||
                      elementAtPoint?.closest('.maptiler-map') !== null ||
                      elementAtPoint?.closest('.maplibregl-canvas') !== null
    
    if (isOverMap) {
      isMouseOverTree.value = false
      return
    }
  }
  
  // Aktiviraj stablo ako je u bounding box-u bilo koje kartice
  isMouseOverTree.value = isInAnyCardBox
}

// Dummy slike za profile
const getDummyImages = (name) => {
  const imageUrls = [
    `https://picsum.photos/400/600?random=${name.charCodeAt(0)}`,
    `https://picsum.photos/400/600?random=${name.charCodeAt(0) + 1}`,
    `https://picsum.photos/400/600?random=${name.charCodeAt(0) + 2}`,
    `https://picsum.photos/400/600?random=${name.charCodeAt(0) + 3}`,
  ]
  return imageUrls
}

const currentImage = computed(() => {
  if (!selectedProfile.value || !selectedProfile.value.images) return ''
  return selectedProfile.value.images[currentImageIndex.value] || selectedProfile.value.images[0]
})

const handleProfileClick = (profileData) => {
  // Postavi selektovani profil sa dummy slikama
  selectedProfile.value = {
    ...profileData,
    images: getDummyImages(profileData.firstName),
    bio: `Ovo je biografija za ${profileData.firstName} ${profileData.lastName}. Ovde će biti prikazane informacije o životu, karijeri i interesovanjima ovog člana porodice.`,
    occupation: 'Profesionalac',
    birthDate: '01.01.1980'
  }
  currentImageIndex.value = 0

  // Zumiraj mapu na lokaciju profila
  if (mapInstance.value && profileData.lat && profileData.lng) {
    mapInstance.value.flyTo({
      center: [profileData.lng, profileData.lat],
      zoom: 12,
      duration: 2000,
      essential: true
    })
  }
}

const closeProfileModal = () => {
  selectedProfile.value = null
  currentImageIndex.value = 0
}

const handleBackToProfile = () => {
  router.push('/home')
}

// GeoJSON sa dummy tačkama (kao što si imao)
const createMapPointsGeoJSON = () => {
  const dummyProfiles = [
    { id: 'd1', name: 'Marko Marković', location: { lat: 44.8176, lng: 20.4633, city: 'Beograd', country: 'Srbija' } },
    { id: 'd2', name: 'Ana Petrović', location: { lat: 43.8563, lng: 18.4131, city: 'Sarajevo', country: 'BiH' } },
    { id: 'd3', name: 'Ivan Ivanović', location: { lat: 45.8150, lng: 15.9819, city: 'Zagreb', country: 'Hrvatska' } },
    { id: 'd4', name: 'Marija Jovanović', location: { lat: 46.0569, lng: 14.5058, city: 'Ljubljana', country: 'Slovenija' } },
    { id: 'd5', name: 'John Smith', location: { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'SAD' } },
    { id: 'd6', name: 'Maria Garcia', location: { lat: 41.9028, lng: 12.4964, city: 'Rim', country: 'Italija' } },
  ]

  const features = dummyProfiles.map(profile => ({
    type: 'Feature',
    properties: {
      id: profile.id,
      name: profile.name,
      city: profile.location.city,
      country: profile.location.country
    },
    geometry: {
      type: 'Point',
      coordinates: [profile.location.lng, profile.location.lat]
    }
  }))

  return { type: 'FeatureCollection', features }
}

onMounted(async () => {
  const styleId = import.meta.env.VITE_MAPTILER_STYLE_ID
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY

  if (!styleId || !apiKey) {
    console.error('MapTiler ključevi nisu podešeni!')
    return
  }

  const styleUrl = `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`

  mapInstance.value = new maplibregl.Map({
    container: mapContainer.value,
    style: styleUrl,
    center: [10, 30],   // bolji početni centar za Evropu + svet
    zoom: 2.2,
    renderWorldCopies: false
  })

  mapInstance.value.addControl(new maplibregl.NavigationControl(), 'top-right')

  mapInstance.value.on('load', () => {
    setTimeout(() => {
      const geojsonData = createMapPointsGeoJSON()

      mapInstance.value.addSource('family-locations', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      })

      // Klasteri
      mapInstance.value.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'family-locations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#ff6b9d',
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40]
        }
      })

      mapInstance.value.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'family-locations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 14,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']
        },
        paint: { 'text-color': '#ffffff' }
      })

      // Pojedinačne tačke
      mapInstance.value.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'family-locations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#a78bfa',
          'circle-radius': 10,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      })

      // Popup na klik - ONEMOGUĆEN (ne želimo default popup)
      // mapInstance.value.on('click', 'unclustered-point', (e) => {
      //   const coords = e.features[0].geometry.coordinates.slice()
      //   const props = e.features[0].properties
      //   new maplibregl.Popup()
      //     .setLngLat(coords)
      //     .setHTML(`<strong>${props.name}</strong><br>${props.city}, ${props.country}`)
      //     .addTo(mapInstance.value)
      // })

      mapInstance.value.on('mouseenter', 'unclustered-point', () => {
        mapInstance.value.getCanvas().style.cursor = 'pointer'
      })
      mapInstance.value.on('mouseleave', 'unclustered-point', () => {
        mapInstance.value.getCanvas().style.cursor = ''
      })
    }, 800)
  })
})

onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.remove()
  }
})
</script>

<style scoped>
.map-page-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #020308;
  overflow: hidden;
}

/* Header */
.map-page-header {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.back-button-map {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.back-button-map:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: #a78bfa;
  transform: translateY(-2px);
}

.map-page-title {
  pointer-events: auto;
  text-align: center;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.map-page-title h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
  margin: 0;
}

.map-page-title p {
  font-size: 14px;
  opacity: 0.8;
  margin: 4px 0 0;
  letter-spacing: 1px;
}


/* Mapa */
.maptiler-map {
  position: absolute;
  inset: 0;
  transition: pointer-events 0.2s ease;
}

.maptiler-map.map-disabled {
  pointer-events: none;
}

/* Kada je miš preko stabla, blokiraj mapu */
.tree-overlay.tree-active ~ .maptiler-map {
  pointer-events: none !important;
}

/* Osiguraj da je mapa vidljiva po defaultu */
.maptiler-map {
  pointer-events: auto !important;
}

/* ==================== 2D TREE OVERLAY – BRUTALNO VIDLJIVO ==================== */
.tree-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;           /* Po defaultu ne blokira mapu */
  z-index: 10;
  opacity: 0.58;                  /* glavna prozirnost – savršeno balansirano */
  transition: opacity 0.5s ease;
}

.tree-overlay:hover {
  opacity: 0.78;                  /* kad pređeš mišem – stablo postane jače */
}

.tree-overlay.tree-active {
  opacity: 0.85;                  /* kada je aktivno, još vidljivije */
}

/* Omogući interakciju sa stablom samo kada je tree aktivno */
.tree-overlay :deep(.tree-canvas) {
  pointer-events: none !important; /* Po defaultu, stablo ne blokira mapu */
}

.tree-overlay.tree-active :deep(.tree-canvas.interactive) {
  pointer-events: auto !important; /* Kada je aktivno, stablo je interaktivno */
}

/* Omogući pointer-events na kartice kada je stablo aktivno */
.tree-overlay.tree-active :deep(.tree-node),
.tree-overlay.tree-active :deep(.node-card) {
  pointer-events: auto !important;
}

.tree-overlay.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

/* Debug box-ovi za kartice */
.card-interaction-box {
  position: absolute;
  border: 2px solid red;
  background: rgba(255, 0, 0, 0.1);
  pointer-events: none;
  z-index: 100;
  box-sizing: border-box;
}

/* Linije – svetle i kontrastne */
.tree-overlay :deep(.connection-line) {
  stroke: #c4b5fd !important;     /* prelepa svetlo ljubičasta */
  stroke-width: 4 !important;
  stroke-opacity: 0.9 !important;
}

/* Kartice čvorova – tamna prozirna pozadina sa belim tekstom */
.tree-overlay :deep(.node-card) {
  background: rgba(15, 15, 35, 0.92) !important;
  border: 1px solid rgba(167, 139, 250, 0.5) !important;
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  width: 180px !important;
  padding: 10px 12px !important;
}

.tree-overlay :deep(.node-name) {
  color: #e0d4ff !important;
  font-weight: 700;
}

.tree-overlay :deep(.node-details) {
  color: #bdb2ff !important;
}

/* Avatar – isti gradient, malo jači */
.tree-overlay :deep(.node-avatar) {
  background: linear-gradient(135deg, #8b5cf6, #a78bfa) !important;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
  width: 40px !important;
  height: 40px !important;
  font-size: 1.2rem !important;
}

.tree-overlay :deep(.node-name) {
  font-size: 0.95rem !important;
}

.tree-overlay :deep(.node-details) {
  font-size: 0.75rem !important;
}

/* Hover efekat na čvorovima */
.tree-overlay :deep(.tree-node:hover .node-card) {
  transform: translateY(-8px) scale(1.05) !important;
  box-shadow: 0 20px 40px rgba(139, 92, 246, 0.4) !important;
}

/* ==================== PROFILE MODAL ==================== */
.profile-modal {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 35vh;
  background: rgba(15, 15, 35, 0.98);
  backdrop-filter: blur(20px);
  z-index: 1000;
  box-shadow: 0 -10px 50px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
}

.modal-close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 18px;
  cursor: pointer;
  z-index: 1001;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

.modal-content {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
}

/* Leva sekcija - Galerija slika (1/3) */
.modal-gallery {
  width: 33.333%;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.gallery-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15px;
  min-height: 0;
}

.gallery-main img {
  width: 100%;
  height: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
}

.gallery-thumbnails {
  display: flex;
  gap: 6px;
  padding: 10px;
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.thumbnail {
  min-width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  flex-shrink: 0;
}

.thumbnail:hover {
  opacity: 1;
  transform: scale(1.05);
}

.thumbnail.active {
  opacity: 1;
  border-color: #a78bfa;
  box-shadow: 0 0 20px rgba(167, 139, 250, 0.5);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Desne sekcije - Detalji (2/3) */
.modal-details {
  width: 66.666%;
  padding: 15px 20px;
  overflow-y: auto;
  color: white;
  display: flex;
  flex-direction: column;
}

.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.profile-avatar-large {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b5cf6, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
  margin-right: 10px;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
  flex-shrink: 0;
}

.profile-header h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e0d4ff;
  margin: 0 0 3px 0;
}

.profile-subtitle {
  color: #bdb2ff;
  font-size: 1rem;
  margin: 0;
}

.profile-info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item strong {
  color: #a78bfa;
  font-size: 0.95rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-item span {
  color: #e0d4ff;
  font-size: 1.1rem;
}

.bio-text {
  color: #bdb2ff;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
}

/* Animacija za modal - slide up */
.slide-up-enter-active {
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-up-enter-from {
  transform: translateY(100%);
}

.slide-up-leave-to {
  transform: translateY(100%);
}

/* Responsive za manje ekrane */
@media (max-width: 768px) {
  .profile-modal {
    max-height: 45vh;
  }

  .modal-content {
    flex-direction: column;
  }

  .modal-gallery {
    width: 100%;
    height: 120px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-details {
    width: 100%;
    padding: 12px;
  }

  .gallery-main {
    max-width: 120px;
    padding: 8px;
  }

  .thumbnail {
    min-width: 45px;
    height: 45px;
  }

  .profile-avatar-large {
    width: 45px;
    height: 45px;
    font-size: 1.3rem;
  }

  .profile-header h2 {
    font-size: 1.1rem;
  }
}
</style>