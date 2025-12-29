<template>
  <div class="profile-edit-container">
    <header class="app-header">
      <h1>{{ isEditMode ? 'Uredi Profil' : 'Dodaj Profil' }}</h1>
      <router-link to="/home" class="btn-secondary">← Nazad</router-link>
    </header>

    <div class="profile-content">
      <form @submit.prevent="saveProfile" class="profile-form">
        <div class="form-section">
          <h2>Osnovni Podaci</h2>
          
          <div class="form-group">
            <label>Ime *</label>
            <input type="text" v-model="formData.name" required />
          </div>
          
          <div class="form-group">
            <label>Godine</label>
            <input type="number" v-model.number="formData.age" />
          </div>
          
          <div class="form-group">
            <label>Veza sa roditeljem</label>
            <select v-model="formData.relation">
              <option value="">Izaberi vezu</option>
              <option value="parent">Roditelj</option>
              <option value="child">Dete</option>
              <option value="sibling">Brat/Sestra</option>
              <option value="spouse">Supružnik</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Roditelj</label>
            <select v-model="formData.parentId">
              <option value="">Nema roditelja (glavni profil)</option>
              <option 
                v-for="profile in availableParents" 
                :key="profile.id" 
                :value="profile.id"
              >
                {{ profile.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Opis</label>
            <textarea v-model="formData.description" rows="4"></textarea>
          </div>
        </div>

        <div class="form-section">
          <h2>Biografija</h2>
          <div class="form-group">
            <label>Detalji o profilu</label>
            <textarea 
              v-model="formData.biography" 
              rows="6"
              placeholder="Unesi biografiju, životnu priču, uspomene..."
            ></textarea>
          </div>
        </div>

        <div class="form-section">
          <h2>Lokacija</h2>
          <div class="form-group">
            <label>Adresa</label>
            <input 
              type="text" 
              v-model="formData.locationAddress" 
              placeholder="Unesi adresu..."
            />
          </div>
          <div class="form-group">
            <button 
              type="button" 
              @click="getCurrentLocation" 
              class="btn-secondary"
              :disabled="gettingLocation"
            >
              {{ gettingLocation ? 'Dobijam lokaciju...' : 'Koristi moju trenutnu lokaciju' }}
            </button>
          </div>
          <div v-if="formData.location" class="location-info">
            <p><strong>Sačuvana lokacija:</strong> {{ formData.locationAddress || `${formData.location.lat?.toFixed(4)}, ${formData.location.lng?.toFixed(4)}` }}</p>
            <button type="button" @click="clearLocation" class="btn-small">Ukloni lokaciju</button>
          </div>
        </div>

        <div class="form-section">
          <h2>Slike Kocke</h2>
          <p class="section-description">Dodaj slike za svaku stranu kocke (Leva, Desna, Gornja, Donja, Prednja, Zadnja)</p>
          
          <div class="images-grid">
            <div 
              v-for="(side, index) in sideNames" 
              :key="index"
              class="image-upload-item"
            >
              <label>{{ side }}</label>
              <div class="image-preview-container">
                <img 
                  v-if="formData.images[index]" 
                  :src="formData.images[index]" 
                  class="image-preview"
                />
                <div v-else class="image-placeholder">Nema slike</div>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                @change="handleImageUpload($event, index)"
                class="image-input"
              />
              <button 
                v-if="formData.images[index]"
                type="button"
                @click="removeImage(index)"
                class="btn-small"
              >
                Ukloni
              </button>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Sačuvaj</button>
          <router-link to="/home" class="btn-secondary">Otkaži</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFamilyTreeStore } from '../stores/familyTree'

const route = useRoute()
const router = useRouter()
const { familyTree } = useFamilyTreeStore()

const isEditMode = computed(() => !!route.params.id)
const sideNames = ['Leva', 'Desna', 'Gornja', 'Donja', 'Prednja', 'Zadnja']

const formData = ref({
  name: '',
  age: null,
  description: '',
  biography: '',
  location: null,
  locationAddress: '',
  relation: '',
  parentId: '',
  images: [null, null, null, null, null, null],
  isUnlocked: true
})

const availableParents = computed(() => {
  if (isEditMode.value) {
    return familyTree.getAllProfiles().filter(p => p.id !== route.params.id)
  }
  return familyTree.getAllProfiles()
})

onMounted(() => {
  if (isEditMode.value) {
    const profile = familyTree.getProfile(route.params.id)
    if (profile) {
      formData.value = {
        name: profile.name || '',
        age: profile.age || null,
        description: profile.description || '',
        biography: profile.biography || '',
        location: profile.location || null,
        locationAddress: profile.location?.address || '',
        relation: profile.relation || '',
        parentId: profile.parentId || '',
        images: profile.images || [null, null, null, null, null, null],
        isUnlocked: profile.isUnlocked !== undefined ? profile.isUnlocked : true
      }
    }
  } else {
    // Ako se dodaje novi profil sa query parametrima
    const relation = route.query.relation
    const relatedTo = route.query.relatedTo
    
    if (relation && relatedTo) {
      const relatedProfile = familyTree.getProfile(relatedTo)
      if (relatedProfile) {
        formData.value.relation = relation
        
        if (relation === 'child') {
          // Dete - parentId je relatedTo
          formData.value.parentId = relatedTo
        } else if (relation === 'parent') {
          // Roditelj - parentId ostaje prazan, ali ćemo postaviti da relatedTo ima ovog kao parentId
          formData.value.parentId = ''
        } else if (relation === 'sibling') {
          // Brat/Sestra - isti parentId kao relatedTo
          formData.value.parentId = relatedProfile.parentId || ''
        } else if (relation === 'spouse') {
          // Supružnik - nema parentId veze
          formData.value.parentId = ''
        }
      }
    }
  }
})

const handleImageUpload = (event, index) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      formData.value.images[index] = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const gettingLocation = ref(false)

const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    alert('Geolokacija nije podržana u ovom browser-u')
    return
  }
  
  gettingLocation.value = true
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords
      formData.value.location = {
        lat: latitude,
        lng: longitude,
        address: formData.value.locationAddress || null,
        country: null,
        city: null
      }
      gettingLocation.value = false
    },
    (error) => {
      console.error('Greška pri dobijanju lokacije:', error)
      alert('Nije moguće dobiti lokaciju. Proverite dozvole za lokaciju u browser-u.')
      gettingLocation.value = false
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minuta
    }
  )
}

