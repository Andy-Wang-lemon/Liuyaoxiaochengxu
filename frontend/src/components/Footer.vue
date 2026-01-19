<template>
  <footer>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
      <div class="social-icons">
        <a href="#" class="social-icon" title="Twitter">🐦</a>
        <a href="#" class="social-icon" title="Instagram">📷</a>
        <a href="#" class="social-icon" title="YouTube">▶</a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
// Footer component
</script>

<style scoped>
footer {
  background: #1a1f3a;
  padding: 30px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  position: relative;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
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

.footer-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.footer-links a {
  color: #d4af37;
  text-decoration: none;
  font-size: 14px;
  transition: opacity 0.3s;
}

.footer-links a:hover {
  opacity: 0.7;
}

.social-icons {
  display: flex;
  gap: 15px;
}

.social-icon {
  width: 32px;
  height: 32px;
  background: #d4af37;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a1f3a;
  text-decoration: none;
  font-size: 16px;
  transition: all 0.3s;
}

.social-icon:hover {
  background: #f4d03f;
  transform: scale(1.1);
}

@media (max-width: 768px) {
  footer {
    flex-direction: column;
    gap: 15px;
    text-align: center;
    padding: 15px 20px;
  }
  
  .footer-links {
    flex-direction: column;
    gap: 15px;
  }
}
</style>


