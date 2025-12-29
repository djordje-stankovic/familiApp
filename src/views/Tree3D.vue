<template>
  <div class="map-page-container">
    <div class="map-page-header">
      <button @click="handleBackToProfile" class="back-button-map">
        <span class="back-icon">←</span>
        <span>NAZAD</span>
      </button>
      <div class="map-page-title">
        <h1>World Map</h1>
        <p>Custom MapTiler style</p>
      </div>
    </div>

    <div ref="mapContainer" class="maptiler-map"></div>
    
    <!-- 3D Tree Overlay -->
    <!-- <div ref="treeContainer" class="tree-3d-overlay"></div> -->
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import { useFamilyTreeStore } from '../stores/familyTree.js'
import { Tree3DRenderer } from '../components/Tree3DRenderer.js'

const router = useRouter()
const familyTreeStore = useFamilyTreeStore()

const mapContainer = ref(null)
const treeContainer = ref(null)
const mapInstance = ref(null)
const treeRenderer = ref(null)

const handleBackToProfile = () => {
  router.push('/home')
}

// Kreiraj GeoJSON podatke za tačke na mapi
const createMapPointsGeoJSON = () => {
  const features = []
  
  // Dodaj dummy podatke za testiranje
  const dummyProfiles = [
    { id: 'dummy1', name: 'Marko Marković', location: { lat: 44.8176, lng: 20.4633, country: 'Srbija', city: 'Beograd' } },
    { id: 'dummy2', name: 'Ana Petrović', location: { lat: 43.8563, lng: 18.4131, country: 'Bosna i Hercegovina', city: 'Sarajevo' } },
    { id: 'dummy3', name: 'Ivan Ivanović', location: { lat: 45.8150, lng: 15.9819, country: 'Hrvatska', city: 'Zagreb' } },
    { id: 'dummy4', name: 'Marija Jovanović', location: { lat: 46.0569, lng: 14.5058, country: 'Slovenija', city: 'Ljubljana' } },
    { id: 'dummy5', name: 'Petar Petrović', location: { lat: 42.6977, lng: 23.3219, country: 'Bugarska', city: 'Sofija' } },
    { id: 'dummy6', name: 'John Smith', location: { lat: 40.7128, lng: -74.0060, country: 'SAD', city: 'New York' } },
    { id: 'dummy7', name: 'Maria Garcia', location: { lat: 41.9028, lng: 12.4964, country: 'Italija', city: 'Rim' } }
  ]
  
  // Dodaj stvarne profile
  const profiles = familyTreeStore.familyTree.getAllProfiles()
  if (profiles && Array.isArray(profiles)) {
    profiles.forEach(profile => {
      if (profile.location && profile.location.lat && profile.location.lng) {
        features.push({
          type: 'Feature',
          properties: {
            id: profile.id,
            name: profile.name,
            country: profile.location.country || '',
            city: profile.location.city || ''
          },
          geometry: {
            type: 'Point',
            coordinates: [profile.location.lng, profile.location.lat]
          }
        })
      }
    })
  }
  
  // Dodaj dummy profile
  dummyProfiles.forEach(profile => {
    features.push({
      type: 'Feature',
      properties: {
        id: profile.id,
        name: profile.name,
        country: profile.location.country,
        city: profile.location.city
      },
      geometry: {
        type: 'Point',
        coordinates: [profile.location.lng, profile.location.lat]
      }
    })
  })
  
  console.log('GeoJSON features:', features) // Debug log
  
  return {
    type: 'FeatureCollection',
    features: features
  }
}

