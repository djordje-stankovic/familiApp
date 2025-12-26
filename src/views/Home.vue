<template>
  <div class="home-container">
    <AppHeader />

    <div class="home-content">
      <!-- Ako nema profila, prikaži formu za kreiranje prvog profila -->
      <div v-if="hasNoProfiles && !hasRelationParams" class="create-first-profile-section">
        <div class="welcome-section">
          <h2>Kreiraj Stablo</h2>
          <p>Počni sa građenjem svog porodičnog stabla - unesi svoje podatke</p>
        </div>
        
        <!-- Profile Edit Form -->
        <div class="profile-edit-section">
          <h3>Unesi Svoje Podatke</h3>
          <form @submit.prevent="saveFirstProfile" class="profile-form">
          <div class="form-section">
            <h4>Osnovni Podaci</h4>
            
            <div class="form-row">
              <div class="form-group">
                <label>Ime *</label>
                <input type="text" v-model="formData.firstName" required />
              </div>
              
              <div class="form-group">
                <label>Prezime *</label>
                <input type="text" v-model="formData.lastName" required />
              </div>
            </div>
            
            <div class="form-group">
              <label>Godine</label>
              <input type="number" v-model.number="formData.age" />
            </div>
          </div>

          <div class="form-section">
            <h4>Lokacija</h4>
            <p class="section-description">Klikni na mapu da biraš lokaciju, ili unesi adresu i klikni "Pretraži"</p>
            
            <div class="form-group">
              <label>Adresa (opciono - za pretragu)</label>
              <div class="search-location-input">
                <input 
                  type="text" 
                  v-model="searchAddressInput" 
                  placeholder="Unesi adresu za pretragu..."
                  @keyup.enter="searchLocation"
                />
                <button type="button" @click="searchLocation" class="btn-search">Pretraži</button>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Država *</label>
                <input 
                  type="text" 
                  v-model="formData.country" 
                  placeholder="Popunjava se automatski kada klikneš na mapu..."
                  required
                />
              </div>
              
              <div class="form-group">
                <label>Grad *</label>
                <input 
                  type="text" 
                  v-model="formData.city" 
                  placeholder="Popunjava se automatski kada klikneš na mapu..."
                  required
                />
              </div>
            </div>
            
            <div class="map-container" ref="mapContainer"></div>
            <div v-if="formData.location" class="location-info">
              <p><strong>Izabrana lokacija:</strong> {{ formData.locationAddress || `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` }}</p>
            </div>
          </div>

          <div class="form-section">
            <h4>Biografija</h4>
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
            <h4>Profilna Slika</h4>
            <div class="image-upload-container">
              <div class="image-preview-large" v-if="formData.profileImage">
                <img :src="formData.profileImage" alt="Profilna slika" />
                <button type="button" @click="removeProfileImage" class="btn-remove">×</button>
              </div>
              <div v-else class="image-placeholder-large">
                <p>Nema profilne slike</p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                @change="handleProfileImageUpload"
                class="image-input"
              />
            </div>
          </div>

          <div class="form-section">
            <h4>Galerija Slika</h4>
            <p class="section-description">Dodaj slike za istoriju ove osobe</p>
            <div class="gallery-grid">
              <div 
                v-for="(image, index) in formData.galleryImages" 
                :key="index"
                class="gallery-item"
              >
                <img :src="image" alt="Galerija slika" />
                <button type="button" @click="removeGalleryImage(index)" class="btn-remove-small">×</button>
              </div>
              <div class="gallery-add" @click="triggerGalleryUpload">
                <span>+ Dodaj sliku</span>
                <input 
                  ref="galleryInput"
                  type="file" 
                  accept="image/*" 
                  @change="handleGalleryImageUpload"
                  style="display: none"
                  multiple
                />
              </div>
            </div>
          </div>


          <div class="form-actions">
            <button type="submit" class="btn-primary">{{ hasNoProfiles ? 'Kreni sa Stablom' : 'Sačuvaj' }}</button>
            <button v-if="!hasNoProfiles" type="button" @click="clearForm" class="btn-secondary">Otkaži</button>
          </div>
        </form>
      </div>
      </div>

      <!-- Ako ima query parametre za dodavanje novog profila, prikaži samo formu -->
      <div v-else-if="hasRelationParams && !hasNoProfiles" class="add-profile-section">
        <div class="profile-edit-section">
          <h3>Dodaj Profil</h3>
          <form @submit.prevent="saveProfile" class="profile-form">
            <div class="form-section">
              <h4>Osnovni Podaci</h4>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Ime *</label>
                  <input type="text" v-model="formData.firstName" required />
                </div>
                
                <div class="form-group">
                  <label>Prezime *</label>
                  <input type="text" v-model="formData.lastName" required />
                </div>
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
                    {{ profile.name || `${profile.firstName} ${profile.lastName}` }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-section">
              <h4>Biografija</h4>
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
              <h4>Lokacija</h4>
              <p class="section-description">Klikni na mapu da biraš lokaciju, ili unesi adresu i klikni "Pretraži"</p>
              
              <div class="form-group">
                <label>Adresa (opciono - za pretragu)</label>
                <div class="search-location-input">
                  <input 
                    type="text" 
                    v-model="searchAddressInput" 
                    placeholder="Unesi adresu za pretragu..."
                    @keyup.enter="searchLocation"
                  />
                  <button type="button" @click="searchLocation" class="btn-search">Pretraži</button>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Država</label>
                  <input 
                    type="text" 
                    v-model="formData.country" 
                    placeholder="Popunjava se automatski kada klikneš na mapu..."
                    readonly
                  />
                </div>
                
                <div class="form-group">
                  <label>Grad</label>
                  <input 
                    type="text" 
                    v-model="formData.city" 
                    placeholder="Popunjava se automatski kada klikneš na mapu..."
                    readonly
                  />
                </div>
              </div>
              
              <div class="map-container" ref="mapContainer"></div>
              <div v-if="formData.location" class="location-info">
                <p><strong>Izabrana lokacija:</strong> {{ formData.locationAddress || `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` }}</p>
              </div>
            </div>

            <div class="form-section">
              <h4>Profilna Slika</h4>
              <div class="image-upload-container">
                <div class="image-preview-large" v-if="formData.profileImage">
                  <img :src="formData.profileImage" alt="Profilna slika" />
                  <button type="button" @click="removeProfileImage" class="btn-remove">×</button>
                </div>
                <div v-else class="image-placeholder-large">
                  <p>Nema profilne slike</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  @change="handleProfileImageUpload"
                  class="image-input"
                />
              </div>
            </div>

            <div class="form-section">
              <h4>Galerija Slika</h4>
              <p class="section-description">Dodaj slike za istoriju ove osobe</p>
              <div class="gallery-grid">
                <div 
                  v-for="(image, index) in formData.galleryImages" 
                  :key="index"
                  class="gallery-item"
                >
                  <img :src="image" alt="Galerija slika" />
                  <button type="button" @click="removeGalleryImage(index)" class="btn-remove-small">×</button>
                </div>
                <div class="gallery-add" @click="triggerGalleryUpload">
                  <span>+ Dodaj sliku</span>
                  <input 
                    ref="galleryInput"
                    type="file" 
                    accept="image/*" 
                    @change="handleGalleryImageUpload"
                    style="display: none"
                    multiple
                  />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">Sačuvaj</button>
              <button type="button" @click="clearFormAndGoBack" class="btn-secondary">Otkaži</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Ako ima profila i nema query parametara, prikaži action buttons -->
      <div v-else-if="!hasNoProfiles && !hasRelationParams">
        <div class="welcome-section">
          <h2>Dobrodošao, {{ authStore.user?.username }}!</h2>
        </div>

        <!-- Action Buttons -->
        <div class="actions-grid">
          <router-link to="/tree-2d" class="action-card">
            <div class="action-icon">📋</div>
            <h3>2D Prikaz Stabla</h3>
            <p>Klasičan tabelarni prikaz porodičnog stabla</p>
          </router-link>
          
          <router-link to="/tree-3d" class="action-card">
            <div class="action-icon">🎯</div>
            <h3>3D Prikaz Stabla</h3>
            <p>Interaktivni 3D prikaz sa kockicama</p>
          </router-link>
        </div>

        <!-- Profile Edit Form - za editovanje postojećeg profila -->
        <div class="profile-edit-section" v-if="selectedProfile">
          <h3>Uredi Profil</h3>
          <form @submit.prevent="saveProfile" class="profile-form">
            <div class="form-section">
              <h4>Osnovni Podaci</h4>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Ime *</label>
                  <input type="text" v-model="formData.firstName" required />
                </div>
                
                <div class="form-group">
                  <label>Prezime *</label>
                  <input type="text" v-model="formData.lastName" required />
                </div>
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
                    {{ profile.name || `${profile.firstName} ${profile.lastName}` }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-section">
              <h4>Biografija</h4>
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
              <h4>Lokacija</h4>
              <p class="section-description">Klikni na mapu da biraš lokaciju, ili unesi adresu i klikni "Pretraži"</p>
              
              <div class="form-group">
                <label>Adresa (opciono - za pretragu)</label>
                <div class="search-location-input">
                  <input 
                    type="text" 
                    v-model="searchAddressInput" 
                    placeholder="Unesi adresu za pretragu..."
                    @keyup.enter="searchLocation"
                  />
                  <button type="button" @click="searchLocation" class="btn-search">Pretraži</button>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Država</label>
                  <input 
                    type="text" 
                    v-model="formData.country" 
                    placeholder="Popunjava se automatski kada klikneš na mapu..."
                  />
                </div>
                
                <div class="form-group">
                  <label>Grad</label>
                  <input 
                    type="text" 
                    v-model="formData.city" 
                    placeholder="Popunjava se automatski kada klikneš na mapu..."
                  />
                </div>
              </div>
              
              <div class="map-container" ref="mapContainer"></div>
              <div v-if="formData.location" class="location-info">
                <p><strong>Izabrana lokacija:</strong> {{ formData.locationAddress || `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` }}</p>
              </div>
            </div>

            <div class="form-section">
              <h4>Profilna Slika</h4>
              <div class="image-upload-container">
                <div class="image-preview-large" v-if="formData.profileImage">
                  <img :src="formData.profileImage" alt="Profilna slika" />
                  <button type="button" @click="removeProfileImage" class="btn-remove">×</button>
                </div>
                <div v-else class="image-placeholder-large">
                  <p>Nema profilne slike</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  @change="handleProfileImageUpload"
                  class="image-input"
                />
              </div>
            </div>

            <div class="form-section">
              <h4>Galerija Slika</h4>
              <p class="section-description">Dodaj slike za istoriju ove osobe</p>
              <div class="gallery-grid">
                <div 
                  v-for="(image, index) in formData.galleryImages" 
                  :key="index"
                  class="gallery-item"
                >
                  <img :src="image" alt="Galerija slika" />
                  <button type="button" @click="removeGalleryImage(index)" class="btn-remove-small">×</button>
                </div>
                <div class="gallery-add" @click="triggerGalleryUpload">
                  <span>+ Dodaj sliku</span>
                  <input 
                    ref="galleryInput"
                    type="file" 
                    accept="image/*" 
                    @change="handleGalleryImageUpload"
                    style="display: none"
                    multiple
                  />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">Sačuvaj</button>
              <button type="button" @click="clearForm" class="btn-secondary">Otkaži</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFamilyTreeStore } from '../stores/familyTree'
import AppHeader from '../components/AppHeader.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { familyTree } = useFamilyTreeStore()

const selectedProfile = ref(null)
const isEditMode = ref(false)
const mapContainer = ref(null)
const map = ref(null)
const marker = ref(null)
const galleryInput = ref(null)
const searchAddressInput = ref('')

const formData = ref({
  firstName: '',
  lastName: '',
  age: null,
  description: '',
  biography: '',
  country: '',
  city: '',
  location: null,
  locationAddress: '',
  profileImage: null,
  galleryImages: [],
  relation: '',
  parentId: '',
  images: [null, null, null, null, null, null],
  isUnlocked: true
})

const hasNoProfiles = computed(() => {
  const profiles = familyTree.getAllProfiles()
  return profiles.length === 0
})

// Watch za promene u broju profila da bi se ažurirao prikaz
watch(() => familyTree.getAllProfiles().length, () => {
  // Force reactivity update
})

const hasRelationParams = computed(() => {
  return !!(route.query.relation && route.query.relatedTo)
})

const availableParents = computed(() => {
  if (isEditMode.value && selectedProfile.value) {
    return familyTree.getAllProfiles().filter(p => p.id !== selectedProfile.value.id)
  }
  return familyTree.getAllProfiles()
})

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
  }
  initMap()
  
  // Check if profileId is in query params (from search)
  const profileId = route.query.profileId
  if (profileId) {
    const profile = familyTree.getProfile(profileId)
    if (profile) {
      selectProfileForEdit(profile)
    }
  }
  
  // Check if relation params are present (from Tree2D addRelation)
  if (route.query.relation && route.query.relatedTo) {
    const relatedProfile = familyTree.getProfile(route.query.relatedTo)
    if (relatedProfile) {
      startNewProfileWithRelation(route.query.relation, route.query.relatedTo)
    }
  }
})

