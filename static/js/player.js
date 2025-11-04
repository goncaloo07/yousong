// Helper selectors
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

// Drag & Drop + upload
const drop = qs('#dropZone');
const fileInput = qs('#fileInput');
const uploadBtn = qs('#uploadBtn');
const uploadForm = qs('#uploadForm');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
uploadBtn.addEventListener('click', () => fileInput.click());
const MAX_MB = 50;

function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList).filter(f => (f.type.includes('audio') || f.name.toLowerCase().endsWith('.mp3')));
  if (files.length === 0) { alert('Envie apenas áudio (mp3).'); return; }

  // client-side size check per file
  const oversized = files.find(f => f.size > MAX_MB * 1024 * 1024);
  if (oversized) { alert(`Arquivo muito grande: ${oversized.name} (máx ${MAX_MB} MB)`); return; }

  const fd = new FormData();
  files.forEach(f => fd.append('file', f));

  // simple UI feedback
  uploadBtn.disabled = true; uploadBtn.textContent = `Enviando (${files.length})...`;

  fetch(window.location.pathname, { method: 'POST', body: fd }).then(r => {
    if (r.redirected) { window.location.href = r.url; }
    else window.location.reload();
  }).catch(err => { console.error(err); alert('Erro no upload'); })
    .finally(() => { uploadBtn.disabled = false; uploadBtn.textContent = 'Enviar'; });
}

// Player logic
const audio = new Audio();
audio.preload = 'metadata';
let currentPlayingFile = null;
let playlist = [];
let currentIndex = -1;
const playToggle = qs('#playToggle');
const prevBtn = qs('#prevBtn');
const nextBtn = qs('#nextBtn');
const seek = qs('#seek');
const volume = qs('#volume');
const timeLabel = qs('#time');
const titleEl = qs('#playerTitle');
const artistEl = qs('#playerArtist');
const thumbEl = qs('#playerThumb img');

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function setTrack({ src, title, artist, cover }, index = -1) {
  audio.src = src;
  titleEl.textContent = title || 'Sem título';
  artistEl.textContent = artist || 'Desconhecido';
  if (cover) thumbEl.src = cover;
  currentIndex = index;
  qs('#playerBar').setAttribute('aria-hidden', 'false');
  updatePlayerUI(); // Update UI when track is set
  playAudio();
}

function playAudio() { audio.play().then(() => playToggle.textContent = '❚❚').catch(() => playToggle.textContent = '►'); }
function pauseAudio() { audio.pause(); playToggle.textContent = '►'; }

function playNext() {
  if (playlist.length === 0) return;
  let nextIndex = currentIndex + 1;
  if (nextIndex >= playlist.length) {
    nextIndex = 0; // Loop back to start
  }
  const nextTrack = playlist[nextIndex];
  setTrack(nextTrack, nextIndex);
}

function playPrev() {
  if (playlist.length === 0) return;
  let prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    prevIndex = playlist.length - 1; // Loop to end
  }
  const prevTrack = playlist[prevIndex];
  setTrack(prevTrack, prevIndex);
}

playToggle.addEventListener('click', () => { if (audio.src) { if (audio.paused) playAudio(); else pauseAudio(); } });
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);

