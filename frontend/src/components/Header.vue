<template>
  <header>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <nav>
      <a href="#">Free Reading</a>
      <a href="#">My Journal</a>
      <a href="#">About Us</a>
      <router-link to="/admin" style="color:#f4d03f;font-weight:bold;">Admin</router-link>
    </nav>
  </header>
</template>

<script setup lang="ts">
// Header component
</script>

<style scoped>
header {
  background: #1a1f3a;
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  position: relative;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logo {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: #1a1f3a;
  font-weight: bold;
  border: 2px solid #d4af37;
}

.logo-text h1 {
  color: #d4af37;
  font-size: 24px;
  font-weight: normal;
  margin: 0;
}

.logo-text p {
  color: #d4af37;
  font-size: 14px;
  margin: 0;
  opacity: 0.9;
}

nav {
  display: flex;
  gap: 30px;
}

nav a {
  color: #d4af37;
  text-decoration: none;
  font-size: 16px;
  transition: opacity 0.3s;
}

nav a:hover {
  opacity: 0.7;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
    padding: 15px 20px;
  }
  
  .logo {
    width: 50px;
    height: 50px;
    font-size: 24px;
  }
  
  .logo-text h1 {
    font-size: 20px;
  }
  
  nav {
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
  }
}
</style>


