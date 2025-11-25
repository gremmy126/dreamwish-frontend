// AI 채팅 JavaScript
const API_BASE = window.location.origin;

let aiMessagesContainer;
let aiInputEl;
let aiSendBtn;

// 토큰 가져오기
function getToken() {
  return localStorage.getItem("dw_token");
}

// 메시지 추가
function appendAIMessage(text, sender = "bot", timestamp = null) {
  if (!aiMessagesContainer) return;

  // 환영 메시지 제거
  const welcome = aiMessagesContainer.querySelector(".ai-welcome");
  if (welcome) {
    welcome.remove();
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = `ai-message ${sender}`;

  // 아바타
  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = sender === "bot" ? "🤖" : "👤";

  // 말풍선 래퍼
  const wrapper = document.createElement("div");
  wrapper.className = "ai-bubble-wrapper";

  // 말풍선
  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);

  // 타임스탬프
  if (timestamp) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "ai-time";
    const date = new Date(timestamp);
    timeDiv.textContent = date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    wrapper.appendChild(timeDiv);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(wrapper);
  aiMessagesContainer.appendChild(messageDiv);

  // 스크롤 맨 아래로
  aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

// 타이핑 인디케이터 표시
function showTypingIndicator() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "ai-message bot typing-message";
  typingDiv.innerHTML = `
    <div class="ai-avatar">🤖</div>
    <div class="ai-bubble-wrapper">
      <div class="ai-bubble typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  aiMessagesContainer.appendChild(typingDiv);
  aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

// 타이핑 인디케이터 제거
function hideTypingIndicator() {
  const typingMsg = aiMessagesContainer.querySelector(".typing-message");
  if (typingMsg) {
    typingMsg.remove();
  }
}

// AI에게 메시지 전송
async function sendAIMessage() {
  const text = aiInputEl.value.trim();
  if (!text) return;

  const token = getToken();
  if (!token) {
    alert("로그인이 필요합니다.");
    window.location.href = "login.html";
    return;
  }

  // 사용자 메시지 추가
  appendAIMessage(text, "user", new Date().toISOString());
  aiInputEl.value = "";
  aiInputEl.style.height = "auto";
  aiSendBtn.disabled = true;

  // 타이핑 인디케이터 표시
  showTypingIndicator();

  try {
    // AI API 호출
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
      }),
    });

    hideTypingIndicator();

    if (!res.ok) {
      throw new Error("AI 응답 실패");
    }

    const data = await res.json();
    const aiResponse = data.response || "죄송합니다. 답변을 생성할 수 없습니다.";

    // AI 응답 추가
    appendAIMessage(aiResponse, "bot", new Date().toISOString());
  } catch (error) {
    hideTypingIndicator();
    console.error("AI 채팅 오류:", error);
    appendAIMessage(
      "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      "bot",
      new Date().toISOString()
    );
  } finally {
    aiSendBtn.disabled = false;
  }
}

// 입력창 자동 높이 조절
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// 초기화
function initAIChat() {
  aiMessagesContainer = document.getElementById("ai-messages");
  aiInputEl = document.getElementById("ai-input");
  aiSendBtn = document.getElementById("ai-send-btn");

  // 전송 버튼 이벤트
  if (aiSendBtn && aiInputEl) {
    aiSendBtn.addEventListener("click", sendAIMessage);

    // Enter 키로 전송
    aiInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage();
      }
    });

    // 자동 높이 조절
    aiInputEl.addEventListener("input", () => {
      autoResize(aiInputEl);
    });
  }
}

// 페이지 로드 시 초기화
window.addEventListener("load", initAIChat);
