// Определение устройства
function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua) || window.innerWidth <= 900;
  document.body.classList.remove('mobile', 'desktop');
  document.body.classList.add(isMobile ? 'mobile' : 'desktop');
  return isMobile ? 'mobile' : 'desktop';
}

// Debounce для оптимизации события resize
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

window.addEventListener('load', detectDevice);
window.addEventListener('resize', debounce(detectDevice, 200));

const POLLINATIONS_FOOTER = /Powered by Pollinations\.AI.*?\(https:\/\/pollinations\.ai\/redirect\/kofi\).*?\./i;

function formatMessage(text, role) {
  if (text.startsWith("### ")) {
    text = text.slice(4).toUpperCase();
  }
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code>${code}</code></pre>`;
  });
  if (role === 'bot') {
    text = text.replace(/([^]+)\s*([^)]+)/g,
      '<a href="$2" style="color: #1E88E5;" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  return text;
}

const chatEl = document.getElementById('chat');
const form = document.getElementById('messageForm');
const input = document.getElementById('messageInput');
const micButton = document.getElementById('micButton');
const emojiButton = document.getElementById('emojiButton');
const fileButton = document.getElementById('fileButton');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const STORAGE_KEY = 'pepegin_chat_history';
const CACHE_KEY = 'pepegin_api_cache';
let conversationHistory = [];
let apiCache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};

let db;
const request = indexedDB.open('PepeginChatDB', 1);
request.onupgradeneeded = (event) => {
  db = event.target.result;
  db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
};
request.onsuccess = (event) => {
  db = event.target.result;
};
request.onerror = (event) => {
  console.error('Ошибка IndexedDB:', event.target.errorCode);
};

async function saveMediaToDB(blob) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['media'], 'readwrite');
    const store = transaction.objectStore('media');
    const request = store.add({ blob });
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getMediaFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['media'], 'readonly');
    const store = transaction.objectStore('media');
    const request = store.get(id);
    request.onsuccess = (event) => resolve(event.target.result?.blob);
    request.onerror = (event) => reject(event.target.error);
  });
}

const userAvatar = `<svg width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="18" fill="#FFFFFF"/>
  <text x="50%" y="50%" fill="#212121" font-size="18" text-anchor="middle" dy=".3em">Я</text>
</svg>`;
const botAvatar = `<img src="ava.png" alt="Pepegin GPT Avatar" width="36" height="36" style="border-radius: 50%;" onerror="this.src='https://via.placeholder.com/36'">`;

function saveChat() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
}

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(apiCache));
}

async function loadChat() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      conversationHistory = JSON.parse(saved);
      chatEl.innerHTML = '';
      const fragment = document.createDocumentFragment();
      for (const msg of conversationHistory.slice(-20)) {
        if (msg.isImage || msg.isAudio) {
          const blob = await getMediaFromDB(msg.mediaId);
          if (blob) {
            const url = URL.createObjectURL(blob);
            addMessage(url, msg.role, msg.isImage, false, msg.isAudio);
          } else {
            addMessage('Медиа не найдено', msg.role, false, false);
          }
        } else {
          addMessage(msg.text, msg.role, false, false);
        }
      }
      chatEl.appendChild(fragment);
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
      lazyLoadMedia();
    } else {
      const welcomeText = `
<h2>Привет! Я Pepegin GPT 🙌</h2>
<p>Я продвинутая нейросеть с мощной обработкой промптов:</p>
<ul>
<li>Отвечаю на сложные вопросы с анализом.</li>
<li>Генерирую фото с параметрами (напиши "сгенерируй фото кота реалистичное 512x512").</li>
<li>Создаю аудио с разными голосами (напиши "гс тест голосом alloy").</li>
<li>Обрабатываю файлы (изображения, аудио, PDF).</li>
<li>Пишу код и выполняю многоэтапные задачи (напиши "напиши рассказ, затем сгенерируй его иллюстрацию").</li>
</ul>
<p>Меня создал <a href="https://t.me/Pepegin_xd" target="_blank" rel="noopener noreferrer">tg: @Pepegin_xd</a>.</p>
`;
      const welcomeEl = addMessage(welcomeText, 'bot', false, true);
      welcomeEl.classList.add('welcome-message');
    }
  } catch (e) {
    console.error('Ошибка загрузки чата:', e);
    const welcomeText = `
<h2>Привет! Я Pepegin GPT 🙌</h2>
<p>Я продвинутая нейросеть с мощной обработкой промптов:</p>
<ul>
<li>Отвечаю на сложные вопросы с анализом.</li>
<li>Генерирую фото с параметрами (напиши "сгенерируй фото кота реалистичное 512x512").</li>
<li>Создаю аудио с разными голосами (напиши "гс тест голосом alloy").</li>
<li>Обрабатываю файлы (изображения, аудио, PDF).</li>
<li>Пишу код и выполняю многоэтапные задачи (напиши "напиши рассказ, затем сгенерируй его иллюстрацию").</li>
</ul>
<p>Меня создал <a href="https://t.me/Pepegin_xd" target="_blank" rel="noopener noreferrer">tg: @Pepegin_xd</a>.</p>
`;
    const welcomeEl = addMessage(welcomeText, 'bot', false, true);
    welcomeEl.classList.add('welcome-message');
  }
}

function lazyLoadMedia() {
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target.querySelector('img[data-src]');
        if (img) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(entry.target);
        }
      }
    });
  }, { rootMargin: '0px 0px 100px 0px' });

  document.querySelectorAll('.message-container').forEach(container => {
    if (container.querySelector('img[data-src]')) {
      observer.observe(container);
    }
  });
}

const promptPatterns = [
  {
    type: 'image',
    regex: /^сгенерируй\s+фото\s+(.+?)(?:\s+(реалистичное|cartoon|аниме|абстрактное))?(?:\s+(\d+x\d+))?(?:\s+без\s+(.+))?$/i,
    extract: (match) => ({
      prompt: match[1],
      style: match[2] || 'default',
      resolution: match[3] || '512x512',
      negative: match[4] || ''
    })
  },
  {
    type: 'audio',
    regex: /^(?:гс|gs)\s+(.+?)(?:\s+голосом\s+(\w+))?(?:\s+(громко|тихо))?$/i,
    extract: (match) => ({
      text: match[1],
      voice: match[2] || 'nova',
      volume: match[3] || 'normal'
    })
  },
  {
    type: 'code',
    regex: /^(?:напиши\s+код|код\s+на)\s+(\w+)(?:\s+для\s+(.+))?$/i,
    extract: (match) => ({
      language: match[1],
      task: match[2] || 'unspecified'
    })
  },
  {
    type: 'analysis',
    regex: /(?:анализируй|сравни|объясни|реши)\s+(.+)/i,
    extract: (match) => ({ query: match[1] })
  },
  {
    type: 'creative',
    regex: /(?:напиши\s+(рассказ|стих|сценарий)|создай\s+(.+))/i,
    extract: (match) => ({ task: match[1] || match[2] })
  }
];

function parsePrompt(prompt) {
  const tasks = [];
  const subPrompts = prompt.split(/,\s*затем\s+/i);
  
  for (const subPrompt of subPrompts) {
    let matched = false;
    for (const pattern of promptPatterns) {
      const match = subPrompt.match(pattern.regex);
      if (match) {
        tasks.push({
          type: pattern.type,
          params: pattern.extract(match)
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      tasks.push({ type: 'chat', params: { query: subPrompt } });
    }
  }

  const isEnglish = /[a-zA-Z]/.test(prompt) && !/[а-яА-Я]/.test(prompt);
  const language = isEnglish ? 'en' : 'ru';

  return { tasks, language };
}

function getSystemPrompt(taskType) {
  const prompts = {
    chat: 'You are Pepegin GPT, a versatile AI. Provide accurate, concise, and context-aware responses in the user’s language.',
    analysis: 'You are an expert analyst. Use chain-of-thought reasoning, break down the problem into steps, and provide a detailed solution.',
    code: 'You are a skilled programmer. Write clean, functional code with comments and explain it if requested.',
    creative: 'You are a creative writer. Produce engaging, original content tailored to the user’s request.',
    image: 'You are assisting with image generation. Describe the process if asked, but focus on generating the image.',
    audio: 'You are assisting with audio generation. Ensure clarity and appropriateness of the output.'
  };
  return prompts[taskType] || prompts.chat;
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function addMessage(content, role, isImage = false, persist = true, isAudio = false, instantLoad = false) {
  const container = document.createElement('div');
  container.classList.add('message-container', role);

  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('avatar');
  avatarDiv.innerHTML = role === 'user' ? userAvatar : botAvatar;

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('message-content');

  if (isImage) {
    const img = document.createElement('img');
    if (instantLoad) {
      img.src = content;
    } else {
      img.dataset.src = content;
    }
    img.alt = 'Generated Image';
    img.onerror = () => {
      contentDiv.innerHTML = '<span>Не удалось загрузить изображение</span>';
    };
    contentDiv.appendChild(img);
  } else if (isAudio) {
    const player = document.createElement('div');
    player.classList.add('custom-audio-player');
    const audio = document.createElement('audio');
    audio.src = content;
    audio.preload = 'metadata';
    const playPauseBtn = document.createElement('button');
    playPauseBtn.classList.add('play-pause-btn');
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    playPauseBtn.type = 'button';
    const progressContainer = document.createElement('div');
    progressContainer.classList.add('progress-container');
    const progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');
    progressContainer.appendChild(progressBar);
    const timeDisplay = document.createElement('div');
    timeDisplay.classList.add('time-display');
    timeDisplay.textContent = '0:00 / 0:00';

    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        audio.pause();
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
    });

    audio.addEventListener('timeupdate', () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration || 0;
      progressBar.style.width = `${(currentTime / duration) * 100}%`;
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    });

    audio.addEventListener('ended', () => {
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      progressBar.style.width = '0%';
      audio.currentTime = 0;
    });

    progressContainer.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const seekTime = (clickX / width) * audio.duration;
      audio.currentTime = seekTime;
    });

    audio.addEventListener('loadedmetadata', () => {
      timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    player.appendChild(playPauseBtn);
    player.appendChild(progressContainer);
    player.appendChild(timeDisplay);
    player.appendChild(audio);
    contentDiv.appendChild(player);
  } else {
    const span = document.createElement('span');
    span.innerHTML = formatMessage(content, role);
    contentDiv.appendChild(span);

    if (role === 'bot') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.innerHTML = '<i class="fas fa-copy"></i>';
      btn.dataset.text = content;
      contentDiv.appendChild(btn);
    }
  }

  container.appendChild(avatarDiv);
  container.appendChild(contentDiv);
  chatEl.appendChild(container);
  chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });

  if (persist) {
    if (isImage || isAudio) {
      fetch(content)
        .then(res => res.blob())
        .then(blob => saveMediaToDB(blob))
        .then(mediaId => {
          conversationHistory.push({ role, mediaId, isImage, isAudio });
          saveChat();
        });
    } else {
      conversationHistory.push({ role, text: content, isImage, isAudio });
      saveChat();
    }
  }
  return container;
}

async function fetchWithRetry(url, options, retries = 3, timeout = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`HTTP
