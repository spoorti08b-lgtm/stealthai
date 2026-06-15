// Renderer process logic for StealthAI Panel (DOM Positioning Model)

const { ipcRenderer } = window;

// --- DOM Elements ---
const chatHistory = document.getElementById('answer-area');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const statusIndicator = document.getElementById('status-indicator');
const statusText = statusIndicator.querySelector('.status-text');
const dragHandle = document.getElementById('drag-handle');
const resizeHandle = document.getElementById('resize-handle');
const panel = document.getElementById('stealthai-panel');
const btnCapture = document.getElementById('btn-capture');
const btnClearScreenshot = document.getElementById('btn-clear-screenshot');
const screenshotPreview = document.getElementById('screenshot-preview');
const screenshotThumbnail = document.getElementById('screenshot-thumbnail');

let isClickThroughEnabled = false;
let lastUserQuestion = "";

// --- Hover Click-through Handling ---
panel.addEventListener('mouseenter', () => {
  if (!isClickThroughEnabled) {
    ipcRenderer.send('set-ignore-mouse', false);
  }
});

panel.addEventListener('mouseleave', () => {
  if (!isDragging && !isResizing && !isClickThroughEnabled) {
    ipcRenderer.send('set-ignore-mouse', true);
  }
});

// --- Mouse Dragging Logic (Fixed Position inside Fullscreen transparent viewport) ---
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

dragHandle.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // Only left clicks
  if (e.target.closest('#btn-settings') || e.target.closest('#btn-settings-close')) {
    return;
  }
  isDragging = true;

  // Calculate offset from mouse to panel top-left corner
  const rect = panel.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  // Lock width before drag starts
  panel.style.width = panel.offsetWidth + 'px';
  panel.style.right = 'unset';
  panel.style.bottom = 'unset';

  e.preventDefault();
});

// --- Mouse Resizing Logic ---
let isResizing = false;
let startWidth = 0;
let startHeight = 0;
let startX = 0;
let startY = 0;

resizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startY = e.clientY;
  startWidth = panel.offsetWidth;
  startHeight = panel.offsetHeight;
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('mousemove', (e) => {
  // Handle Panel Dragging
  if (isDragging) {
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;

    // Clamp to screen edges so it never goes off screen
    const maxLeft = window.innerWidth - panel.offsetWidth;
    const maxTop = window.innerHeight - panel.offsetHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  }

  // Handle Panel Resizing (Both Width and Height)
  if (isResizing) {
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(320, Math.min(window.innerWidth - 40, startWidth + deltaX));
    const newHeight = Math.max(200, Math.min(window.innerHeight - 40, startHeight + deltaY));
    
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    panel.style.maxHeight = newHeight + 'px';
  }
});

document.addEventListener('mouseup', (e) => {
  if (isDragging || isResizing) {
    isDragging = false;
    isResizing = false;

    // If mouse left the panel during fast dragging, re-enable ignore-mouse
    const rect = panel.getBoundingClientRect();
    const isInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );

    if (!isInside && !isClickThroughEnabled) {
      ipcRenderer.send('set-ignore-mouse', true);
    }
  }
});


// --- Status Indicator Helper ---
function setStatus(state) {
  statusIndicator.classList.remove('thinking', 'listening', 'speaking', 'transcribing');
  if (state === 'thinking') {
    statusIndicator.classList.add('thinking');
    statusText.textContent = "THINKING";
  } else if (state === 'listening') {
    statusIndicator.classList.add('listening');
    statusText.textContent = "LISTENING";
  } else if (state === 'speaking') {
    statusIndicator.classList.add('speaking');
    statusText.textContent = "SPEAKING";
  } else if (state === 'transcribing') {
    statusIndicator.classList.add('transcribing');
    statusText.textContent = "TRANSCRIBING";
  } else {
    statusText.textContent = "SECURE";
  }
}

function setThinking(isThinking) {
  if (isThinking) {
    setStatus('thinking');
  } else {
    if (typeof isListening !== 'undefined' && isListening) {
      setStatus('listening');
    } else {
      setStatus('secure');
    }
  }
}

// --- System Notification Toast ---
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.classList.remove('toast-hidden');
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  toastTimeout = setTimeout(() => {
    toast.classList.add('toast-hidden');
  }, 2500);
}

// --- IPC Communication Channel Listeners ---