onMounted(async () => {
  const styleId = import.meta.env.VITE_MAPTILER_STYLE_ID
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY

  if (!mapContainer.value) {
    console.error('Map container not found')
    return
  }

  if (!styleId || !apiKey) {
    console.error('MapTiler STYLE_ID or API_KEY not configured')
    return
  }

  const styleUrl = `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`

  // Inicijalizuj mapu
  mapInstance.value = new maplibregl.Map({
    container: mapContainer.value,
    style: styleUrl,
    center: [0, 0],
    zoom: 1.0,
    renderWorldCopies: false // Onemogući ponavljanje mape
  })

  mapInstance.value.addControl(new maplibregl.NavigationControl(), 'top-right')

  // Sačekaj da se mapa učita
  mapInstance.value.on('load', () => {
    console.log('Mapa učitana, čekam 1s pre dodavanja tačaka...')
    
    // Sačekaj malo da se mapa potpuno inicijalizuje
    setTimeout(() => {
      const geojsonData = createMapPointsGeoJSON()
      console.log('GeoJSON data:', geojsonData)
      
      if (geojsonData.features.length === 0) {
        console.warn('Nema tačaka za prikaz!')
        return
      }
      
      try {
        mapInstance.value.addSource('family-locations', {
          type: 'geojson',
          data: geojsonData,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        })
        
        console.log('Source dodat uspešno')
        
        // Dodaj clustered layer za grupe
        mapInstance.value.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'family-locations',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#f28cb1',
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15, // Smaller base size
              10,
              20, // Medium clusters
              50,
              25  // Large clusters
            ]
          }
        })

        // Dodaj layer za broj članova u grupi
        mapInstance.value.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'family-locations',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          }
        })

        // Dodaj layer za individualne tačke
        /*
        mapInstance.value.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'family-locations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#11b4da',
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        })
        */

        // Dodaj popup za tačke
        /*
        mapInstance.value.on('click', 'unclustered-point', (e) => {
          const coordinates = e.features[0].geometry.coordinates.slice()
          const { name, country, city } = e.features[0].properties
          
          new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(`<strong>${name}</strong><br>${city ? city + ', ' : ''}${country}`)
            .addTo(mapInstance.value)
        })
        */
        
        // Dodaj popup za grupe
        mapInstance.value.on('click', 'clusters', (e) => {
          const features = mapInstance.value.queryRenderedFeatures(e.point, {
            layers: ['clusters']
          })
          const clusterId = features[0].properties.cluster_id
          const pointCount = features[0].properties.point_count
          
          mapInstance.value.getSource('family-locations').getClusterLeaves(
            clusterId,
            pointCount,
            0,
            (error, features) => {
              if (error) return
              
              const names = features.map(f => f.properties.name).join(', ')
              const coordinates = e.lngLat
              
              new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`<strong>${pointCount} članova:</strong><br>${names}`)
                .addTo(mapInstance.value)
            }
          )
        })
        
        // Promeni kursor na pointer kada je preko tačke
        /*
        mapInstance.value.on('mouseenter', 'unclustered-point', () => {
          mapInstance.value.getCanvas().style.cursor = 'pointer'
        })
        mapInstance.value.on('mouseleave', 'unclustered-point', () => {
          mapInstance.value.getCanvas().style.cursor = ''
        })
        */
        mapInstance.value.on('mouseenter', 'unclustered-point', () => {
          mapInstance.value.getCanvas().style.cursor = 'pointer'
        })
        mapInstance.value.on('mouseleave', 'unclustered-point', () => {
          mapInstance.value.getCanvas().style.cursor = ''
        })
        
        console.log('Event handleri dodani')
        
      } catch (error) {
        console.error('Greška pri dodavanju source/layera:', error)
      }
    }, 1000) // Čekaj 1 sekundu

    // Inicijalizuj 3D stablo sa niskim opacitijem
    /*
    if (treeContainer.value) {
      treeRenderer.value = new Tree3DRenderer(treeContainer.value, familyTreeStore, {
        opacity: 0.3, // Nizak opacitij da se mapa vidi
        showMapBackground: false // Ne prikazuj mapu u 3D renderer-u
      })
    }
    */
  })
})

onUnmounted(() => {
  if (treeRenderer.value) {
    treeRenderer.value.dispose()
    treeRenderer.value = null
  }
  
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})
</script>

<style scoped>
.map-page-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #020308;
}

.map-page-header {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.back-button-map {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: radial-gradient(circle at top left, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.95));
  color: #fff;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-button-map:hover {
  background: radial-gradient(circle at top left, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 1));
  border-color: rgba(255, 255, 255, 0.4);
}

.map-page-title {
  text-align: center;
  color: #fff;
}

.map-page-title h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.map-page-title p {
  margin: 4px 0 0 0;
  font-size: 14px;
  opacity: 0.7;
}

.maptiler-map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.tree-3d-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.back-button-map:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 30px rgba(0, 0, 0, 1);
  border-color: rgba(255, 255, 255, 0.4);
}

.back-icon {
  font-size: 15px;
}

.map-page-title {
  pointer-events: auto;
  text-align: right;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
}

.map-page-title h1 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.map-page-title p {
  margin: 2px 0 0;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.maptiler-map {
  position: absolute;
  inset: 0;
}

/* MapLibre default styles fix */
.maptiler-map :deep(.maplibregl-map) {
  font: 12px/20px 'Helvetica Neue', Arial, Helvetica, sans-serif;
}
</style>