const initMap = () => {
  if (!mapContainer.value) return
  
  nextTick(() => {
    if (!map.value) {
      map.value = L.map(mapContainer.value).setView([44.7866, 20.4489], 13) // Belgrade default
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map.value)
      
      map.value.on('click', (e) => {
        const { lat, lng } = e.latlng
        formData.value.location = { lat, lng }
        
        if (marker.value) {
          map.value.removeLayer(marker.value)
        }
        
        marker.value = L.marker([lat, lng]).addTo(map.value)
        
        // Reverse geocoding - pokušaj da dobiješ adresu, državu i grad
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            if (data.display_name) {
              formData.value.locationAddress = data.display_name
              formData.value.location.address = data.display_name
              
              // Popuni državu i grad ako postoje
              if (data.address) {
                formData.value.country = data.address.country || ''
                formData.value.city = data.address.city || data.address.town || data.address.village || ''
                formData.value.location.country = data.address.country || ''
                formData.value.location.city = data.address.city || data.address.town || data.address.village || ''
              }
            }
          })
          .catch(err => console.error('Geocoding error:', err))
      })
    }
  })
}

const searchLocation = () => {
  if (!searchAddressInput.value || searchAddressInput.value.trim() === '') {
    return
  }
  
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddressInput.value)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const { lat, lon, display_name, address } = data[0]
        const location = { 
          lat: parseFloat(lat), 
          lng: parseFloat(lon), 
          address: display_name,
          country: address?.country || '',
          city: address?.city || address?.town || address?.village || ''
        }
        formData.value.location = location
        formData.value.locationAddress = display_name
        formData.value.country = address?.country || ''
        formData.value.city = address?.city || address?.town || address?.village || ''
        
        if (map.value) {
          map.value.setView([lat, lon], 13)
          
          if (marker.value) {
            map.value.removeLayer(marker.value)
          }
          
          marker.value = L.marker([lat, lon]).addTo(map.value)
        }
        
        // Očisti search input nakon uspešne pretrage
        searchAddressInput.value = ''
      }
    })
    .catch(err => console.error('Geocoding error:', err))
}