// Toggle Stealth Rendering mode
ipcRenderer.on('stealth-mode-toggled', (event, isStealth) => {
  if (isStealth) {
    document.body.classList.add('stealth-mode-active');
  } else {
    document.body.classList.remove('stealth-mode-active');
  }
  showToast(isStealth ? "STEALTH ACTIVE [OS PROTECTED]" : "STEALTH INACTIVE");
  appendSystemMessage(isStealth ? 
    "Stealth mode engaged. mix-blend-mode: difference and OS screen capture protection active." : 
    "Stealth mode disengaged. Normal rendering active."
  );
});

// Click-through Hotkey status update
ipcRenderer.on('click-through-toggled', (event, isClickThrough) => {
  isClickThroughEnabled = isClickThrough;
  ipcRenderer.send('set-ignore-mouse', isClickThrough);
  showToast(isClickThrough ? "CLICK-THROUGH ON" : "CLICK-THROUGH OFF");
  appendSystemMessage(`Mouse Input state: ${isClickThrough ? 'IGNORE' : 'CAPTURE'}`);
});

// --- Settings Panel Management ---
const btnSettings = document.getElementById('btn-settings');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnSettingsSave = document.getElementById('btn-settings-save');
const settingsModal = document.getElementById('settings-modal');
const groqApiKeyInput = document.getElementById('groq-api-key');
const tavilyApiKeyInput = document.getElementById('tavily-api-key');
const btnTestConnection = document.getElementById('btn-test-connection');
const testResultDiv = document.getElementById('test-result');
const btnTestTavily = document.getElementById('btn-test-tavily');
const tavilyTestResultDiv = document.getElementById('tavily-test-result');
const groqModelSelect = document.getElementById('groq-model-select');
const settingsOpacity = document.getElementById('settings-opacity');
const settingsOpacityVal = document.getElementById('settings-opacity-val');
const fontSizeSelect = document.getElementById('font-size-select');
const webSearchToggle = document.getElementById('web-search-toggle');
const showTimeToggle = document.getElementById('show-time-toggle');
const showModelToggle = document.getElementById('show-model-toggle');

let conversationHistory = [];

// Real-time settings opacity slider updater
settingsOpacity.addEventListener('input', (e) => {
  const val = Math.round(parseFloat(e.target.value) * 100);
  settingsOpacityVal.textContent = val + '%';
  panel.style.opacity = e.target.value;
  if (opacitySlider) {
    opacitySlider.value = e.target.value;
    opacityVal.textContent = parseFloat(e.target.value).toFixed(2);
  }
});

// Toggle settings helper
function toggleSettingsModal() {
  if (settingsModal.classList.contains('settings-modal-hidden')) {
    // Open settings and load values
    const savedKey = localStorage.getItem('groq-api-key') || '';
    const savedTavilyKey = localStorage.getItem('tavily-api-key') || '';
    let savedModel = localStorage.getItem('groq-model') || 'auto';
    if (savedModel === 'llama3-8b-8192') {
      savedModel = 'llama-3.1-8b-instant';
      localStorage.setItem('groq-model', 'llama-3.1-8b-instant');
    }
    const savedOpacity = localStorage.getItem('hud-opacity') || '1.0';
    const savedFontSize = localStorage.getItem('hud-font-size') || '14px';
    const savedWebSearch = localStorage.getItem('tavily-search-enabled') !== 'false';
    const savedShowTime = localStorage.getItem('show-response-time') !== 'false';
    const savedShowModel = localStorage.getItem('show-model-name') !== 'false';
    
    groqApiKeyInput.value = savedKey;
    tavilyApiKeyInput.value = savedTavilyKey;
    groqModelSelect.value = savedModel;
    
    settingsOpacity.value = savedOpacity;
    settingsOpacityVal.textContent = Math.round(parseFloat(savedOpacity) * 100) + '%';
    
    fontSizeSelect.value = savedFontSize;
    webSearchToggle.checked = savedWebSearch;
    showTimeToggle.checked = savedShowTime;
    showModelToggle.checked = savedShowModel;
    
    testResultDiv.textContent = ""; 
    tavilyTestResultDiv.textContent = "";
    
    settingsModal.classList.remove('settings-modal-hidden');
    panel.classList.add('settings-active');
  } else {
    settingsModal.classList.add('settings-modal-hidden');
    panel.classList.remove('settings-active');
  }
}

btnSettings.addEventListener('click', toggleSettingsModal);
btnSettingsClose.addEventListener('click', toggleSettingsModal);

// IPC Listener for Ctrl+Shift+, Hotkey
ipcRenderer.on('toggle-settings-panel', () => {
  toggleSettingsModal();
});