const clearLocation = () => {
  formData.value.location = null
  formData.value.locationAddress = ''
}

const saveProfile = () => {
  // Validacija - ime je obavezno
  if (!formData.value.name || formData.value.name.trim() === '') {
    alert('Ime je obavezno polje!')
    return
  }
  
  if (isEditMode.value) {
    // Pripremi location objekat
    const locationData = formData.value.location ? {
      ...formData.value.location,
      address: formData.value.locationAddress || formData.value.location.address
    } : null
    
    familyTree.updateProfile(route.params.id, {
      name: formData.value.name.trim(),
      age: formData.value.age || null,
      description: formData.value.description || '',
      biography: formData.value.biography || '',
      location: locationData,
      relation: formData.value.relation || null,
      parentId: formData.value.parentId && formData.value.parentId !== '' ? formData.value.parentId : null,
      images: formData.value.images,
      isUnlocked: formData.value.isUnlocked
    })
    
    // Ažuriraj slike
    formData.value.images.forEach((image, index) => {
      if (image) {
        familyTree.updateProfileImage(route.params.id, index, image)
      } else {
        familyTree.updateProfileImage(route.params.id, index, null)
      }
    })
  } else {
    // Normalizuj parentId - prazan string postaje null
    const parentId = formData.value.parentId && formData.value.parentId !== '' 
      ? formData.value.parentId 
      : null
    
    // Pripremi location objekat
    const locationData = formData.value.location ? {
      ...formData.value.location,
      address: formData.value.locationAddress || formData.value.location.address
    } : null
    
    const newProfile = familyTree.addProfile({
      name: formData.value.name.trim(),
      age: formData.value.age || null,
      description: formData.value.description || '',
      biography: formData.value.biography || '',
      location: locationData,
      relation: formData.value.relation || null,
      parentId: parentId,
      images: formData.value.images,
      isUnlocked: formData.value.isUnlocked
    })
    
    if (!newProfile) {
      console.error('Greška pri dodavanju profila')
      alert('Greška pri dodavanju profila. Pokušaj ponovo.')
      return
    }
    
    console.log('Novi profil dodat:', newProfile)
    
    // Ako je dodao roditelja, ažuriraj relatedTo profil da ima ovog kao parentId
    const relation = route.query.relation
    const relatedTo = route.query.relatedTo
    
    if (relation === 'parent' && relatedTo) {
      const relatedProfile = familyTree.getProfile(relatedTo)
      if (relatedProfile) {
        familyTree.updateProfile(relatedTo, {
          parentId: newProfile.id
        })
      }
    }
    
    // Postavi početnu poziciju na osnovu veze
    const relatedProfile = relatedTo ? familyTree.getProfile(relatedTo) : null
    if (relatedProfile) {
      const relatedPos = familyTree.getProfilePosition(relatedTo)
      if (relatedPos) {
        const nodeWidth = 180
        const nodeHeight = 120
        const horizontalSpacing = 250
        const verticalSpacing = 200
        
        let newX = relatedPos.x
        let newY = relatedPos.y
        
        if (relation === 'child') {
          // Dete - ispod
          newY = relatedPos.y + verticalSpacing
          // Pozicioniraj horizontalno sa drugom decom
          const siblings = familyTree.getAllProfiles().filter(p => 
            p.parentId === relatedTo && p.id !== newProfile.id
          )
          newX = relatedPos.x + (siblings.length * horizontalSpacing)
        } else if (relation === 'parent') {
          // Roditelj - iznad
          newY = relatedPos.y - verticalSpacing
        } else if (relation === 'sibling') {
          // Brat/Sestra - isti level, horizontalno raspoređeni
          const allSiblings = familyTree.getAllProfiles().filter(p => 
            p.parentId === relatedProfile.parentId
          )
          const siblingIndex = allSiblings.length - 1 // Novi sibling je poslednji
          const totalSiblings = allSiblings.length
          newX = relatedPos.x + ((siblingIndex - (totalSiblings - 1) / 2) * horizontalSpacing)
          newY = relatedPos.y // Isti Y kao relatedTo
        } else if (relation === 'spouse') {
          // Supružnik - pored
          newX = relatedPos.x + horizontalSpacing
        }
        
        familyTree.updateProfilePosition(newProfile.id, newX, newY)
      } else {
        // Ako nema sačuvanu poziciju, koristi automatski layout
        // Pozicija će biti izračunata u calculateTreeLayout
      }
    }
  }
  
  router.push('/tree-2d')
}
</script>

<style scoped>
.profile-edit-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.app-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  color: #667eea;
  font-size: 1.5rem;
}

.btn-secondary {
  padding: 0.6rem 1.2rem;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.profile-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.profile-form {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h2 {
  color: #667eea;
  margin-bottom: 1rem;
}

.section-description {
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.image-upload-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-upload-item label {
  font-weight: 600;
  color: #333;
}

.image-preview-container {
  width: 100%;
  height: 150px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  color: #999;
  font-size: 0.9rem;
}

.location-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.location-info p {
  color: #666;
  margin: 0;
}

.image-input {
  padding: 0.5rem;
  font-size: 0.9rem;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.3s;
}

.btn-small:hover {
  background: #c82333;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.btn-primary {
  padding: 0.8rem 2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>