const selectProfileForEdit = (profile) => {
  selectedProfile.value = profile
  isEditMode.value = true
  
  const nameParts = profile.name ? profile.name.split(' ') : []
  formData.value = {
    firstName: profile.firstName || (nameParts.length > 0 ? nameParts[0] : ''),
    lastName: profile.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
    age: profile.age || null,
    description: profile.description || '',
    biography: profile.biography || '',
    country: profile.country || profile.location?.country || '',
    city: profile.city || profile.location?.city || '',
    location: profile.location || null,
    locationAddress: profile.location?.address || '',
    profileImage: profile.profileImage || null,
    galleryImages: profile.galleryImages || [],
    relation: profile.relation || '',
    parentId: profile.parentId || '',
    images: profile.images || [null, null, null, null, null, null],
    isUnlocked: profile.isUnlocked !== undefined ? profile.isUnlocked : true
  }
  
  // Update map if location exists
  if (formData.value.location && map.value) {
    nextTick(() => {
      map.value.setView([formData.value.location.lat, formData.value.location.lng], 13)
      if (marker.value) {
        map.value.removeLayer(marker.value)
      }
      marker.value = L.marker([formData.value.location.lat, formData.value.location.lng]).addTo(map.value)
    })
  }
}

const startNewProfile = () => {
  selectedProfile.value = { id: null }
  isEditMode.value = false
  clearForm()
}