// Test Connection Button Action (Pings Groq API)
btnTestConnection.addEventListener('click', async () => {
  const tempKey = groqApiKeyInput.value.trim();
  if (!tempKey) {
    testResultDiv.textContent = "Error: Input an API key to test.";
    testResultDiv.style.color = "#ff3366";
    return;
  }
  
  btnTestConnection.disabled = true;
  btnTestConnection.textContent = "TESTING...";
  testResultDiv.textContent = "Sending auth ping to Groq API...";
  testResultDiv.style.color = "#ffffff";
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tempKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
    });
    
    if (response.ok) {
      testResultDiv.textContent = "Handshake Successful! Groq Key is valid.";
      testResultDiv.style.color = "#00ffaa";
    } else {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errText;
      } catch (e) {}
      testResultDiv.textContent = `Auth Failure: Status ${response.status} - ${errMsg}`;
      testResultDiv.style.color = "#ff3366";
    }
  } catch (e) {
    testResultDiv.textContent = `Network Error: ${e.message}`;
    testResultDiv.style.color = "#ff3366";
  } finally {
    btnTestConnection.disabled = false;
    btnTestConnection.textContent = "TEST";
  }
});

// Test Tavily API Connection Button Action
btnTestTavily.addEventListener('click', async () => {
  const tempKey = tavilyApiKeyInput.value.trim();
  if (!tempKey) {
    tavilyTestResultDiv.textContent = "Error: Input an API key to test.";
    tavilyTestResultDiv.style.color = "#ff3366";
    return;
  }
  
  btnTestTavily.disabled = true;
  btnTestTavily.textContent = "TESTING...";
  tavilyTestResultDiv.textContent = "Sending auth ping to Tavily API...";
  tavilyTestResultDiv.style.color = "#ffffff";
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tempKey,
        query: 'ping',
        max_results: 1
      })
    });
    
    if (response.ok) {
      tavilyTestResultDiv.textContent = "Handshake Successful! Tavily Key is valid.";
      tavilyTestResultDiv.style.color = "#00ffaa";
    } else {
      tavilyTestResultDiv.textContent = `Auth Failure: Status ${response.status}`;
      tavilyTestResultDiv.style.color = "#ff3366";
    }
  } catch (e) {
    tavilyTestResultDiv.textContent = `Network Error: ${e.message}`;
    tavilyTestResultDiv.style.color = "#ff3366";
  } finally {
    btnTestTavily.disabled = false;
    btnTestTavily.textContent = "TEST";
  }
});

// Save Settings Button Action
btnSettingsSave.addEventListener('click', () => {
  const key = groqApiKeyInput.value.trim();
  const tavilyKey = tavilyApiKeyInput.value.trim();
  const model = groqModelSelect.value;
  const opacity = settingsOpacity.value;
  const fontSize = fontSizeSelect.value;
  const webSearch = webSearchToggle.checked;
  const showTime = showTimeToggle.checked;
  const showModel = showModelToggle.checked;
  
  localStorage.setItem('groq-api-key', key);
  localStorage.setItem('tavily-api-key', tavilyKey);
  localStorage.setItem('groq-model', model);
  localStorage.setItem('hud-opacity', opacity);
  localStorage.setItem('hud-font-size', fontSize);
  localStorage.setItem('tavily-search-enabled', webSearch);
  localStorage.setItem('show-response-time', showTime);
  localStorage.setItem('show-model-name', showModel);
  
  // Apply changes instantly
  panel.style.opacity = opacity;
  document.body.style.fontSize = fontSize;
  
  showToast("CONFIG SECURED");
  settingsModal.classList.add('settings-modal-hidden');
  panel.classList.remove('settings-active');
  appendSystemMessage(`Overlay config saved: model=${model}, opacity=${opacity}, font=${fontSize}, search=${webSearch}`);
});

