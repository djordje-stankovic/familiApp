import { ref, computed } from 'vue'

const user = ref(null)
const isAuthenticated = computed(() => user.value !== null)

export function useAuthStore() {
  const login = (username, password) => {
    // Za sada jednostavna simulacija - kasnije će biti pravi backend
    if (username && password) {
      user.value = {
        id: '1',
        username: username,
        email: `${username}@example.com`,
        createdAt: new Date().toISOString()
      }
      try {
        localStorage.setItem('user', JSON.stringify(user.value))
      } catch (error) {
        console.error('Error saving user to localStorage:', error)
      }
      return true
    }
    return false
  }

  const logout = () => {
    user.value = null
    localStorage.removeItem('user')
  }

  const init = () => {
    try {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        user.value = JSON.parse(savedUser)
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error)
    }
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    init
  }
}

