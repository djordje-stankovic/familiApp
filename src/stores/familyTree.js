import { ref } from 'vue'

class FamilyTree {
  constructor() {
    this.profiles = new Map()
    this.rootProfileId = null

    this.loadFromLocalStorage()

    // Ako nema podataka – kreiraj test porodicu sa Markom kao root-om
    if (this.profiles.size === 0) {
      this.createTestFamily()
    }
  }

  addProfile(profileData) {
    const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const name = profileData.name || `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim()

    const profile = {
      id,
      name: name.trim(),
      firstName: (profileData.firstName || name.split(' ')[0] || '').trim(),
      lastName: (profileData.lastName || (name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : '')).trim(),
      age: profileData.age || null,
      gender: profileData.gender || 'male',
      city: profileData.city || '',
      country: profileData.country || '',
      profileImage: profileData.profileImage || null,
      parentId: profileData.parentId || null,
      spouseId: profileData.spouseId || null,
      location: profileData.location || null,
      createdAt: new Date().toISOString()
    }

    this.profiles.set(id, profile)
    this.saveToLocalStorage()
    return profile
  }

  createTestFamily() {
    // 1. Deda i baka
    const deda = this.addProfile({
      name: 'Petar Marković',
      age: 72,
      gender: 'male',
      city: 'Beograd',
      country: 'Srbija',
      location: { lat: 44.7866, lng: 20.4489 }
    })

    const baka = this.addProfile({
      name: 'Milena Marković',
      age: 70,
      gender: 'female',
      city: 'Beograd',
      country: 'Srbija',
      location: { lat: 44.7866, lng: 20.4489 }
    })

    // Veza deda ↔ baka
    this.updateProfile(deda.id, { spouseId: baka.id })
    this.updateProfile(baka.id, { spouseId: deda.id })

    // 2. Deca dede: Marko, Jelena, Dragan
    const otacMarko = this.addProfile({
      name: 'Marko Marković',
      age: 45,
      gender: 'male',
      city: 'Beograd',
      country: 'Srbija',
      parentId: deda.id,
      location: { lat: 44.7866, lng: 20.4489 }
    })

    const tetkaJelena = this.addProfile({
      name: 'Jelena Petrović',
      age: 43,
      gender: 'female',
      city: 'Novi Sad',
      country: 'Srbija',
      parentId: deda.id,
      location: { lat: 45.2396, lng: 19.8227 }
    })

    const stricDragan = this.addProfile({
      name: 'Dragan Marković',
      age: 48,
      gender: 'male',
      city: 'Niš',
      country: 'Srbija',
      parentId: deda.id,
      location: { lat: 43.3209, lng: 21.9036 }
    })

    // 3. Supruge/supružnici
    const majkaAna = this.addProfile({
      name: 'Ana Marković',
      age: 42,
      gender: 'female',
      city: 'Beograd',
      country: 'Srbija',
      location: { lat: 44.7866, lng: 20.4489 }
    })

    const strinaSanja = this.addProfile({
      name: 'Sanja Marković',
      age: 46,
      gender: 'female',
      city: 'Niš',
      country: 'Srbija',
      location: { lat: 43.3209, lng: 21.9036 }
    })

    // Veze supružnika
    this.updateProfile(otacMarko.id, { spouseId: majkaAna.id })
    this.updateProfile(majkaAna.id, { spouseId: otacMarko.id })

    this.updateProfile(stricDragan.id, { spouseId: strinaSanja.id })
    this.updateProfile(strinaSanja.id, { spouseId: stricDragan.id })

    // 4. Deca
    this.addProfile({
      name: 'Luka Marković',
      age: 16,
      gender: 'male',
      city: 'Beograd',
      country: 'Srbija',
      parentId: otacMarko.id,
      location: { lat: 44.7866, lng: 20.4489 }
    })

    this.addProfile({
      name: 'Sara Marković',
      age: 12,
      gender: 'female',
      city: 'Beograd',
      country: 'Srbija',
      parentId: otacMarko.id,
      location: { lat: 44.7866, lng: 20.4489 }
    })

    this.addProfile({
      name: 'Nikola Petrović',
      age: 10,
      gender: 'male',
      city: 'Novi Sad',
      country: 'Srbija',
      parentId: tetkaJelena.id,
      location: { lat: 45.2396, lng: 19.8227 }
    })

    this.addProfile({
      name: 'Stefan Marković',
      age: 14,
      gender: 'male',
      city: 'Niš',
      country: 'Srbija',
      parentId: stricDragan.id,
      location: { lat: 43.3209, lng: 21.9036 }
    })

    // *** KLJUČNO: MARKO JE ROOT (centralni član) ***
    this.rootProfileId = otacMarko.id

    console.log('✅ Test porodično stablo uspešno kreirano! Root je Marko:', otacMarko.id)
  }

  updateProfile(id, updates) {
    const profile = this.profiles.get(id)
    if (profile) {
      Object.assign(profile, updates)
      this.saveToLocalStorage()
    }
  }

  getProfile(id) {
    return this.profiles.get(id)
  }

  getAllProfiles() {
    return Array.from(this.profiles.values())
  }

  updateProfilePosition(id, x, y) {
    const profile = this.profiles.get(id)
    if (profile) {
      profile.positionX = x
      profile.positionY = y
      this.saveToLocalStorage()
    }
  }

  getProfilePosition(id) {
    const profile = this.profiles.get(id)
    if (profile && profile.positionX !== undefined && profile.positionY !== undefined) {
      return { x: profile.positionX, y: profile.positionY }
    }
    return null
  }

  deleteProfile(id) {
    if (this.profiles.size <= 1) return false

    const profile = this.profiles.get(id)
    if (!profile) return false

    // Obriši veze kod ostalih
    this.getAllProfiles().forEach(p => {
      if (p.parentId === id) p.parentId = null
      if (p.spouseId === id) p.spouseId = null
    })

    this.profiles.delete(id)

    // Ako je obrisan root, postavi novi
    if (id === this.rootProfileId && this.profiles.size > 0) {
      this.rootProfileId = this.getAllProfiles()[0].id
    }

    this.saveToLocalStorage()
    return true
  }

  saveToLocalStorage() {
    try {
      const data = {
        profiles: Array.from(this.profiles.entries()),
        rootProfileId: this.rootProfileId
      }
      localStorage.setItem('familyTreeData', JSON.stringify(data))
    } catch (e) {
      console.error('Greška pri čuvanju u localStorage:', e)
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('familyTreeData')
      if (saved) {
        const data = JSON.parse(saved)
        this.profiles = new Map(data.profiles || [])
        this.rootProfileId = data.rootProfileId || null
        console.log('✅ Podaci učitani iz localStorage-a. Root:', this.rootProfileId)
      }
    } catch (e) {
      console.error('Greška pri učitavanju iz localStorage-a:', e)
    }
  }
}

const familyTree = new FamilyTree()

export function useFamilyTreeStore() {
  return { familyTree }
}