<template>
  <div class="home-container">
    <header class="app-header">
      <h1>Family Tree App</h1>
      <div class="header-actions">
        <span class="username">{{ authStore.user?.username }}</span>
        <button @click="handleLogout" class="btn-secondary">Odjavi se</button>
      </div>
    </header>

    <div class="home-content">
      <div class="welcome-section">
        <h2>Dobrodošao, {{ authStore.user?.username }}!</h2>
        <p>Nastavi da gradiš svoje porodično stablo</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👤</div>
          <div class="stat-info">
            <h3>{{ totalProfiles }}</h3>
            <p>Ukupno Profila</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">✓</div>
          <div class="stat-info">
            <h3>{{ unlockedProfiles }}</h3>
            <p>Otključanih</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">✗</div>
          <div class="stat-info">
            <h3>{{ lockedProfiles }}</h3>
            <p>Zaključanih</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📷</div>
          <div class="stat-info">
            <h3>{{ profilesWithImages }}</h3>
            <p>Sa Slikama</p>
          </div>
        </div>
      </div>

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
        
        <router-link to="/profile" class="action-card">
          <div class="action-icon">+</div>
          <h3>Dodaj Profil</h3>
          <p>Dodaj novog člana porodice</p>
        </router-link>
      </div>

      <div class="recent-profiles" v-if="recentProfiles.length > 0">
        <h3>Nedavno Dodati Profili</h3>
        <div class="profiles-list">
          <div 
            v-for="profile in recentProfiles" 
            :key="profile.id"
            class="profile-item"
            @click="goToProfile(profile.id)"
          >
            <div class="profile-avatar">{{ profile.name.charAt(0) }}</div>
            <div class="profile-info">
              <h4>{{ profile.name }}</h4>
              <p>{{ profile.relation || 'Glavni profil' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFamilyTreeStore } from '../stores/familyTree'

const router = useRouter()
const authStore = useAuthStore()
const { familyTree } = useFamilyTreeStore()

const totalProfiles = computed(() => familyTree.getAllProfiles().length)
const unlockedProfiles = computed(() => 
  familyTree.getAllProfiles().filter(p => p.isUnlocked).length
)
const lockedProfiles = computed(() => 
  familyTree.getAllProfiles().filter(p => !p.isUnlocked).length
)
const profilesWithImages = computed(() => 
  familyTree.getAllProfiles().filter(p => 
    p.images && p.images.some(img => img !== null)
  ).length
)

const recentProfiles = computed(() => {
  return familyTree.getAllProfiles()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const goToProfile = (id) => {
  router.push(`/profile/${id}`)
}

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
  }
})
</script>

<style scoped>
.home-container {
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

.home-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.welcome-section {
  text-align: center;
  margin-bottom: 3rem;
}

.welcome-section h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.welcome-section p {
  color: #666;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-info h3 {
  font-size: 2rem;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.stat-info p {
  color: #666;
  font-size: 0.9rem;
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

.recent-profiles {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recent-profiles h3 {
  margin-bottom: 1.5rem;
  color: #333;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.profile-item:hover {
  background: #f5f5f5;
}

.profile-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
}

.profile-info h4 {
  color: #333;
  margin-bottom: 0.25rem;
}

.profile-info p {
  color: #666;
  font-size: 0.9rem;
}
</style>

