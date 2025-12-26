<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Start Building Tree</h2>
        <button @click="close" class="close-btn">×</button>
      </div>
      
      <form @submit.prevent="saveProfile" class="profile-form">
        <div class="form-section">
          <h3>Osnovni Podaci</h3>
          
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
          <h3>Lokacija</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Država *</label>
              <input 
                type="text" 
                v-model="formData.country" 
                required
                placeholder="Unesi državu ili klikni na mapu..."
              />
            </div>
            
            <div class="form-group">
              <label>Grad *</label>
              <input 
                type="text" 
                v-model="formData.city" 
                required
                placeholder="Unesi grad ili klikni na mapu..."
              />
            </div>
          </div>
          
          <div class="map-container" ref="mapContainer"></div>
          <div v-if="formData.location" class="location-info">
            <p><strong>Izabrana lokacija:</strong> {{ formData.locationAddress || `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` }}</p>
          </div>
        </div>

        <div class="form-section">
          <h3>Biografija</h3>
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
          <h3>Profilna Slika</h3>
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
          <h3>Galerija Slika</h3>
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
          <button type="submit" class="btn-primary">Kreni sa Stablom</button>
          <button type="button" @click="close" class="btn-secondary">Otkaži</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useFamilyTreeStore } from '../stores/familyTree'

// Fix Leaflet default icon issue
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'saved'])

const { familyTree } = useFamilyTreeStore()
const mapContainer = ref(null)
const map = ref(null)
const marker = ref(null)
const galleryInput = ref(null)

const formData = ref({
  firstName: '',
  lastName: '',
  age: null,
  country: '',
  city: '',
  location: null,
  locationAddress: '',
  biography: '',
  profileImage: null,
  galleryImages: []
})

onMounted(() => {
  if (props.show) {
    nextTick(() => {
      initMap()
    })
  }
})

watch(() => props.show, (newVal) => {
  if (newVal) {
    nextTick(() => {
      initMap()
    })
  }
})

const initMap = () => {
  if (!mapContainer.value || map.value) return
  
  map.value = L.map(mapContainer.value).setView([44.7866, 20.4489], 6) // Serbia default
  
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
    
    // Reverse geocoding - popuni državu i grad
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (data.display_name) {
          formData.value.locationAddress = data.display_name
          formData.value.location.address = data.display_name
          
          if (data.address) {
            const address = data.address
            formData.value.country = address.country || ''
            formData.value.city = address.city || address.town || address.village || ''
            formData.value.location.country = address.country || ''
            formData.value.location.city = address.city || address.town || address.village || ''
          }
        }
      })
      .catch(err => console.error('Geocoding error:', err))
  })
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
  
  if (!formData.value.country || !formData.value.country.trim()) {
    alert('Država je obavezno polje!')
    return
  }
  
  if (!formData.value.city || !formData.value.city.trim()) {
    alert('Grad je obavezno polje!')
    return
  }
  
  const newProfile = familyTree.addProfile({
    firstName: formData.value.firstName.trim(),
    lastName: formData.value.lastName.trim(),
    age: formData.value.age || null,
    country: formData.value.country.trim(),
    city: formData.value.city.trim(),
    location: formData.value.location,
    biography: formData.value.biography || '',
    profileImage: formData.value.profileImage,
    galleryImages: formData.value.galleryImages,
    isUnlocked: true
  })
  
  if (newProfile) {
    emit('saved', newProfile)
    close()
  } else {
    alert('Greška pri dodavanju profila. Pokušaj ponovo.')
  }
}

const close = () => {
  // Reset form
  formData.value = {
    firstName: '',
    lastName: '',
    age: null,
    country: '',
    city: '',
    location: null,
    locationAddress: '',
    biography: '',
    profileImage: null,
    galleryImages: []
  }
  
  if (marker.value && map.value) {
    map.value.removeLayer(marker.value)
    marker.value = null
  }
  
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 2rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h2 {
  color: #667eea;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.profile-form {
  padding: 2rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h3 {
  color: #667eea;
  margin-bottom: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.map-container {
  width: 100%;
  height: 300px;
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

.section-description {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
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

.image-input {
  padding: 0.5rem;
  font-size: 0.9rem;
  max-width: 200px;
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: flex-end;
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

.btn-secondary {
  padding: 0.8rem 2rem;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #e0e0e0;
}
</style>

