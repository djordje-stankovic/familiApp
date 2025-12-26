<template>
  <header class="app-header">
    <h1>Family Tree App</h1>
    <div class="header-content">
      <!-- Search -->
      <div class="search-container">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Pretraži profile..."
          class="search-input"
          @focus="showResults = true"
          @blur="handleBlur"
        />
        <div v-if="showResults && searchResults.length > 0" class="search-results-dropdown">
          <div 
            v-for="profile in searchResults" 
            :key="profile.id"
            class="search-result-item"
            @mousedown.prevent="selectProfile(profile)"
          >
            <div class="profile-avatar-small">{{ getInitials(profile) }}</div>
            <div class="profile-info-small">
              <h4>{{ profile.name || `${profile.firstName} ${profile.lastName}` }}</h4>
              <p v-if="profile.city || profile.country">{{ [profile.city, profile.country].filter(Boolean).join(', ') }}</p>
            </div>
          </div>
        </div>
        <div v-if="showResults && searchQuery && searchResults.length === 0" class="search-results-dropdown">
          <div class="no-results">Nema rezultata</div>
        </div>
      </div>
      
      <!-- User Actions -->
      <div class="header-actions">
        <span class="username">{{ authStore.user?.username }}</span>
        <button @click="handleLogout" class="btn-secondary">Odjavi se</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFamilyTreeStore } from '../stores/familyTree'

const router = useRouter()
const authStore = useAuthStore()
const { familyTree } = useFamilyTreeStore()

const searchQuery = ref('')
const showResults = ref(false)

const searchResults = computed(() => {
  if (!searchQuery.value || searchQuery.value.trim() === '') {
    return []
  }
  const query = searchQuery.value.toLowerCase().trim()
  return familyTree.getAllProfiles().filter(profile => {
    const name = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    const firstName = profile.firstName || ''
    const lastName = profile.lastName || ''
    const city = profile.city || ''
    const country = profile.country || ''
    
    return name.toLowerCase().includes(query) ||
           firstName.toLowerCase().includes(query) ||
           lastName.toLowerCase().includes(query) ||
           city.toLowerCase().includes(query) ||
           country.toLowerCase().includes(query)
  })
})

const getInitials = (profile) => {
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
  }
  const name = profile.name || ''
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.charAt(0).toUpperCase() || '?'
}

const selectProfile = (profile) => {
  searchQuery.value = ''
  showResults.value = false
  router.push(`/home?profileId=${profile.id}`)
}

const handleBlur = () => {
  // Delay hiding results to allow click events
  setTimeout(() => {
    showResults.value = false
  }, 200)
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

watch(() => router.currentRoute.value.query.profileId, (profileId) => {
  if (profileId) {
    // Profile will be selected in Home component
  }
})
</script>

<style scoped>
.app-header {
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1000;
}

.app-header h1 {
  color: #667eea;
  font-size: 1.5rem;
  margin: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex: 1;
  justify-content: flex-end;
}

.search-container {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.search-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1001;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.search-result-item:hover {
  background: #f5f5f5;
}

.profile-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: bold;
  flex-shrink: 0;
}

.profile-info-small {
  flex: 1;
  min-width: 0;
}

.profile-info-small h4 {
  color: #333;
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-info-small p {
  color: #666;
  font-size: 0.85rem;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-results {
  padding: 1rem;
  text-align: center;
  color: #999;
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.username {
  color: #666;
  font-weight: 600;
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
</style>

