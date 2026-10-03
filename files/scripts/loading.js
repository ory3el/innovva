// ── STYLES INJECTOR ──
function injectModalStyles() {
  if (document.getElementById('modal-loading-styles')) return;

  const style = document.createElement('style');
  style.id = 'modal-loading-styles';
  style.textContent = `
.loading-modal-container {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 25000;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.loading-modal-container.active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.loading-modal-content {
  background: var(--sidebar-bg);
  /*backdrop-filter: blur(18px);*/
  /*-webkit-backdrop-filter: blur(18px);*/
  width: min(90%, 380px);
  padding: 30px 28px;
  border-radius: 36px;
  text-align: center;
  box-shadow: var(--box-shdw);
  transform: scale(0.82);
  transition: transform .35s cubic-bezier(.22,1,.36,1);}
  
.loading-modal-container.active
.loading-modal-content {transform: scale(1);}

.loading-modal-spinner {
  width: 44px;
  height: 44px;
  margin: 0 auto 18px;
  border-radius: 50%;
  border: 4px solid var(--black);
  border-top-color: #2563EB;
  animation: loadingSpin .8s linear infinite;
}

.loading-modal-title {
  margin: 0;
  font-family: 'Sora', 'Poppins', sans-serif;
  color: var(--text);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.3;
}

.loading-modal-message {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}
@keyframes loadingSpin {to {transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce) {
  .loading-modal-content {transition: none;}
  .loading-modal-spinner {animation: none;}
  }
  `;
  document.head.appendChild(style);
}

// ── LOADING MODAL ──
function showLoadingModal(title, message) {
  injectModalStyles();
  
  let modal = document.getElementById('loadingModal');
  if (!modal) {modal = document.createElement('div');
    modal.id = 'loadingModal';
    modal.className = 'loading-modal-container';
    modal.innerHTML = `<div class="loading-modal-content">
        <div class="loading-modal-spinner" aria-hidden="true"></div>
        <h3 class="loading-modal-title" id="loadingModalTitle">
          ${title}
        </h3>
        <p class="loading-modal-message" id="loadingModalMessage">
          ${message}
        </p>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    document.getElementById('loadingModalTitle').textContent = title;
    document.getElementById('loadingModalMessage').textContent = message;}

  modal.offsetHeight;
  modal.classList.add('active');
  document.body.classList.add('nobodyscroll');
}

// ============================================================
function hideLoadingModal() {
  const modal = document.getElementById('loadingModal');
  if (!modal) {return;}
  modal.classList.remove('active');
  document.body.classList.remove('nobodyscroll');
}