audio.addEventListener('loadedmetadata', () => { seek.max = Math.floor(audio.duration); updateTime(); });
audio.addEventListener('timeupdate', updateTime);
audio.addEventListener('ended', playNext); // Auto-play next track when current ends
function updateTime() { seek.value = Math.floor(audio.currentTime); timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`; }
seek.addEventListener('input', () => { audio.currentTime = seek.value; updateTime(); });
volume.addEventListener('input', () => { audio.volume = volume.value / 100; });

// Build playlist from all tracks
function buildPlaylist() {
  playlist = [];
  qsa('.btn-play').forEach((btn, index) => {
    const src = btn.dataset.src;
    const card = btn.closest('.card') || btn.closest('.track');
    const title = card?.querySelector('.title')?.textContent || card?.querySelector('.t')?.textContent || 'Sem título';
    const artist = card?.querySelector('.artist')?.textContent || card?.querySelector('.a')?.textContent || 'Desconhecido';
    const coverImg = card?.querySelector('img')?.getAttribute('src') || '/static/img/default_cover.png';
    playlist.push({ src, title, artist, cover: coverImg, file: btn.dataset.file || decodeURIComponent((src.split('/uploads/')[1] || '')) });
  });
}

qsa('.btn-play').forEach(btn => {
  btn.addEventListener('click', () => {
    buildPlaylist(); // Ensure playlist is up-to-date
    const src = btn.dataset.src;
    // track currently playing file name for edit updates
    try { currentPlayingFile = decodeURIComponent((src.split('/uploads/')[1] || '')); } catch (_) { currentPlayingFile = null; }
    const index = playlist.findIndex(track => track.src === src);
    const card = btn.closest('.card') || btn.closest('.track');
    const title = card?.querySelector('.title')?.textContent || card?.querySelector('.t')?.textContent || 'Sem título';
    const artist = card?.querySelector('.artist')?.textContent || card?.querySelector('.a')?.textContent || 'Desconhecido';
    const coverImg = card?.querySelector('img')?.getAttribute('src') || '/static/img/default_cover.png';
    setTrack({ src, title, artist, cover: coverImg }, index);
  });
});

window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.target.matches('input, textarea')) { e.preventDefault(); if (audio.paused) playAudio(); else pauseAudio(); } });

// Theme toggle with localStorage persistence
(function () {
  const key = 'ys-theme';
  const body = document.body;
  const btn = qs('#toggleTheme');
  const logoImg = qs('#logoImg');
  function apply(theme) {
    if (theme === 'light') {
      body.classList.add('theme-light');
      btn.innerHTML = '☀️';
      btn.title = 'Tema: Claro';
      if (logoImg) logoImg.src = '/static/img/logo1.png';
    } else {
      body.classList.remove('theme-light');
      btn.innerHTML = '🌙';
      btn.title = 'Tema: Escuro';
      if (logoImg) logoImg.src = '/static/img/logo1white.png';
    }
  }
  const saved = localStorage.getItem(key) || 'dark';
  apply(saved);
  btn.addEventListener('click', () => {
    // Add professional animation class
    btn.classList.add('animating');
    btn.style.background = 'linear-gradient(180deg, var(--accent), #2b6cb0)';
    const next = body.classList.contains('theme-light') ? 'dark' : 'light';
    localStorage.setItem(key, next);
    apply(next);
    // Reset button color and remove animation class after transition
    setTimeout(() => {
      btn.style.background = '';
      btn.classList.remove('animating');
    }, 300);
  });
})();

// Function to update player UI based on track availability
function updatePlayerUI() {
  const hasTrack = audio.src && audio.src !== '';
  const progressEl = qs('.progress');
  const volumeContainer = qs('#volume').parentElement;
  const buttons = [prevBtn, playToggle, nextBtn];

  if (hasTrack) {
    progressEl.style.display = 'flex';
    volumeContainer.style.display = 'flex';
    buttons.forEach(btn => btn.disabled = false);
  } else {
    progressEl.style.display = 'none';
    volumeContainer.style.display = 'none';
    buttons.forEach(btn => btn.disabled = true);
  }
}

// Initialize time display and volume
updateTime();
audio.volume = volume.value / 100;
updatePlayerUI(); // Initial UI update

// Expanded player functionality
const closePlayer = qs('#closePlayer');
const expandedPlayer = qs('#expandedPlayer');
const closeExpanded = qs('#closeExpanded');
const expandedThumb = qs('#expandedThumb');
const expandedTitle = qs('#expandedTitle');
const expandedArtist = qs('#expandedArtist');
const expandedPlayToggle = qs('#expandedPlayToggle');
const expandedPrev = qs('#expandedPrev');
const expandedNext = qs('#expandedNext');
const expandedVolume = qs('#expandedVolume');

// Click anywhere on player bar to expand (except buttons)
const playerBar = qs('#playerBar');
playerBar.addEventListener('click', (e) => {
  // Don't expand if clicking on buttons, inputs, or close button
  if (e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'INPUT' ||
      e.target === closePlayer) {
    return;
  }
  openExpandedPlayer();
});

closePlayer.addEventListener('click', (e) => {
  e.stopPropagation();
  closeExpandedPlayer();
});



// Edit metadata modal logic
const editModal = document.getElementById('editModal');
const metaFile = document.getElementById('metaFile');
const metaTitle = document.getElementById('metaTitle');
const metaArtist = document.getElementById('metaArtist');
const metaCover = document.getElementById('metaCover');
const removeCoverBtn = document.getElementById('removeCoverBtn');
const saveEdit = document.getElementById('saveEdit');
const cancelEdit = document.getElementById('cancelEdit');

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.btn-edit');
  if (!btn) return;
  ev.preventDefault();
  if (!editModal) return;
  const filename = btn.dataset.file;
  const card = btn.closest('.card') || btn.closest('.track');
  const title = card?.querySelector('.title')?.textContent || card?.querySelector('.t')?.textContent || '';
  const artist = card?.querySelector('.artist')?.textContent || card?.querySelector('.a')?.textContent || '';
  const coverImg = card?.querySelector('img')?.getAttribute('src') || '/static/img/default_cover.png';
  if (metaFile) metaFile.value = filename;
  if (metaTitle) metaTitle.value = title;
  if (metaArtist) metaArtist.value = artist;
  const currentCoverImg = document.getElementById('currentCoverImg');
  if (currentCoverImg) currentCoverImg.src = coverImg;
  // Reset remove cover button state
  removeCoverBtn.textContent = 'Remover Capa';
  removeCoverBtn.classList.remove('confirming');
  editModal.style.display = 'flex';
  if (metaTitle) metaTitle.focus();
});

cancelEdit.addEventListener('click', () => { editModal.style.display = 'none'; });
// close modal when clicking outside content
editModal.addEventListener('click', (e) => { if (e.target === editModal) { editModal.style.display = 'none'; } });
// close modal on Escape
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editModal.style.display === 'flex') { editModal.style.display = 'none'; } });

let removeCoverConfirmed = false;

removeCoverBtn.addEventListener('click', () => {
  if (!removeCoverBtn.classList.contains('confirming')) {
    removeCoverBtn.textContent = 'Tem certeza? Clique novamente para confirmar';
    removeCoverBtn.classList.add('confirming');
  } else {
    removeCoverConfirmed = true;
    removeCoverBtn.textContent = 'Remover Capa';
    removeCoverBtn.classList.remove('confirming');
  }
});

// Delete modal logic
const deleteModal = document.createElement('div');
deleteModal.id = 'deleteModal';
deleteModal.style.cssText = `
  display: none;
  position: fixed;
  inset: 0;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  background: rgba(0,0,0,0.5);
`;
deleteModal.innerHTML = `
  <div class="modal-content" style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
    <h3 style="margin: 0 0 16px; color: var(--text);">Confirmar Exclusão</h3>
    <p style="margin: 0 0 24px; color: var(--muted);">Tem certeza de que deseja excluir esta música? Esta ação não pode ser desfeita.</p>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="cancelDelete" class="small-btn" style="background: var(--muted-bg); color: var(--text);">Cancelar</button>
      <button id="confirmDelete" class="small-btn" style="background: #dc3545; color: white;">Excluir</button>
    </div>
  </div>
`;
document.body.appendChild(deleteModal);

let fileToDelete = null;

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.btn-delete');
  if (!btn) return;
  ev.preventDefault();
  fileToDelete = btn.dataset.file;
  // Adjust modal background for better visibility in dark mode
  const isLight = document.body.classList.contains('theme-light');
  deleteModal.style.background = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.8)';
  // Make modal content more visible in dark mode
  const modalContent = deleteModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.background = isLight ? 'var(--bg)' : 'rgba(255,255,255,0.15)';
    modalContent.style.border = isLight ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.3)';
  }
  deleteModal.style.display = 'flex';
});

document.getElementById('cancelDelete').addEventListener('click', () => {
  deleteModal.style.display = 'none';
  fileToDelete = null;
});

document.getElementById('confirmDelete').addEventListener('click', () => {
  if (!fileToDelete) return;
  fetch(`/delete/${encodeURIComponent(fileToDelete)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Remove the track from the DOM
      const trackElement = document.querySelector(`[data-file="${fileToDelete}"]`).closest('.track');
      if (trackElement) {
        trackElement.remove();
      }
      // If the deleted track was playing, stop it
      if (currentPlayingFile === fileToDelete) {
        audio.pause();
        audio.src = '';
        titleEl.textContent = 'Nenhuma música';
        artistEl.textContent = '—';
        thumbEl.src = '/static/img/default_cover.png';
        updatePlayerUI();
      }
      // Rebuild playlist after deletion
      buildPlaylist();
    } else {
      alert(data.message);
    }
    deleteModal.style.display = 'none';
    fileToDelete = null;
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Erro ao excluir a música.');
    deleteModal.style.display = 'none';
    fileToDelete = null;
  });
});

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.style.display = 'none';
    fileToDelete = null;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && deleteModal.style.display === 'flex') {
    deleteModal.style.display = 'none';
    fileToDelete = null;
  }
});

