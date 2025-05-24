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
        throw new Error(`HTTP error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function sendChatRequest(prompt, taskType, language) {
  const cacheKey = `chat:${prompt}:${taskType}`;
  if (apiCache[cacheKey]) {
    return apiCache[cacheKey];
  }

  try {
    const textHistory = conversationHistory.filter(msg => !msg.isImage && !msg.isAudio).slice(-20);
    const systemPrompt = {
      role: 'system',
      content: getSystemPrompt(taskType) + ` Respond in ${language === 'en' ? 'English' : 'Russian'}.`
    };
    const messages = [systemPrompt, ...textHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    })), { role: 'user', content: prompt }];

    const response = await fetchWithRetry('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'advanced-llm', messages, max_tokens: 4096 })
    });

    const data = await response.json();
    let assistantMessage = data.choices[0].message.content;
    assistantMessage = assistantMessage.replace(POLLINATIONS_FOOTER, '').trim();
    apiCache[cacheKey] = assistantMessage;
    saveCache();
    return assistantMessage;
  } catch (error) {
    console.error('Ошибка чата:', error);
    return 'Ошибка ответа от сервера: ' + error.message;
  }
}

async function compressImage(blob, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
  });
}

async function addWatermark(imageUrl, applyWatermark) {
  if (!applyWatermark) {
    return imageUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const text = 'tg: @pepegin';
      const fontSize = Math.min(img.width / 20, 32);
      ctx.font = `${fontSize}px Roboto Mono`;
      ctx.textBaseline = 'bottom';
      const textMetrics = ctx.measureText(text);
      const x = img.width - textMetrics.width - 8;
      const y = img.height - 8;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(text, x, y);

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, 'image/png');
    };

    img.onerror = () => reject(new Error('Не удалось загрузить изображение для водяного знака'));
  });
}

async function generateImage(params) {
  const cacheKey = `image:${params.prompt}:${params.style}:${params.resolution}`;
  if (apiCache[cacheKey]) {
    return apiCache[cacheKey];
  }

  try {
    const applyWatermark = !params.prompt.toLowerCase().includes('pepegin');
    const cleanPrompt = params.prompt.replace(/\bpepegin\b/gi, '').trim();
    const styleMap = {
      'реалистичное': 'photorealistic',
      'cartoon': 'cartoon',
      'аниме': 'anime',
      'абстрактное': 'abstract'
    };
    const apiStyle = styleMap[params.style.toLowerCase()] || 'default';

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?nologo=true&style=${apiStyle}&width=${params.resolution.split('x')[0]}&height=${params.resolution.split('x')[1]}${params.negative ? `&negative=${encodeURIComponent(params.negative)}` : ''}`;
    const response = await fetchWithRetry(url, { method: 'GET' });

    const blob = await response.blob();
    const originalUrl = URL.createObjectURL(blob);

    const compressedBlob = await compressImage(blob);
    const watermarkedUrl = await addWatermark(URL.createObjectURL(compressedBlob), applyWatermark);
    
    apiCache[cacheKey] = watermarkedUrl;
    saveCache();
    return watermarkedUrl;
  } catch (error) {
    console.error('Ошибка генерации изображения:', error);
    throw new Error('Не удалось сгенерировать изображение: ' + error.message);
  }
}

async function generateAudio(params) {
  const cacheKey = `audio:${params.text}:${params.voice}:${params.volume}`;
  if (apiCache[cacheKey]) {
    return apiCache[cacheKey];
  }

  try {
    const validVoices = ['nova', 'alloy', 'echo'];
    const selectedVoice = validVoices.includes(params.voice.toLowerCase()) ? params.voice.toLowerCase() : 'nova';
    const url = `https://text.pollinations.ai/${encodeURIComponent(params.text)}?model=openai-audio&voice=${selectedVoice}`;
    const response = await fetchWithRetry(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('audio/')) {
      throw new Error('Получен не аудио контент');
    }

    const audioUrl = URL.createObjectURL(blob);
    apiCache[cacheKey] = audioUrl;
    saveCache();
    return audioUrl;
  } catch (error) {
    console.error('Ошибка генерации аудио:', error);
    throw new Error('Не удалось сгенерировать аудио: ' + error.message);
  }
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  addMessage(message, 'user');
  const { tasks, language } = parsePrompt(message);

  for (const task of tasks) {
    const loadingEl = addMessage(`<i class="fas fa-spinner fa-spin"></i> Обрабатываю ${task.type}...`, 'bot', false, false);

    try {
      if (task.type === 'image') {
        const imageUrl = await generateImage(task.params);
        chatEl.removeChild(loadingEl);
        addMessage(imageUrl, 'bot', true, true, false, true);
      } else if (task.type === 'audio') {
        const audioUrl = await generateAudio(task.params);
        chatEl.removeChild(loadingEl);
        addMessage(audioUrl, 'bot', false, true, true);
      } else {
        const result = await sendChatRequest(task.params.query || task.params.task, task.type, language);
        chatEl.removeChild(loadingEl);
        addMessage(result, 'bot');
      }
    } catch (error) {
      chatEl.removeChild(loadingEl);
      addMessage(error.message, 'bot');
    }
  }
};

document.addEventListener('click', (event) => {
  if (event.target.closest('.copy-btn')) {
    const btn = event.target.closest('.copy-btn');
    const textToCopy = btn.dataset.text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      btn.innerHTML = '<i class="fas fa-check"></i>';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
        btn.classList.remove('copied');
      }, 1500);
    });
  }
});

document.querySelector('.sidebar button[aria-label="Переключить тему"]').addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
});

document.querySelector('.sidebar button[aria-label="Очистить чат"]').addEventListener('click', () => {
  conversationHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  chatEl.innerHTML = '';
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
});

document.querySelector('.sidebar button[aria-label="Открыть справку"]').addEventListener('click', () => {
  addMessage(`
Справка:
- Текст: задавайте любые вопросы, включая аналитические ("анализируй данные").
- Фото: "сгенерируй фото <описание> [реалистичное|cartoon|аниме|абстрактное] [ширинаxвысота] [без <негатив>]".
- Аудио: "гс <текст> [голосом alloy|echo|nova] [громко|тихо]".
- Код: "напиши код на <язык> для <задача>".
- Творчество: "напиши рассказ/стих <тема>".
- Многоэтапные задачи: используйте "затем" (напр., "напиши рассказ, затем сгенерируй фото").
- Загружайте файлы (изображения, аудио, PDF).
`, 'bot');
});

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sidebar') && !event.target.closest('.menu-toggle') && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
});

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    input.value = transcript;
    if (event.results[0].isFinal) {
      micButton.classList.remove('recording');
    }
  };
  recognition.onerror = (event) => {
    console.error('Ошибка распознавания речи:', event.error);
    addMessage('Ошибка распознавания речи: ' + event.error, 'bot');
    micButton.classList.remove('recording');
  };
  recognition.onend = () => micButton.classList.remove('recording');
  micButton.addEventListener('click', () => {
    try {
      recognition.start();
      micButton.classList.add('recording');
    } catch (error) {
      addMessage('Не удалось запустить распознавание речи.', 'bot');
    }
  });
} else {
  micButton.disabled = true;
  micButton.title = 'Ваш браузер не поддерживает распознавание речи';
}

window.onload = () => {
  loadChat();
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
  }
};
