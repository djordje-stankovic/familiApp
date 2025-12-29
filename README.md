# 🌳 Family Tree App - Porodično Stablo

Kompleksna Vue.js aplikacija za građenje porodičnog stabla sa 2D i 3D prikazom, gamifikacijom i kolaborativnim merge-ovanjem.

## ✨ Karakteristike

### 🏠 Home Stranica
- **Pregled Progresa**: Statistike o profilima (ukupno, otključani, zaključani, sa slikama)
- **Brzi Pristup**: Linkovi ka svim glavnim funkcionalnostima
- **Nedavno Dodati Profili**: Pregled poslednjih dodanih profila

### 📊 2D Prikaz Stabla
- **Tabelarni Format**: Klasičan prikaz stabla kao tabela (kao SQL tabela)
- **Hijerarhijski Prikaz**: Proširivanje/skupljanje grana
- **Brza Navigacija**: Klik na profil za brzo uređivanje
- **Status Indikatori**: Vizuelni prikaz otključanih/zaključanih profila

### 🎮 3D Prikaz Stabla
- **Interaktivni 3D Prostor**: Rotacija, zoom, pan kroz 3D prostor
- **Kockice za Profile**: Svaki profil je 3D kockica
- **Različite Slike po Stranama**: Svaka strana kocke može imati svoju sliku
- **Vizuelne Veze**: Linije između povezanih profila

### ✏️ Uređivanje Profila
- **Dodavanje/Uređivanje**: Kompletan formular za profile
- **Upload Slika**: Dodavanje slika za svaku stranu kocke
- **Veze**: Definisanje veza između profila

### 🔐 Autentifikacija
- **Login Sistem**: Jednostavna autentifikacija (demo verzija)
- **Zaštićene Rute**: Samo prijavljeni korisnici mogu pristupiti

## 🚀 Pokretanje

### Instalacija

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Aplikacija će biti dostupna na `http://localhost:5173` (ili drugom portu koji Vite dodeli).

### Build za Production

```bash
npm run build
```

## 🎮 Kako koristiti

1. **Login**: Prijavi se sa bilo kojim korisničkim imenom i lozinkom (demo verzija)
2. **Home**: Pregledaj statistike i izaberi opciju
3. **2D Prikaz**: Pogledaj stablo u tabelarnom formatu, proširuj/skupljaj grane
4. **3D Prikaz**: Interaktivno istraživanje stabla u 3D prostoru
5. **Dodaj Profil**: Klikni na "Dodaj Profil" i popuni formu
6. **Uredi Profil**: Klikni na profil u 2D prikazu ili kockicu u 3D prikazu

## 🗺️ Konfiguracija Mape

Aplikacija podržava različite stilove mape za 3D prikaz:

### Opcije Stilova Mape

1. **OSM (OpenStreetMap)** - Standardni stil sa svim detaljima (putevi, gradovi, itd.)
   - Podrazumevano
   - Besplatan, bez API key-a

2. **MapTiler Basic** - Čistiji stil, manje detalja
   - Zahteva MapTiler API key
   - Free tier: 100,000 zahteva/mesec

3. **MapTiler Boundaries** - Custom stil sa samo granicama država i glavnim gradovima
   - Zahteva MapTiler API key i custom stil kreiran u MapTiler Studio
   - Najčišći prikaz, fokus na granice

4. **Static Boundaries** - Statička mapa sa granicama (bez zoom detalja)
   - Zahteva URL do statičke mape (npr. generisane na MapChart.net)

### Konfiguracija

Kreiraj `.env` fajl u root direktorijumu projekta:

```env
# MapTiler API Key (opciono)
# Registruj se na: https://www.maptiler.com/cloud/
VITE_MAPTILER_API_KEY=your_api_key_here

# Stil mape: 'osm', 'basic', 'boundaries', 'static-boundaries'
VITE_MAP_TILE_STYLE=osm

# URL do statičke mape sa granicama (samo za 'static-boundaries' stil)
VITE_STATIC_BOUNDARIES_MAP_URL=https://example.com/path/to/boundaries-map.png
```

### Kako dobiti MapTiler API Key

1. Registruj se na [MapTiler Cloud](https://www.maptiler.com/cloud/)
2. Kreiraj novi projekat
3. Kopiraj API key iz dashboard-a
4. Dodaj ga u `.env` fajl

### Kreiranje Custom Stila sa Samo Granicama (MapTiler Studio)

1. Otvori [MapTiler Studio](https://studio.maptiler.com/)
2. Kreiraj novi stil baziran na OSM podacima
3. Ukloni sve layere osim:
   - `boundaries` (granice država - admin_level=2)
   - `places` (glavni gradovi)
4. Sakrij puteve, landuse, i ostale detalje
5. Sačuvaj stil i kopiraj Style ID
6. Koristi Style ID u kodu (zahteva dodatnu implementaciju)

## 🛠️ Tehnologije

- **Vue.js 3**: Frontend framework
- **Vue Router**: Routing i navigacija
- **Three.js**: 3D rendering i vizualizacija
- **Vite**: Build tool i development server
- **LocalStorage**: Čuvanje podataka lokalno (bez backend-a)
- **OpenStreetMap**: Besplatni tile servis za mape
- **MapTiler**: Premium tile servis sa custom stilovima (opciono)

## 📁 Struktura Projekta

```
src/
├── components/
│   └── Tree3DRenderer.js    # 3D rendering logika
├── stores/
│   ├── auth.js              # Autentifikacija store
│   └── familyTree.js        # Family tree store
├── views/
│   ├── Login.vue            # Login stranica
│   ├── Home.vue             # Home stranica
│   ├── Tree2D.vue           # 2D prikaz stabla
│   ├── Tree3D.vue           # 3D prikaz stabla
│   └── ProfileEdit.vue      # Uređivanje profila
├── App.vue                  # Glavna komponenta
└── main.js                  # Entry point
```

## 📋 Planirane Funkcionalnosti

- [x] Vue.js struktura sa routing-om
- [x] Login sistem
- [x] Home stranica sa progresom
- [x] 2D prikaz stabla (tabela)
- [x] 3D prikaz stabla
- [x] Upload slika po stranama kocke
- [ ] Sistem odključavanja grana (unlock mehanika)
- [ ] Merge sa tuđim stablima
- [ ] Privatnost/public delovi
- [ ] Uspomene i priče
- [ ] Backend integracija
- [ ] Mobile app verzija
- [ ] VR podrška

## 📝 Napomene

- Podaci se čuvaju u LocalStorage (bez backend-a za sada)
- Login sistem je demo verzija - prihvata bilo koje podatke
- Slike se čuvaju kao base64 stringovi u LocalStorage

## 🤝 Kontribucije

Ideje i predlozi su dobrodošli! Ovo je projekat u razvoju.