saveEdit.addEventListener('click', () => {
  const errEl = document.getElementById('editError');
  errEl.style.display = 'none'; errEl.textContent = '';
  const title = metaTitle.value.trim();
  const artist = metaArtist.value.trim();
  const coverFile = metaCover.files[0];
  if (!title && !artist && !coverFile && !removeCoverConfirmed) { errEl.textContent = 'Informe título, artista, imagem de capa ou clique em "Remover Capa" duas vezes.'; errEl.style.display = 'block'; return; }

  const payload = new FormData();
  payload.append('file', metaFile.value);
  if (title) payload.append('title', title);
  if (artist) payload.append('artist', artist);
  if (coverFile) payload.append('cover', coverFile);
  if (removeCoverConfirmed) payload.append('remove_cover', 'true');

  fetch('/edit_metadata', {
    method: 'POST',
    body: payload
  }).then(r => r.json()).then(res => {
    if (res.ok) {
      // update DOM entries matching file
      qsa(`[data-file='${metaFile.value}']`).forEach(el => {
        const card = el.closest('.card') || el.closest('.track');
        if (card) {
          const tEl = card.querySelector('.title') || card.querySelector('.t');
          const aEl = card.querySelector('.artist') || card.querySelector('.a');
          const imgEl = card.querySelector('img');
          if (tEl) tEl.textContent = res.title || title;
          if (aEl) aEl.textContent = res.artist || artist;
          if (imgEl && res.cover) imgEl.src = res.cover + '?t=' + Date.now();
        }
      });
      // also update player bar if the edited file is currently playing
      if (currentPlayingFile && currentPlayingFile === metaFile.value) {
        if (title) titleEl.textContent = title;
        if (artist) artistEl.textContent = artist;
        if (res.cover) thumbEl.src = res.cover + '?t=' + Date.now();
      }
      editModal.style.display = 'none';
      // reset form
      metaCover.value = '';
      removeCoverConfirmed = false;
    } else {
      errEl.textContent = res.error || 'Falha ao atualizar metadados.';
      errEl.style.display = 'block';
    }
  }).catch(err => { console.error(err); errEl.textContent = 'Erro ao salvar.'; errEl.style.display = 'block'; });
}); 

