<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Family Tree App</h1>
      <p class="subtitle">Prijavi se da nastaviš građenje svog porodičnog stabla</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Korisničko ime:</label>
          <input 
            type="text" 
            v-model="username" 
            required 
            placeholder="Unesi korisničko ime"
          />
        </div>
        
        <div class="form-group">
          <label>Lozinka:</label>
          <input 
            type="password" 
            v-model="password" 
            required 
            placeholder="Unesi lozinku"
          />
        </div>
        
        <button type="submit" class="btn-primary">Prijavi se</button>
      </form>
      
      <p class="demo-note">Demo: Unesi bilo koje korisničko ime i lozinku</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const username = ref('')
const password = ref('')

authStore.init()

const handleLogin = () => {
  if (authStore.login(username.value, password.value)) {
    router.push('/home')
  } else {
    alert('Neispravni podaci')
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

.login-card h1 {
  text-align: center;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
}

.form-group input {
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-primary {
  padding: 0.8rem;
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

.demo-note {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: #999;
  font-style: italic;
}
</style>