const startNewProfileWithRelation = (relation, relatedTo) => {
  selectedProfile.value = { id: null }
  isEditMode.value = false
  clearForm()
  
  const relatedProfile = familyTree.getProfile(relatedTo)
  if (relatedProfile) {
    formData.value.relation = relation
    
    if (relation === 'child') {
      formData.value.parentId = relatedTo
    } else if (relation === 'parent') {
      formData.value.parentId = ''
    } else if (relation === 'sibling') {
      formData.value.parentId = relatedProfile.parentId || ''
    } else if (relation === 'spouse') {
      formData.value.parentId = ''
    }
  }
}

const saveFirstProfile = () => {
  if (!formData.value.firstName || !formData.value.firstName.trim()) {
    alert('Ime je obavezno polje!')
    return
  }
  
  if (!formData.value.lastName || !formData.value.lastName.trim()) {
    alert('Prezime je obavezno polje!')
    return
  }
  
  if (!formData.value.country || !formData.value.country.trim()) {
    alert('Država je obavezno polje!')
    return
  }
  
  if (!formData.value.city || !formData.value.city.trim()) {
    alert('Grad je obavezno polje!')
    return
  }
  
  // Update location with country and city if they exist
  if (formData.value.location) {
    formData.value.location.country = formData.value.country
    formData.value.location.city = formData.value.city
  }
  
  const newProfile = familyTree.addProfile({
    firstName: formData.value.firstName.trim(),
    lastName: formData.value.lastName.trim(),
    age: formData.value.age || null,
    description: formData.value.description || '',
    biography: formData.value.biography || '',
    country: formData.value.country.trim(),
    city: formData.value.city.trim(),
    location: formData.value.location,
    profileImage: formData.value.profileImage,
    galleryImages: formData.value.galleryImages,
    images: formData.value.images,
    isUnlocked: true
  })
  
  if (newProfile) {
    // Automatski prebaci na 2D prikaz
    router.push('/tree-2d')
  } else {
    alert('Greška pri dodavanju profila. Pokušaj ponovo.')
  }
}