// Improved expanded player functionality
function toggleExpandedPlayer() {
  const expandedPlayer = qs('#expandedPlayer');
  if (expandedPlayer.style.display === 'flex') {
    closeExpandedPlayer();
  } else {
    openExpandedPlayer();
  }
}

function openExpandedPlayer() {
  const expandedPlayer = qs('#expandedPlayer');
  expandedPlayer.style.display = 'flex';

  // Sync all data with current track (or default if none)
  syncExpandedPlayer();

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeExpandedPlayer() {
  const expandedPlayer = qs('#expandedPlayer');
  expandedPlayer.style.display = 'none';
  
  // Restore body scroll
  document.body.style.overflow = '';
}

function syncExpandedPlayer() {
  if (!audio.src) {
    // If no track, show default
    expandedThumb.src = '/static/img/default_cover.png';
    expandedTitle.textContent = 'Nenhuma música';
    expandedArtist.textContent = '—';
    return;
  }

  // Sync basic track info
  expandedThumb.src = thumbEl.src;
  expandedTitle.textContent = titleEl.textContent;
  expandedArtist.textContent = artistEl.textContent;

  // Sync progress
  updateExpandedProgress();

  // Sync volume
  expandedVolume.value = volume.value;

  // Sync play state
  expandedPlayToggle.textContent = audio.paused ? '►' : '❚❚';
}

function updateExpandedProgress() {
  if (!audio.duration) return;
  
  const progressPercent = (audio.currentTime / audio.duration) * 100;
  const progressFill = qs('#expandedProgressFill');
  
  if (progressFill) {
    progressFill.style.width = `${progressPercent}%`;
  }
  
  // Update time display
  const currentTimeEl = qs('#expandedCurrentTime');
  const durationEl = qs('#expandedDuration');
  
  if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  if (durationEl) durationEl.textContent = formatTime(audio.duration);
}

// Click progress bar to seek
const expandedProgressBar = qs('#expandedProgressBar');
if (expandedProgressBar) {
  expandedProgressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;

    const rect = expandedProgressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
    updateExpandedProgress();
  });

  // Add drag functionality for expanded progress bar
  let isDragging = false;

  expandedProgressBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = expandedProgressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
    updateExpandedProgress();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !audio.duration) return;

    const rect = expandedProgressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = percent * audio.duration;
    updateExpandedProgress();
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// Update event listeners for expanded player
audio.addEventListener('timeupdate', () => {
  updateExpandedProgress();
  syncExpandedPlayer();
});

