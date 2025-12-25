import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Login from './views/Login.vue'
import Home from './views/Home.vue'
import Tree2D from './views/Tree2D.vue'
import Tree3D from './views/Tree3D.vue'
import ProfileEdit from './views/ProfileEdit.vue'
import { useAuthStore } from './stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  { 
    path: '/home', 
    component: Home,
    meta: { requiresAuth: true }
  },
  { 
    path: '/tree-2d', 
    component: Tree2D,
    meta: { requiresAuth: true }
  },
  { 
    path: '/tree-3d', 
    component: Tree3D,
    meta: { requiresAuth: true }
  },
  { 
    path: '/profile/:id?', 
    component: ProfileEdit,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Inicijalizuj store-ove
const authStore = useAuthStore()
authStore.init()

// Navigation guard za autentifikaciju
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

const app = createApp(App)
app.use(router)
app.mount('#app')

