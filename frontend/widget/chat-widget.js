// frontend/widget/chat-widget.js

const API_BASE = "http://localhost:8000";

// 고객 식별ID (쿠키/로컬스토리지로 한 번 생성해두고 계속 사용)
let customerId = localStorage.getItem("dw_widget_customer_id");
if (!customerId) {
  customerId = `w_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("dw_widget_customer_id", customerId);
}

// WebSocket 연결
let ws = null;

// 위젯 초기화
function initWidget() {
  // 위젯 HTML 생성
  const widgetHTML = `
    <div id="chat-widget-container">
      <!-- AI 챗봇 아이콘 (위젯 버튼 위) -->
      <button id="ai-chatbot-button" class="ai-chatbot-button" title="AI 챗봇">
        🤖
      </button>
      
      <!-- 채팅 버튼 -->
      <button id="chat-widget-button" class="chat-button">
        💬
      </button>
      
      <!-- 채팅창 -->
      <div id="chat-widget-window" class="chat-window" style="display: none;">
        <div class="chat-header">
          <span>Dreamwish 상담</span>
          <button id="chat-close-btn" class="close-btn">✕</button>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="메시지를 입력하세요..." />
          <button id="chat-send-btn">전송</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', widgetHTML);
  
  // 이벤트 리스너 연결
  document.getElementById('ai-chatbot-button').addEventListener('click', openChat);
  document.getElementById('chat-widget-button').addEventListener('click', openChat);
  document.getElementById('chat-close-btn').addEventListener('click', closeChat);
  document.getElementById('chat-send-btn').addEventListener('click', handleSendMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
  
  // WebSocket 연결
  connectWebSocket();
  
  // 기존 대화 로드
  loadPreviousMessages();
}

// AI 챗봇 정보 표시
function openAIInfo() {
  alert('🤖 AI 자동응답 챗봇\n\n✅ AI 자동응답 활성화됨!\n\n간단한 질문은 AI가 자동으로 답변하고,\n복잡한 문의는 상담원이 직접 답변합니다.\n\n💬 아래 채팅 버튼을 눌러 문의하세요!');
}

// 채팅창 열기
function openChat() {
  document.getElementById('chat-widget-window').style.display = 'flex';
  document.getElementById('chat-widget-button').style.display = 'none';
}

// 채팅창 닫기
function closeChat() {
  document.getElementById('chat-widget-window').style.display = 'none';
  document.getElementById('chat-widget-button').style.display = 'flex';
}

// WebSocket 연결
function connectWebSocket() {
  ws = new WebSocket(`ws://localhost:8000/ws/widget/${customerId}`);
  
  ws.onopen = () => {
    console.log('위젯 WebSocket 연결됨');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'agent_reply') {
      addAgentBubble(data.message.content);
    }
  };
  
  ws.onclose = () => {
    console.log('위젯 WebSocket 연결 종료');
    // 재연결 시도 (5초 후)
    setTimeout(connectWebSocket, 5000);
  };
}

// 이전 메시지 로드
async function loadPreviousMessages() {
  try {
    const res = await fetch(`${API_BASE}/widget/conversation/${customerId}`);
    const data = await res.json();
    
    if (data.exists && data.messages) {
      data.messages.forEach((msg) => {
        if (msg.sender_type === 'customer') {
          addUserBubble(msg.content, false);
        } else {
          addAgentBubble(msg.content, false);
        }
      });
    }
  } catch (err) {
    console.error('이전 메시지 로드 실패:', err);
  }
}

// 메시지 전송 처리
async function handleSendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  if (!text) return;
  
  input.value = '';
  await sendUserMessage(text);
}

// 사용자 메시지 전송
async function sendUserMessage(text) {
  // 화면에 말풍선 추가
  addUserBubble(text);

  try {
    const res = await fetch(`${API_BASE}/widget/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_external_id: customerId,
        customer_name: "고객",
        content: text,
      }),
    });

    const data = await res.json();
    console.log("메시지 전송 완료:", data);
  } catch (err) {
    console.error("메시지 전송 실패:", err);
    addSystemBubble("메시지 전송에 실패했습니다.");
  }
}

// 사용자 말풍선 추가
function addUserBubble(text, scroll = true) {
  const messagesDiv = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble user-bubble';
  bubble.textContent = text;
  messagesDiv.appendChild(bubble);
  
  if (scroll) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// 상담원 말풍선 추가
function addAgentBubble(text, scroll = true) {
  const messagesDiv = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble agent-bubble';
  bubble.textContent = text;
  messagesDiv.appendChild(bubble);
  
  if (scroll) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// 시스템 메시지 추가
function addSystemBubble(text) {
  const messagesDiv = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble system-bubble';
  bubble.textContent = text;
  messagesDiv.appendChild(bubble);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 페이지 로드 시 위젯 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}
