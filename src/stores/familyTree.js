import { ref } from 'vue'

class FamilyTree {
  constructor() {
    this.profiles = new Map()
    this.relationships = new Map()
    this.rootProfileId = null
  }

  addProfile(profileData) {
    // Validacija - ime ili firstName+lastName su obavezni
    const hasName = profileData.name && profileData.name.trim() !== ''
    const hasFirstLastName = profileData.firstName && profileData.firstName.trim() !== '' && 
                            profileData.lastName && profileData.lastName.trim() !== ''
    
    if (!profileData || (!hasName && !hasFirstLastName)) {
      console.error('Ime profila je obavezno')
      return null
    }
    
    const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Normalizuj parentId - prazan string ili undefined postaje null
    const parentId = profileData.parentId && profileData.parentId !== '' 
      ? profileData.parentId 
      : null
    
    // Generiši name ako nije prosleđen (za kompatibilnost)
    const name = profileData.name || 
                 (profileData.firstName && profileData.lastName 
                   ? `${profileData.firstName.trim()} ${profileData.lastName.trim()}` 
                   : profileData.firstName || profileData.lastName || '')
    
    const profile = {
      id,
      name: name.trim(),
      firstName: profileData.firstName ? profileData.firstName.trim() : (profileData.name ? profileData.name.split(' ')[0] : ''),
      lastName: profileData.lastName ? profileData.lastName.trim() : (profileData.name && profileData.name.split(' ').length > 1 ? profileData.name.split(' ').slice(1).join(' ') : ''),
      age: profileData.age || null,
      description: profileData.description || '',
      biography: profileData.biography || '',
      country: profileData.country || '',
      city: profileData.city || '',
      location: profileData.location || null, // { lat, lng, address, country, city }
      profileImage: profileData.profileImage || null,
      galleryImages: profileData.galleryImages || [],
      relation: profileData.relation || null,
      parentId: parentId,
      spouseId: profileData.spouseId || null,
      isDummy: profileData.isDummy || false,
      isUnlocked: profileData.isUnlocked !== undefined ? profileData.isUnlocked : true,
      images: profileData.images || [null, null, null, null, null, null],
      createdAt: new Date().toISOString()
    }
    
    this.profiles.set(id, profile)
    this.relationships.set(id, [])
    
    if (!this.rootProfileId) {
      this.rootProfileId = id
    }
    
    if (profile.parentId && this.profiles.has(profile.parentId)) {
      this.profiles.get(profile.parentId).children = this.profiles.get(profile.parentId).children || []
      this.profiles.get(profile.parentId).children.push(id)
    }
    
    this.saveToLocalStorage()
    console.log('Profil dodat:', profile)
    return profile
  }

  getProfile(id) {
    return this.profiles.get(id)
  }

  getAllProfiles() {
    return Array.from(this.profiles.values())
  }

  getChildren(profileId) {
    const profile = this.profiles.get(profileId)
    if (!profile) return []
    return this.getAllProfiles().filter(p => p.parentId === profileId)
  }

  updateProfile(profileId, updates) {
    const profile = this.profiles.get(profileId)
    if (profile) {
      Object.assign(profile, updates)
      this.saveToLocalStorage()
      return profile
    }
    return null
  }

  updateProfileImage(profileId, sideIndex, imageData) {
    const profile = this.profiles.get(profileId)
    if (profile) {
      if (!profile.images) {
        profile.images = [null, null, null, null, null, null]
      }
      profile.images[sideIndex] = imageData
      this.saveToLocalStorage()
      return profile
    }
    return null
  }

  updateProfilePosition(profileId, x, y, z = null) {
    const profile = this.profiles.get(profileId)
    if (profile) {
      profile.positionX = x
      profile.positionY = y
      if (z !== null) {
        profile.positionZ = z
      }
      this.saveToLocalStorage()
      return profile
    }
    return null
  }

  getProfilePosition(profileId) {
    const profile = this.profiles.get(profileId)
    if (profile && profile.positionX !== undefined && profile.positionY !== undefined) {
      return { 
        x: profile.positionX, 
        y: profile.positionY,
        z: profile.positionZ !== undefined ? profile.positionZ : 0
      }
    }
    return null
  }

  deleteProfile(profileId) {
    const profile = this.profiles.get(profileId)
    if (!profile) return false

    // Ne dozvoli brisanje root profila ako je jedini profil
    if (profileId === this.rootProfileId && this.profiles.size === 1) {
      console.warn('Ne može se obrisati poslednji profil')
      return false
    }

    // Obriši veze sa decom - postavi im parentId na null
    const children = this.getChildren(profileId)
    children.forEach(child => {
      child.parentId = null
    })

    // Obriši profil
    this.profiles.delete(profileId)
    this.relationships.delete(profileId)

    // Ako je bio root profil, postavi novi root
    if (profileId === this.rootProfileId && this.profiles.size > 0) {
      this.rootProfileId = Array.from(this.profiles.keys())[0]
    }

    this.saveToLocalStorage()
    console.log('Profil obrisan:', profileId)
    return true
  }

  saveToLocalStorage() {
    try {
      const data = {
        profiles: Array.from(this.profiles.entries()),
        rootProfileId: this.rootProfileId
      }
      localStorage.setItem('familyTree', JSON.stringify(data))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('familyTree')
      if (data) {
        const parsed = JSON.parse(data)
        this.profiles = new Map(parsed.profiles)
        this.rootProfileId = parsed.rootProfileId
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
    }
  }
}

const familyTree = new FamilyTree()
familyTree.loadFromLocalStorage()

export function useFamilyTreeStore() {
  return {
    familyTree
  }
}