const clearForm = () => {
  formData.value = {
    firstName: '',
    lastName: '',
    age: null,
    description: '',
    biography: '',
    country: '',
    city: '',
    location: null,
    locationAddress: '',
    profileImage: null,
    galleryImages: [],
    relation: '',
    parentId: '',
    images: [null, null, null, null, null, null],
    isUnlocked: true
  }
  
  if (marker.value && map.value) {
    map.value.removeLayer(marker.value)
    marker.value = null
  }
  
  if (map.value) {
    map.value.setView([44.7866, 20.4489], 13)
  }
}

const clearFormAndGoBack = () => {
  clearForm()
  selectedProfile.value = null
  // Ukloni query parametre
  router.push('/home')
}

const handleProfileImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      formData.value.profileImage = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const removeProfileImage = () => {
  formData.value.profileImage = null
}

const triggerGalleryUpload = () => {
  if (galleryInput.value) {
    galleryInput.value.click()
  }
}

const handleGalleryImageUpload = (event) => {
  const files = Array.from(event.target.files)
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      formData.value.galleryImages.push(e.target.result)
    }
    reader.readAsDataURL(file)
  })
}

const removeGalleryImage = (index) => {
  formData.value.galleryImages.splice(index, 1)
}

const saveProfile = () => {
  if (!formData.value.firstName || !formData.value.firstName.trim()) {
    alert('Ime je obavezno polje!')
    return
  }
  
  if (!formData.value.lastName || !formData.value.lastName.trim()) {
    alert('Prezime je obavezno polje!')
    return
  }
  
  // Update location with country and city if they exist
  if (formData.value.location) {
    formData.value.location.country = formData.value.country
    formData.value.location.city = formData.value.city
  }
  
  if (isEditMode.value && selectedProfile.value && selectedProfile.value.id) {
    // Update existing profile
    familyTree.updateProfile(selectedProfile.value.id, {
      firstName: formData.value.firstName.trim(),
      lastName: formData.value.lastName.trim(),
      age: formData.value.age || null,
      description: formData.value.description || '',
      biography: formData.value.biography || '',
      country: formData.value.country.trim(),
      city: formData.value.city.trim(),
      location: formData.value.location,
      profileImage: formData.value.profileImage,
      galleryImages: formData.value.galleryImages,
      relation: formData.value.relation || null,
      parentId: formData.value.parentId && formData.value.parentId !== '' ? formData.value.parentId : null,
      images: formData.value.images,
      isUnlocked: formData.value.isUnlocked
    })
    
    alert('Profil je ažuriran!')
  } else {
    // Add new profile
    const parentId = formData.value.parentId && formData.value.parentId !== '' 
      ? formData.value.parentId 
      : null
    
    // Ako je supružnik, postavi spouseId na relatedTo
    let spouseId = null
    if (formData.value.relation === 'spouse' && route.query.relatedTo) {
      spouseId = route.query.relatedTo
    }
    
    const newProfile = familyTree.addProfile({
      firstName: formData.value.firstName.trim(),
      lastName: formData.value.lastName.trim(),
      age: formData.value.age || null,
      description: formData.value.description || '',
      biography: formData.value.biography || '',
      country: formData.value.country.trim(),
      city: formData.value.city.trim(),
      location: formData.value.location,
      profileImage: formData.value.profileImage,
      galleryImages: formData.value.galleryImages,
      relation: formData.value.relation || null,
      parentId: parentId,
      spouseId: spouseId,
      images: formData.value.images,
      isUnlocked: formData.value.isUnlocked
    })
    
    if (newProfile) {
      // Ako je supružnik, postavi i obrnutu vezu (supružnik ima ovog kao spouseId)
      if (spouseId) {
        const spouseProfile = familyTree.getProfile(spouseId)
        if (spouseProfile) {
          familyTree.updateProfile(spouseId, {
            spouseId: newProfile.id
          })
        }
      }
      
      alert('Profil je dodat!')
      clearForm()
      selectedProfile.value = null
      
      // Ako je dodao iz 2D prikaza, vrati se na 2D prikaz
      if (route.query.relation && route.query.relatedTo) {
        router.push('/tree-2d')
      }
    } else {
      alert('Greška pri dodavanju profila. Pokušaj ponovo.')
    }
  }
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

watch(() => mapContainer.value, (newVal) => {
  if (newVal && !map.value) {
    initMap()
  }
})
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.btn-secondary {
  padding: 0.6rem 1.2rem;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.home-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.welcome-section {
  text-align: center;
  margin-bottom: 2rem;
}

.welcome-section h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.action-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  color: inherit;
  transition: all 0.3s;
  cursor: pointer;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.action-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.action-card h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.action-card p {
  color: #666;
  font-size: 0.9rem;
}


.profile-edit-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.profile-edit-section h3 {
  margin-bottom: 1.5rem;
  color: #667eea;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  padding-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h4 {
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

.map-container {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 1rem;
  border: 2px solid #e0e0e0;
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

.btn-large {
  padding: 1rem 2.5rem;
  font-size: 1.1rem;
}

.add-profile-section {
  text-align: center;
  margin-top: 2rem;
}

.image-upload-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.image-preview-large {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.image-preview-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-remove {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}

.btn-remove:hover {
  background: rgba(220, 53, 69, 1);
}

.image-placeholder-large {
  width: 200px;
  height: 200px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-placeholder-large p {
  color: #999;
  margin: 0;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.gallery-item {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-remove-small {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}

.btn-remove-small:hover {
  background: rgba(220, 53, 69, 1);
}

.gallery-add {
  width: 150px;
  height: 150px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f9f9f9;
}

.gallery-add:hover {
  border-color: #667eea;
  background: #f0f0ff;
}

.gallery-add span {
  color: #667eea;
  font-weight: 600;
}

.search-location-input {
  display: flex;
  gap: 0.5rem;
}

.search-location-input input {
  flex: 1;
}

.btn-search {
  padding: 0.8rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.btn-search:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