// --- Message Logging Helpers ---
function appendSystemMessage(text) {
  const timeStr = new Date().toTimeString().split(' ')[0];
  const msgEl = document.createElement('div');
  msgEl.className = 'message system';
  msgEl.innerHTML = `
    <div class="content">${text}</div>
    <div class="meta">${timeStr}</div>
  `;
  chatHistory.appendChild(msgEl);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendMessage(text, sender) {
  const timeStr = new Date().toTimeString().split(' ')[0];
  const msgEl = document.createElement('div');
  msgEl.className = `message ${sender}`;
  msgEl.innerHTML = `
    <div class="content">${text}</div>
    <div class="meta">${timeStr}</div>
  `;
  chatHistory.appendChild(msgEl);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- User-Requested Markdown Answer Functions ---
let fullAnswer = '';

function startNewAnswer() {
  fullAnswer = ''; // reset for new question
  
  const answerArea = document.getElementById('answer-area') || document.getElementById('chat-history');
  
  const msgEl = document.createElement('div');
  msgEl.className = 'message assistant';
  
  const block = document.createElement('div');
  block.className = 'content answer-block';
  msgEl.appendChild(block);
  
  const metaEl = document.createElement('div');
  metaEl.className = 'meta';
  msgEl.appendChild(metaEl);
  
  answerArea.appendChild(msgEl);
  answerArea.scrollTop = answerArea.scrollHeight;
}

function appendToAnswer(token) {
  fullAnswer += token;
  
  // Re-render full answer as markdown each token
  const answerDiv = document.getElementById('answer-area') || document.getElementById('chat-history');
  const lastBlock = answerDiv.lastElementChild;
  
  if (lastBlock) {
    let target = lastBlock;
    if (!target.classList.contains('answer-block')) {
      target = lastBlock.querySelector('.answer-block');
    }
    
    if (target) {
      target.innerHTML = marked.parse(fullAnswer);
    }
  }
}

// --- Semantic Keyword Classifier ---
function classifyQuestion(text) {
  const query = text.toLowerCase();
  
  const codeKeywords = [
    'code', 'python', 'javascript', 'html', 'css', 'c++', 'c#', 'rust', 'java', 'go ', 'function', 
    'class', 'compile', 'bug', 'github', 'script', 'algorithm', 'syntax', 'programming', 'developer',
    'array', 'object', 'loop', 'regex'
  ];
  
  const mathKeywords = [
    'solve', 'math', 'calculate', 'integral', 'derivative', 'equation', 'matrix', 'algebra', 
    'calculus', 'geometry', 'fraction', 'multiply', 'divide', 'subtract', 'sum', 'theorem', 
    'proof', 'logic', 'logarithm', 'square root'
  ];
  
  const liveKeywords = [
    'weather', 'price of', 'news', 'stock', 'today', 'yesterday', 'score', 'match', 'vs', 
    'at the moment', 'current price', 'bitcoin', 'crypto', 'temperature in', 'who won'
  ];
  
  const interviewKeywords = [
    'interview', 'resume', 'hire', 'hired', 'senior expert', 'career', 'tell me about yourself',
    'strength', 'weakness', 'behavioral', 'star method', 'job application', 'salary'
  ];
  
  const translateKeywords = [
    'translate', 'in spanish', 'in french', 'in german', 'in chinese', 'in japanese', 
    'how do you say', 'pronunciation of', 'translation'
  ];

  if (codeKeywords.some(kw => query.includes(kw))) return 'code';
  if (mathKeywords.some(kw => query.includes(kw))) return 'math';
  if (liveKeywords.some(kw => query.includes(kw))) return 'live';
  if (interviewKeywords.some(kw => query.includes(kw))) return 'interview';
  if (translateKeywords.some(kw => query.includes(kw))) return 'translate';
  
  return 'general';
}

// --- Tavily Web Search Integration ---
const LIVE_KEYWORDS = [
  'today', 'now', 'current', 'latest', 'news', 'price',
  'score', 'weather', 'who won', 'what happened', 'right now',
  'this week', 'this year', '2025', '2026', 'recently',
  'just', 'breaking', 'update', 'live', 'stock', 'crypto'
];

function needsWebSearch(question) {
  return LIVE_KEYWORDS.some(kw => 
    question.toLowerCase().includes(kw)
  );
}

async function searchWeb(query) {
  const tavilyApiKey = localStorage.getItem('tavily-api-key');
  if (!tavilyApiKey) {
    throw new Error("Tavily API key is missing. Add it in settings.");
  }
  
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query: query,
      max_results: 3
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Search failure: ${res.status} - ${err}`);
  }
  
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return "No search results found.";
  }
  
  return data.results.map(r => 
    `Source: ${r.url}\n${r.content}`
  ).join('\n\n');
}

// --- Groq Streaming Request ---
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  // Record last raw question
  lastUserQuestion = text;
  
  // Clear input field and reset textarea height
  chatInput.value = '';
  chatInput.style.height = 'auto';
  
  const lowerText = text.toLowerCase();
  
  // Local CLI Exit Directive
  if (lowerText === 'exit' || lowerText === 'quit' || lowerText === 'close') {
    appendMessage(text, 'user');
    appendSystemMessage("Closing secure link...");
    setTimeout(() => {
      ipcRenderer.send('window-close');
    }, 500);
    return;
  }

  // Local CLI Clear Chat Directive
  if (lowerText === 'clear') {
    chatHistory.innerHTML = "";
    conversationHistory = []; // Reset conversation history memory
    appendSystemMessage("Secure session memory cleared.");
    return;
  }

  // Log user message
  appendMessage(text, 'user');

  // Load Configurations
  const apiKey = localStorage.getItem('groq-api-key');
  if (!apiKey) {
    appendSystemMessage("Uplink failed: No Groq API key found. Open settings (gear icon / Ctrl+Shift+,) to configure.");
    return;
  }

  let modelSetting = localStorage.getItem('groq-model') || 'auto';
  if (modelSetting === 'llama3-8b-8192') {
    modelSetting = 'llama-3.1-8b-instant';
    localStorage.setItem('groq-model', 'llama-3.1-8b-instant');
  }
  const temperature = parseFloat(localStorage.getItem('groq-temp') || '0.7');
  const maxTokens = parseInt(localStorage.getItem('groq-max-tokens') || '1024');

  // Semantic Classifier Routing
  const category = classifyQuestion(text);
  
  // Auto-switch Model Selection
  let finalModel = modelSetting;
  if (activeScreenshot) {
    // Override model choice to the vision model since vision context is attached
    finalModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
  } else if (modelSetting === 'auto') {
    const queryLower = text.toLowerCase();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    
    const hasCodeKeywords = ['code', 'debug', 'function', 'solve', 'explain in detail', 'analyze'].some(kw => 
      queryLower.includes(kw)
    );
    const hasSummaryKeywords = ['summarize', 'read this', 'this text'].some(kw => 
      queryLower.includes(kw)
    );
    
    if (hasSummaryKeywords) {
      finalModel = 'gemma2-9b-it';
    } else if (hasCodeKeywords) {
      finalModel = 'llama-3.3-70b-versatile';
    } else if (wordCount < 10 && !hasCodeKeywords) {
      finalModel = 'llama-3.1-8b-instant';
    } else {
      finalModel = 'llama-3.3-70b-versatile';
    }
  }

  let finalQuestion = text;
  let usedSearch = false;

  // Toggle thinking dot animation
  setThinking(true);

  const webSearchEnabled = localStorage.getItem('tavily-search-enabled') !== 'false';
  if (webSearchEnabled && needsWebSearch(text)) {
    try {
      appendSystemMessage("Query requires live context. Initiating Tavily web search...");
      const searchResults = await searchWeb(text);
      finalQuestion = `Here is current web search data to help answer:
${searchResults}

Now answer this question using the above data: 
${text}`;
      usedSearch = true;
    } catch (err) {
      console.error("Tavily search failed, falling back to direct AI:", err);
      appendSystemMessage(`Tavily search failed: ${err.message}. Falling back to direct AI...`);
      
      // Fallback prefix based on category
      let prefix = "";
      switch (category) {
        case 'live': prefix = "Search the web right now and tell me: "; break;
        case 'code': prefix = "Write working code to solve this. Show the complete solution: "; break;
        case 'interview': prefix = "Answer this as a senior professional being interviewed. Be structured and confident: "; break;
        case 'math': prefix = "Solve this step by step showing all working, then give the final answer: "; break;
        case 'translate': prefix = "Translate this accurately and give pronunciation if helpful: "; break;
        default: prefix = "";
      }
      finalQuestion = prefix + text;
    }
  } else {
    // Normal prefix based on category
    let prefix = "";
    switch (category) {
      case 'live': prefix = "Search the web right now and tell me: "; break;
      case 'code': prefix = "Write working code to solve this. Show the complete solution: "; break;
      case 'interview': prefix = "Answer this as a senior professional being interviewed. Be structured and confident: "; break;
      case 'math': prefix = "Solve this step by step showing all working, then give the final answer: "; break;
      case 'translate': prefix = "Translate this accurately and give pronunciation if helpful: "; break;
      default: prefix = "";
    }
    finalQuestion = prefix + text;
  }

  const systemPrompt = `You are a real-time expert assistant. Answer ANY question directly, accurately and completely.
- Answer coding questions with full working code
- Answer interview questions like a senior expert
- Solve math problems step by step
- Answer factual questions with precise facts
- Answer live/current questions as best you can
- Never refuse reasonable questions
- Never add unnecessary disclaimers or warnings
- Be concise, direct, and complete
- Use bullet points for lists
- Use code blocks for all code`;

  try {
    const startTime = Date.now();
    let shortModelName = finalModel;
    if (finalModel === 'llama-3.3-70b-versatile') shortModelName = 'llama-3.3-70b';
    else if (finalModel === 'llama-3.1-8b-instant') shortModelName = 'llama-3.1-8b';
    else if (finalModel === 'mixtral-8x7b-32768') shortModelName = 'mixtral-8x7b';
    else if (finalModel === 'gemma2-9b-it') shortModelName = 'gemma2-9b';
    else if (finalModel === 'meta-llama/llama-4-scout-17b-16e-instruct') shortModelName = 'llama-4-scout';

    let requestMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
    ];

    if (activeScreenshot) {
      requestMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: finalQuestion },
          {
            type: 'image_url',
            image_url: {
              url: activeScreenshot
            }
          }
        ]
      });
    } else {
      requestMessages.push({ role: 'user', content: finalQuestion });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: finalModel,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        max_tokens: maxTokens,
        messages: requestMessages
      })
    });

    // Clear screenshot cache and preview bar now that it has been successfully sent
    if (activeScreenshot) {
      activeScreenshot = null;
      screenshotThumbnail.src = "";
      screenshotPreview.classList.add('screenshot-preview-hidden');
    }

    if (!response.ok) {
      const errText = await response.text();
      let errorMessage = errText;
      try {
        const errJson = JSON.parse(errText);
        errorMessage = errJson.error?.message || errText;
      } catch (e) {}
      throw new Error(`Status ${response.status} - ${errorMessage}`);
    }

    // Call startNewAnswer to initialize the block
    startNewAnswer();
    
    // Get references to elements we just created
    const answerArea = document.getElementById('answer-area') || document.getElementById('chat-history');
    const msgEl = answerArea.lastElementChild;
    const contentEl = msgEl.querySelector('.answer-block');
    const metaEl = msgEl.querySelector('.meta');
    
    const timeStr = new Date().toTimeString().split(' ')[0];
    const showModel = localStorage.getItem('show-model-name') !== 'false';
    let metadataParts = [];
    metadataParts.push(timeStr);
    metadataParts.push(`[${usedSearch ? 'live' : 'ai'}]`);
    if (showModel) {
      metadataParts.push(`<span class="model-info">${shortModelName}</span>`);
    }
    metadataParts.push(`<span class="token-count">~0</span> tokens`);
    
    metaEl.innerHTML = metadataParts.join(' | ');
    const tokenCounter = metaEl.querySelector('.token-count');

    // Readable Stream SSE Event Parser
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save trailing line segment to buffer
      buffer = lines.pop();

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine) continue;
        if (cleanedLine === 'data: [DONE]') continue;

        if (cleanedLine.startsWith('data: ')) {
          try {
            const dataJson = JSON.parse(cleanedLine.slice(6));
            
            // Check for exact usage stats chunk
            if (dataJson.usage) {
              const promptT = dataJson.usage.prompt_tokens;
              const compT = dataJson.usage.completion_tokens;
              const totalT = dataJson.usage.total_tokens;
              if (tokenCounter) {
                tokenCounter.textContent = `${totalT} (${promptT}p + ${compT}c)`;
              }
            } else {
              // Parse normal delta tokens
              const chunk = dataJson.choices[0]?.delta?.content;
              if (chunk) {
                appendToAnswer(chunk);
                
                // Update live estimated token counter
                const charCount = fullAnswer.length;
                const estTokens = Math.ceil(charCount / 4);
                if (tokenCounter && !tokenCounter.textContent.includes('(')) {
                  tokenCounter.textContent = `~${estTokens}`;
                }
                
                answerArea.scrollTop = answerArea.scrollHeight;
              }
            }
          } catch (e) {
            console.error("SSE parse error:", e);
          }
        }
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const showTime = localStorage.getItem('show-response-time') !== 'false';
    
    if (showModel) {
      const modelInfoEl = metaEl.querySelector('.model-info');
      if (modelInfoEl) {
        if (showTime) {
          modelInfoEl.textContent = `${shortModelName} • ${durationSec}s`;
        } else {
          modelInfoEl.textContent = shortModelName;
        }
      }
    } else if (showTime) {
      // If model is hidden but time is shown, append time to metadata line
      const timeTag = document.createElement('span');
      timeTag.textContent = ` | ${durationSec}s`;
      metaEl.appendChild(timeTag);
    }

    // Push conversation turn to session memory
    conversationHistory.push({ role: 'user', content: finalQuestion });
    conversationHistory.push({ role: 'assistant', content: fullAnswer });

  } catch (error) {
    console.error("Groq uplink failed:", error);
    appendSystemMessage(`Uplink Error: ${error.message}`);
  } finally {
    setThinking(false);
  }
}

// Bind key events and local textarea controls
btnSend.addEventListener('click', handleSendMessage);

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = chatInput.scrollHeight + 'px';
});

chatInput.addEventListener('keydown', (e) => {
  // Enter sends question, Shift+Enter makes newline
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
  
  // Escape clears input
  if (e.key === 'Escape') {
    chatInput.value = '';
    chatInput.style.height = 'auto';
    e.preventDefault();
  }
  
  // Up Arrow recalls last question if input is empty
  if (e.key === 'ArrowUp' && chatInput.value === '') {
    if (lastUserQuestion) {
      chatInput.value = lastUserQuestion;
      chatInput.style.height = 'auto';
      chatInput.style.height = chatInput.scrollHeight + 'px';
      e.preventDefault();
    }
  }
});

// Opacity popup controls
const opacityPopup = document.getElementById('opacity-popup');
const opacitySlider = document.getElementById('opacity-slider');
const opacityVal = document.getElementById('opacity-val');

opacitySlider.addEventListener('input', (e) => {
  const opacity = parseFloat(e.target.value);
  panel.style.opacity = opacity;
  opacityVal.textContent = opacity.toFixed(2);
  if (settingsOpacity) {
    settingsOpacity.value = opacity;
    settingsOpacityVal.textContent = Math.round(opacity * 100) + '%';
  }
});

// --- IPC Global Shortcut Listeners ---
ipcRenderer.on('clear-conversation', () => {
  chatHistory.innerHTML = "";
  conversationHistory = [];
  appendSystemMessage("Secure session memory cleared.");
  showToast("MEMORY FLUSHED");
});

ipcRenderer.on('toggle-compact-mode', () => {
  panel.classList.toggle('compact-mode');
  showToast(panel.classList.contains('compact-mode') ? "COMPACT HUD" : "FULL HUD");
});

ipcRenderer.on('toggle-opacity-popup', () => {
  opacityPopup.classList.toggle('opacity-popup-hidden');
  if (!opacityPopup.classList.contains('opacity-popup-hidden')) {
    opacitySlider.focus();
  }
});

// Setup initial UI size fitting on load
window.addEventListener('DOMContentLoaded', () => {
  // Apply saved opacity and font size instantly
  const savedOpacity = localStorage.getItem('hud-opacity') || '1.0';
  const savedFontSize = localStorage.getItem('hud-font-size') || '14px';
  panel.style.opacity = savedOpacity;
  document.body.style.fontSize = savedFontSize;
  
  if (opacitySlider) {
    opacitySlider.value = savedOpacity;
    opacityVal.textContent = parseFloat(savedOpacity).toFixed(2);
  }
  if (settingsOpacity) {
    settingsOpacity.value = savedOpacity;
    settingsOpacityVal.textContent = Math.round(parseFloat(savedOpacity) * 100) + '%';
  }
  
  // Prompt API Configuration if missing
  const savedKey = localStorage.getItem('groq-api-key');
  if (!savedKey) {
    appendSystemMessage("System check: No credentials found. Click the gear icon or press Ctrl+Shift+, to establish your Groq API key.");
  }
});

// --- Screen Capture & Visual QA Bindings ---
let activeScreenshot = null;

async function triggerScreenCapture() {
  setThinking(true);
  appendSystemMessage("Capturing target screen contents...");
  try {
    const dataUrl = await ipcRenderer.invoke('capture-screen');
    activeScreenshot = dataUrl;
    
    // Set thumbnail and display preview container
    screenshotThumbnail.src = dataUrl;
    screenshotPreview.classList.remove('screenshot-preview-hidden');
    
    appendSystemMessage("Screenshot cached. Enter your query below to analyze the screen.");
    showToast("SCREEN CACHED");
  } catch (err) {
    console.error("Screen capture failed:", err);
    appendSystemMessage(`Screen capture error: ${err.message}`);
    showToast("CAPTURE FAILED");
  } finally {
    setThinking(false);
  }
}

btnCapture.addEventListener('click', () => {
  triggerScreenCapture();
});

btnClearScreenshot.addEventListener('click', () => {
  activeScreenshot = null;
  screenshotThumbnail.src = "";
  screenshotPreview.classList.add('screenshot-preview-hidden');
  appendSystemMessage("Screen capture cache discarded.");
  showToast("CACHE DISCARDED");
});

ipcRenderer.on('trigger-screen-capture', () => {
  triggerScreenCapture();
});

// --- Live Listen Mode (Speech-to-Text with VAD) ---
const btnListen = document.getElementById('btn-listen');
let isListening = false;
let audioStream = null;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let vadInterval = null;
let lastSpeechTime = 0;
let speakingDetected = false;

// Silence parameters
const VAD_SILENCE_THRESHOLD = 0.012; // RMS amplitude threshold
const VAD_SILENCE_DURATION = 1500;   // ms of silence before auto-submitting

async function startListenMode() {
  if (isListening) return;
  
  const apiKey = localStorage.getItem('groq-api-key');
  if (!apiKey) {
    appendSystemMessage("Listen mode failed: No Groq API key found. Open settings to configure.");
    return;
  }
  
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    isListening = true;
    btnListen.classList.add('listening-active');
    setStatus('listening');
    
    // Set up Web Audio API analyzer
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioChunks = [];
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      if (speakingDetected) {
        await transcribeAndProcessAudio(audioBlob);
      }
    };
    
    mediaRecorder.start();
    speakingDetected = false;
    lastSpeechTime = 0;
    
    // VAD Loop (Checks volume every 100ms)
    vadInterval = setInterval(() => {
      if (!isListening) return;
      
      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      if (rms > VAD_SILENCE_THRESHOLD) {
        if (!speakingDetected) {
          speakingDetected = true;
          setStatus('speaking');
        }
        lastSpeechTime = Date.now();
      } else {
        if (speakingDetected && lastSpeechTime > 0) {
          const silenceDuration = Date.now() - lastSpeechTime;
          if (silenceDuration > VAD_SILENCE_DURATION) {
            // Silence limit reached! Trigger transcription and restart recording
            setStatus('transcribing');
            mediaRecorder.stop();
            
            // Re-initialize for next speech slice immediately
            speakingDetected = false;
            lastSpeechTime = 0;
            mediaRecorder.start();
          }
        } else {
          // If thinking/transcribing, keep that status. Otherwise show listening.
          if (statusText.textContent !== "THINKING" && statusText.textContent !== "TRANSCRIBING") {
            setStatus('listening');
          }
        }
      }
    }, 100);
    
    appendSystemMessage("Live Listen Mode active. Speak now, I will transcribe and respond automatically.");
    showToast("LIVE LISTEN ACTIVE");
  } catch (err) {
    console.error("Failed to start Listen Mode:", err);
    appendSystemMessage(`Listen Mode error: ${err.message}`);
    showToast("LISTEN FAILED");
    stopListenMode();
  }
}

function stopListenMode() {
  if (!isListening) return;
  isListening = false;
  btnListen.classList.remove('listening-active');
  setStatus('secure');
  
  if (vadInterval) {
    clearInterval(vadInterval);
    vadInterval = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  appendSystemMessage("Live Listen Mode deactivated.");
  showToast("LIVE LISTEN OFF");
}

function toggleListenMode() {
  if (isListening) {
    stopListenMode();
  } else {
    startListenMode();
  }
}

async function transcribeAndProcessAudio(audioBlob) {
  const apiKey = localStorage.getItem('groq-api-key');
  if (!apiKey) {
    appendSystemMessage("Transcription failed: No Groq API key found.");
    return;
  }
  
  setStatus('transcribing');
  
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.webm');
    formData.append('model', 'whisper-large-v3');
    
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Whisper failed: ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    const transcribedText = data.text ? data.text.trim() : '';
    
    if (transcribedText && transcribedText.length > 1) {
      appendSystemMessage(`Transcribed speech: "${transcribedText}"`);
      chatInput.value = transcribedText;
      await handleSendMessage();
    } else {
      console.log("Empty transcription (silence/noise).");
      if (isListening) setStatus('listening');
    }
  } catch (err) {
    console.error("Transcription error:", err);
    appendSystemMessage(`Speech-to-text error: ${err.message}`);
    if (isListening) setStatus('listening');
  }
}

// Event Bindings
btnListen.addEventListener('click', toggleListenMode);

ipcRenderer.on('toggle-listen-mode', () => {
  toggleListenMode();
});