audio.addEventListener('loadedmetadata', () => {
  updateExpandedProgress();
  syncExpandedPlayer();
});

audio.addEventListener('play', () => {
  expandedPlayToggle.textContent = '❚❚';
  syncExpandedPlayer();
});

audio.addEventListener('pause', () => {
  expandedPlayToggle.textContent = '►';
  syncExpandedPlayer();
});

// Enhanced player bar click to expand
playerBar.addEventListener('click', (e) => {
  // Don't expand if clicking on buttons, inputs, or close button
  if (e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'INPUT' ||
      e.target === closePlayer) {
    return;
  }
  openExpandedPlayer();
});

// Close button for expanded player
closeExpanded.addEventListener('click', (e) => {
  e.stopPropagation();
  closeExpandedPlayer();
});

// Close expanded player when clicking on background
expandedPlayer.addEventListener('click', (e) => {
  if (e.target === expandedPlayer) {
    closeExpandedPlayer();
  }
});

// Keyboard controls for expanded player
window.addEventListener('keydown', (e) => {
  if (expandedPlayer.style.display === 'flex') {
    switch(e.key) {
      case 'Escape':
        closeExpandedPlayer();
        break;
      case ' ':
        e.preventDefault();
        if (audio.paused) playAudio();
        else pauseAudio();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        break;
    }
  }
});

// Enhanced controls for expanded player
expandedPlayToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audio.src) {
    if (audio.paused) playAudio();
    else pauseAudio();
  }
  syncExpandedPlayer();
});

expandedPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  playPrev();
  syncExpandedPlayer();
});

expandedNext.addEventListener('click', (e) => {
  e.stopPropagation();
  playNext();
  syncExpandedPlayer();
});

expandedVolume.addEventListener('input', (e) => {
  e.stopPropagation();
  audio.volume = expandedVolume.value / 100;
  volume.value = expandedVolume.value;
});

// Add hover effect to close button
closeExpanded.addEventListener('mouseenter', () => {
  closeExpanded.style.background = 'rgba(255,255,255,0.2)';
  closeExpanded.style.transform = 'scale(1.1)';
});

closeExpanded.addEventListener('mouseleave', () => {
  closeExpanded.style.background = 'rgba(255,255,255,0.1)';
  closeExpanded.style.transform = 'scale(1)';
});

// Enhanced track loading with visual feedback
function setTrack({ src, title, artist, cover }, index = -1) {
  // Add loading state
  const playerBar = qs('#playerBar');
  playerBar.style.opacity = '0.7';
  
  audio.src = src;
  titleEl.textContent = title || 'Sem título';
  artistEl.textContent = artist || 'Desconhecido';
  
  // Smooth cover image loading
  if (cover) {
    const img = new Image();
    img.onload = () => {
      thumbEl.src = cover;
      playerBar.style.opacity = '1';
    };
    img.onerror = () => {
      thumbEl.src = '/static/img/default_cover.png';
      playerBar.style.opacity = '1';
    };
    img.src = cover;
  } else {
    thumbEl.src = '/static/img/default_cover.png';
    playerBar.style.opacity = '1';
  }
  
  currentIndex = index;
  qs('#playerBar').setAttribute('aria-hidden', 'false');
  updatePlayerUI();
  
  // Auto-play with improved error handling
  playAudio().catch(err => {
    console.log('Auto-play prevented:', err);
    // Don't show error to user, just update UI
    playToggle.textContent = '►';
  });
}
