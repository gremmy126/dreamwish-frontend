// frontend/dashboard/app.js

const API_BASE = "http://localhost:8000"; // FastAPI 서버 주소

// 전역 상태
let currentChannel = "all"; // 현재 선택된 채널

function getToken() {
  return localStorage.getItem("dw_token");
}

function getAgentId() {
  return localStorage.getItem("dw_agent_id");
}

function getRole() {
  return localStorage.getItem("dw_role");
}

function logoutAndGoLogin() {
  localStorage.removeItem("dw_token");
  localStorage.removeItem("dw_agent_id");
  localStorage.removeItem("dw_role");
  window.location.href = "./login.html";
}

// 현재 로그인한 유저 정보 가져오기 (/auth/me)
async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;
  return await res.json(); // {id, email, name, role, is_active}
}

// ====== 채팅 UI 관련 ======
let messagesContainer;
let inputEl;
let sendBtn;
let ws = null;
let currentConversationId = null;
let conversationListEl;

// 알림 내역 저장 배열
let notifications = [];

// 스크롤을 맨 아래로
function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// 메시지 하나를 화면에 추가 (기본)
function appendMessage(text, senderType = "customer") {
  appendMessageWithDetails(text, senderType);
}

// 메시지 상세 정보와 함께 추가
function appendMessageWithDetails(text, senderType = "customer", timestamp = null, senderName = null, profileImage = null) {
  if (!messagesContainer) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${senderType}`;

  // 아바타
  const avatar = document.createElement("div");
  avatar.className = `avatar ${senderType}`;
  
  // 프로필 이미지가 있으면 이미지 사용, 없으면 텍스트
  if (profileImage) {
    const img = document.createElement("img");
    img.src = profileImage;
    img.alt = senderName || "프로필";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "50%";
    avatar.appendChild(img);
  } else {
    // 아바타 텍스트 결정
    let avatarText = "?";
    if (senderName) {
      avatarText = senderName.charAt(0).toUpperCase();
    } else if (senderType === "customer") {
      avatarText = "고객";
    } else if (senderType === "agent") {
      avatarText = "상담원";
    } else if (senderType === "bot") {
      avatarText = "🤖";
    }
    avatar.textContent = avatarText;
  }

  // 메시지 콘텐츠 래퍼
  const contentWrapper = document.createElement("div");
  
  // 발신자 이름 표시 (모든 메시지 타입)
  if (senderName) {
    const nameDiv = document.createElement("div");
    nameDiv.className = "message-sender-name";
    nameDiv.textContent = senderName;
    contentWrapper.appendChild(nameDiv);
  }
  
  // 말풍선
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  contentWrapper.appendChild(bubble);

  // 타임스탬프
  if (timestamp) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    const date = new Date(timestamp);
    timeDiv.textContent = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    contentWrapper.appendChild(timeDiv);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentWrapper);
  messagesContainer.appendChild(messageDiv);

  // 스크롤 맨 아래로
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// WebSocket 연결
function connectWebSocket(agentId) {
  if (!agentId) {
    console.error("❌ agentId가 없어서 WebSocket 연결 실패");
    return;
  }

  // 기존 연결이 있으면 닫기
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("⚠️ 기존 WebSocket 연결 종료 중...");
    ws.close();
  }

  console.log("🔌 WebSocket 연결 시작:", agentId);
  ws = new WebSocket(`ws://localhost:8000/ws/agent/${agentId}`);

  ws.onopen = () => {
    console.log("✅ WebSocket 연결 성공!");
    // 시스템 메시지는 제거 (UI 깔끔하게)
  };

  ws.onmessage = (event) => {
    console.log("📨 새 메시지:", event.data);

    try {
      const payload = JSON.parse(event.data);
      const msgType = payload.type;

      if (msgType === "new_customer_message") {
        // 고객이 새 메시지를 보냄
        console.log("🔔 고객 메시지 도착:", payload);
        handleNewCustomerMessage(payload);
      } else if (msgType === "agent_reply_sent") {
        // 상담원이 답장을 보냄 (자신 또는 다른 상담원)
        console.log("💬 상담원 답장:", payload);
        handleAgentReply(payload);
      } else if (msgType === "conversation_updated") {
        // 대화방 업데이트
        console.log("🔄 대화방 업데이트:", payload);
        loadConversations(currentChannel);
        if (currentConversationId === payload.conversation_id) {
          loadMessagesForConversation(currentConversationId);
        }
      }
    } catch (err) {
      console.error("❌ 메시지 파싱 오류:", err);
    }
  };

  ws.onclose = (event) => {
    console.log("🔌 WebSocket 연결 종료 - Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
    // 정상 종료가 아닌 경우만 재연결
    if (!event.wasClean) {
      setTimeout(() => {
        console.log("🔄 WebSocket 재연결 시도...");
        connectWebSocket(agentId);
      }, 3000);
    }
  };

  ws.onerror = (err) => {
    console.error("❌ WebSocket 에러:", err);
  };

  window.dwSocket = ws;
}

// 고객 새 메시지 처리
function handleNewCustomerMessage(payload) {
  console.log("✅ 고객 메시지 처리:", payload);
  
  // 대화방 목록 새로고침
  loadConversations(currentChannel);

  // 현재 보고 있는 대화방이면 메시지 즉시 추가
  if (currentConversationId === payload.conversation_id) {
    const msg = payload.message;
    if (msg) {
      appendMessageWithDetails(
        msg.content, 
        "customer", 
        msg.created_at,
        payload.customer_name || '고객',
        payload.profile_image || null
      );
      scrollToBottom();
    }
  } else {
    // 다른 대화방이면 알림 표시
    const senderName = payload.customer_name || '고객';
    const messageContent = payload.message?.content || "새 메시지가 도착했습니다";
    const messagePreview = messageContent.length > 50 
      ? messageContent.substring(0, 50) + '...' 
      : messageContent;
    showNotification(
      `${senderName}님의 새 메시지`,
      messagePreview,
      payload.conversation_id
    );
  }
}

// 상담원 답장 처리
function handleAgentReply(payload) {
  console.log("✅ 상담원 답장 처리:", payload);
  
  // 대화방 목록 새로고침
  loadConversations(currentChannel);

  // 현재 보고 있는 대화방이면 메시지 즉시 추가
  if (currentConversationId === payload.conversation_id) {
    const msg = payload.message;
    if (msg && msg.sender_type === "agent") {
      // 자신의 메시지가 아닌 경우에만 추가 (중복 방지)
      const agentId = getAgentId();
      if (!msg.sender_id || msg.sender_id !== parseInt(agentId)) {
        appendMessageWithDetails(msg.content, "agent", msg.created_at, msg.sender_name);
      }
    }
  }
}

// 브라우저 알림 권한 요청
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log("❌ 이 브라우저는 알림을 지원하지 않습니다.");
    return;
  }
  
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log("✅ 알림 권한 승인됨");
        // 테스트 알림 표시
        new Notification("Dream Wish 상담", {
          body: "실시간 알림이 활성화되었습니다! 🔔",
          icon: "/favicon.ico",
          badge: "/favicon.ico"
        });
      } else {
        console.log("⚠️ 알림 권한 거부됨");
      }
    });
  } else if (Notification.permission === 'granted') {
    console.log("✅ 알림 권한 이미 승인됨");
  }
}

// 브라우저 알림 표시
function showNotification(title, body, conversationId = null) {
  if (!('Notification' in window)) return;
  
  // 알림 내역에 추가
  const notificationItem = {
    id: Date.now(),
    title,
    body,
    conversationId,
    timestamp: new Date().toISOString(),
    read: false
  };
  notifications.unshift(notificationItem);
  
  // 알림 내역 UI 업데이트
  updateNotificationPanel();
  
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, { 
      body, 
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: conversationId ? `conv-${conversationId}` : 'general',
      requireInteraction: false,
      silent: false
    });
    
    // 알림 클릭 시 해당 대화방으로 이동
    notification.onclick = function(event) {
      event.preventDefault();
      window.focus();
      if (conversationId) {
        // 대화방 선택
        const convItem = document.querySelector(`[data-id="${conversationId}"]`);
        if (convItem) {
          convItem.click();
        }
      }
      notification.close();
    };
    
    // 5초 후 자동 닫기
    setTimeout(() => notification.close(), 5000);
  }
}

// 채팅 전송 (REST API 사용)
async function sendChatMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  
  if (!currentConversationId) {
    alert("먼저 대화방을 선택해주세요.");
    return;
  }

  const token = getToken();
  if (!token) {
    alert("로그인이 필요합니다.");
    return;
  }

  // 버튼 비활성화
  if (sendBtn) sendBtn.disabled = true;

  try {
    // REST API로 메시지 전송
    const res = await fetch(`${API_BASE}/api/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: currentConversationId,
        message: text,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "메시지 전송 실패");
    }

    const result = await res.json();
    console.log("✅ 메시지 전송 완료:", result);

    // UI에 즉시 메시지 추가
    appendMessageWithDetails(text, "agent", new Date().toISOString());
    inputEl.value = "";
    
    // 대화 목록 업데이트
    loadConversations(currentChannel);

  } catch (err) {
    console.error("❌ 메시지 전송 오류:", err);
    alert(`메시지 전송 실패: ${err.message}`);
  } finally {
    // 버튼 다시 활성화
    if (sendBtn) sendBtn.disabled = false;
  }
}

// 특정 대화방의 메시지만 로드
async function loadMessagesForConversation(conversationId) {
  const token = getToken();
  if (!token) return;

  const res = await fetch(
    `${API_BASE}/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    console.warn("메시지 불러오기 실패");
    return;
  }

  const messages = await res.json();

  if (!messagesContainer) return;
  messagesContainer.innerHTML = "";

  messages.forEach((m) => {
    appendMessageWithDetails(m.content, m.sender_type, m.created_at, m.sender_name);
  });
}

// ====== 대화방 / 메시지 로딩 ======

// 대화방 목록 읽어오기
async function loadConversations(channel = null) {
  const token = getToken();
  if (!token) return;

  // 채널 파라미터 추가
  let url = `${API_BASE}/conversations`;
  if (channel && channel !== "all") {
    url += `?channel=${encodeURIComponent(channel)}`;
  }

  console.log("🔄 대화 목록 로딩 중...", url);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    console.warn("❌ 대화방 목록 불러오기 실패");
    return;
  }

  const conversations = await res.json(); // [{id, customer_id, ...}]
  console.log("✅ 대화 목록 받음:", conversations);
  console.log("🔍 conversationListEl 상태:", conversationListEl);

  if (!conversationListEl) {
    console.error("❌ conversationListEl이 없습니다!");
    console.error("❌ document.getElementById('conversation-list'):", document.getElementById("conversation-list"));
    return;
  }

  console.log("✅ conversationListEl 존재 확인, innerHTML 초기화 중...");
  conversationListEl.innerHTML = "";

  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.className = "chat-list-empty";
    empty.textContent = "아직 대화방이 없습니다.";
    conversationListEl.appendChild(empty);
    console.log("ℹ️ 대화방이 없음");
    return;
  }

  console.log(`📋 ${conversations.length}개 대화방 렌더링 중...`);

  conversations.forEach((conv) => {
    try {
      const item = document.createElement("div");
      item.className = "conversation-item";
      item.dataset.id = conv.id;

      // 채널 아이콘
      const channelIcon = getChannelIcon(conv.channel_type);
      const channelLabel = getChannelLabel(conv.channel_type);

      // 왼쪽 콘텐츠 영역
      const contentDiv = document.createElement("div");
      contentDiv.className = "conversation-content";

      const title = document.createElement("div");
      title.className = "conversation-title";
      title.textContent = `${channelIcon} ${conv.profile_name || `손님 #${conv.id}`}`;

      const sub = document.createElement("div");
      sub.className = "conversation-sub";
      sub.textContent = `[${channelLabel}] ${conv.last_message || "메시지 없음"}`;

      contentDiv.appendChild(title);
      contentDiv.appendChild(sub);

      // 삭제 버튼
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-conversation-btn";
      deleteBtn.innerHTML = "×";
      deleteBtn.title = "대화방 삭제";
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm("이 대화방을 삭제하시겠습니까?")) {
          await deleteConversation(conv.id);
          loadConversations(currentChannel);
          if (currentConversationId === conv.id) {
            currentConversationId = null;
            if (messagesContainer) messagesContainer.innerHTML = "";
          }
        }
      };

      item.appendChild(contentDiv);
      item.appendChild(deleteBtn);

      item.addEventListener("click", () => {
        selectConversation(conv.id, item);
      });

      conversationListEl.appendChild(item);
    } catch (err) {
      console.error("❌ 대화방 렌더링 에러:", err, conv);
    }
  });

  console.log("✅ 대화 목록 렌더링 완료");
}

// 채널 타입별 아이콘 반환
function getChannelIcon(channelType) {
  const icons = {
    kakao: "💬",
    instagram: "📷",
    facebook: "📘",
    widget: "🌐",
  };
  return icons[channelType] || "💬";
}

// 채널 타입별 라벨 반환
function getChannelLabel(channelType) {
  const labels = {
    kakao: "카카오톡",
    instagram: "인스타그램",
    facebook: "페이스북",
    widget: "웹 위젯",
  };
  return labels[channelType] || channelType;
}

// 대화방 선택했을 때
async function selectConversation(conversationId, clickedItem) {
  currentConversationId = conversationId;

  // 선택된 아이템 강조
  document
    .querySelectorAll(".conversation-item")
    .forEach((el) => el.classList.remove("active"));
  if (clickedItem) clickedItem.classList.add("active");

  // 메시지 불러오기
  const token = getToken();
  if (!token) return;

  const res = await fetch(
    `${API_BASE}/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    console.warn("메시지 불러오기 실패");
    return;
  }

  const messages = await res.json(); // [{content, sender_type, ...}]

  if (!messagesContainer) return;
  messagesContainer.innerHTML = "";

  messages.forEach((m) => {
    appendMessageWithDetails(
      m.content, 
      m.sender_type, 
      m.created_at, 
      m.sender_name || (m.sender_type === 'customer' ? '고객' : m.sender_type === 'agent' ? '상담원' : 'AI'),
      m.profile_image || null
    );
  });

  // 대화방 정보로 고객 정보 로드
  await loadConversationAndCustomer(conversationId);
}

// 대화방 정보 + 고객 정보 로드
async function loadConversationAndCustomer(conversationId) {
  const token = getToken();
  if (!token) return;

  // 1. 대화방 상세 정보 조회
  const convRes = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!convRes.ok) {
    console.warn("대화방 정보 불러오기 실패");
    return;
  }

  const conversation = await convRes.json();
  const customerId = conversation.customer_id;

  if (!customerId) {
    hideCustomerPanel();
    return;
  }

  // 2. 고객 정보 조회
  const custRes = await fetch(`${API_BASE}/customers/${customerId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!custRes.ok) {
    console.warn("고객 정보 불러오기 실패");
    hideCustomerPanel();
    return;
  }

  const customer = await custRes.json();
  displayCustomerInfo(customer);
}

// 고객 정보 패널에 데이터 표시
function displayCustomerInfo(customer) {
  const panel = document.getElementById("customer-panel");
  if (!panel) return;

  panel.classList.add("show");

  // 프로필 이미지
  const avatar = document.getElementById("customer-avatar");
  if (avatar) {
    if (customer.profile_image) {
      avatar.innerHTML = `<img src="${customer.profile_image}" alt="프로필" />`;
    } else {
      avatar.innerHTML = "👤";
    }
  }

  // 이름
  const nameEl = document.getElementById("customer-name");
  if (nameEl) {
    nameEl.textContent = customer.name || customer.external_id || "고객";
  }

  // 플랫폼
  const platformEl = document.getElementById("customer-platform");
  if (platformEl) {
    const platformMap = {
      kakao: "카카오톡",
      instagram: "인스타그램",
      facebook: "페이스북",
      widget: "웹 위젯",
      email: "이메일"
    };
    platformEl.textContent = platformMap[customer.platform] || customer.platform;
  }

  // External ID (고객 ID)
  const externalIdEl = document.getElementById("customer-external-id");
  if (externalIdEl) {
    externalIdEl.textContent = customer.external_id || "-";
  }

  // 전화번호
  const phoneEl = document.getElementById("customer-phone");
  if (phoneEl) {
    phoneEl.textContent = customer.phone || "-";
  }

  // 성별
  const genderEl = document.getElementById("customer-gender");
  if (genderEl) {
    genderEl.textContent = customer.gender || "-";
  }

  // 연령대
  const ageEl = document.getElementById("customer-age");
  if (ageEl) {
    ageEl.textContent = customer.age || "-";
  }

  // 태그
  const tagsContainer = document.getElementById("customer-tags");
  if (tagsContainer) {
    tagsContainer.innerHTML = "";
    if (customer.tags) {
      const tags = customer.tags.split(",").map((t) => t.trim()).filter(Boolean);
      tags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "customer-tag";
        tagEl.textContent = tag;
        tagsContainer.appendChild(tagEl);
      });
    }
  }

  // 메모
  const memoEl = document.getElementById("customer-memo");
  if (memoEl) {
    memoEl.value = customer.memo || "";
    memoEl.dataset.customerId = customer.id;
  }
}

// 고객 정보 패널 숨기기
function hideCustomerPanel() {
  const panel = document.getElementById("customer-panel");
  if (panel) {
    panel.classList.remove("show");
  }
}

// 고객 메모 저장
async function saveCustomerMemo() {
  const memoEl = document.getElementById("customer-memo");
  if (!memoEl) return;

  const customerId = memoEl.dataset.customerId;
  const memo = memoEl.value.trim();

  if (!customerId) {
    alert("고객 정보를 불러올 수 없습니다.");
    return;
  }

  const token = getToken();
  if (!token) return;

  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memo }),
  });

  if (res.ok) {
    alert("메모가 저장되었습니다.");
  } else {
    alert("메모 저장에 실패했습니다.");
  }
}

// 상담 연결
async function connectConversation() {
  if (!currentConversationId) {
    alert("대화방을 먼저 선택해주세요.");
    return;
  }

  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${currentConversationId}/connect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("상담 연결 실패");
    }

    const result = await res.json();
    
    // 시스템 메시지 추가
    appendMessageWithDetails(
      result.message || "✅ 상담이 연결되었습니다.",
      "system",
      new Date().toISOString(),
      "시스템",
      null
    );
    
    // 대화방 목록 새로고침
    loadConversations(currentChannel);
    
    alert("상담이 연결되었습니다!");
  } catch (err) {
    console.error("상담 연결 오류:", err);
    alert("상담 연결에 실패했습니다.");
  }
}

// 상담 종료
async function endConversation() {
  if (!currentConversationId) {
    alert("대화방을 먼저 선택해주세요.");
    return;
  }

  if (!confirm("이 상담을 종료하시겠습니까?")) {
    return;
  }

  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${currentConversationId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("상담 종료 실패");
    }

    const result = await res.json();
    
    // 시스템 메시지 추가
    appendMessageWithDetails(
      "⭕ 상담이 종료되었습니다. 감사합니다!",
      "system",
      new Date().toISOString(),
      "시스템",
      null
    );
    
    // 대화방 목록 새로고침
    loadConversations(currentChannel);
    
    alert("상담이 종료되었습니다.");
  } catch (err) {
    console.error("상담 종료 오류:", err);
    alert("상담 종료에 실패했습니다.");
  }
}

// 관리자 전용: 팀원 목록 불러오기
async function loadUsersList() {
  const token = getToken();
  if (!token) return;

  const res = await fetch(`${API_BASE}/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    console.warn("loadUsersList 실패");
    return;
  }

  const users = await res.json(); // [{id, email, name, role, is_active}, ...]

  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td>${u.name || ""}</td>
      <td>${u.role}</td>
      <td>${u.is_active ? "활성" : "비활성"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 대시보드 초기화
async function initDashboard() {
  const token = getToken();
  if (!token) {
    // 토큰 없으면 로그인 페이지로
    window.location.href = "./login.html";
    return;
  }

  // 브라우저 알림 권한 요청
  requestNotificationPermission();

  // DOM 요소 캐싱
  messagesContainer = document.getElementById("chat-messages");
  inputEl = document.getElementById("chat-input");
  sendBtn = document.getElementById("chat-send-btn");
  conversationListEl = document.getElementById("conversation-list");

  console.log("🔍 DOM 요소 초기화:");
  console.log("  - messagesContainer:", messagesContainer);
  console.log("  - inputEl:", inputEl);
  console.log("  - sendBtn:", sendBtn);
  console.log("  - conversationListEl:", conversationListEl);

  if (!conversationListEl) {
    console.error("❌ conversationListEl을 찾을 수 없습니다!");
    console.error("❌ HTML에 id='conversation-list' 요소가 있는지 확인하세요!");
  }

  // 전송 이벤트 연결
  if (sendBtn && inputEl) {
    sendBtn.addEventListener("click", sendChatMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  const me = await fetchMe();
  if (!me) {
    // 토큰이 만료되었거나 유저를 못 찾은 경우
    logoutAndGoLogin();
    return;
  }

  console.log("현재 유저:", me);

  // 상단에 상담원 이름/역할 표시
  const nameEl = document.getElementById("agent-name");
  const roleEl = document.getElementById("agent-role");

  if (nameEl) nameEl.textContent = me.name || me.email;
  if (roleEl)
    roleEl.textContent = me.role === "admin" ? "관리자" : "상담원";

  // WebSocket 연결
  const agentId = getAgentId();
  if (agentId) {
    connectWebSocket(agentId);
  }

  // 대화방 목록 로딩
  await loadConversations(currentChannel);

  // 채널 탭 이벤트 연결
  setupChannelTabs();

  // 관리자면 admin-panel 보이게 하고 팀원 목록 로딩
  if (me.role === "admin") {
    const adminPanel = document.getElementById("admin-panel");
    if (adminPanel) {
      adminPanel.style.display = "block";
    }
    await loadUsersList();
  }
  
  // 팀원 초대 버튼은 모든 사용자에게 표시 (백엔드에서 권한 체크)
}

// 채널 탭 설정
function setupChannelTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const channel = btn.dataset.channel;
      currentChannel = channel;

      // 탭 활성화 상태 업데이트
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // 대화방 목록 다시 로드
      loadConversations(channel === "all" ? null : channel);

      // 현재 선택된 대화방 초기화
      currentConversationId = null;
      if (messagesContainer) {
        messagesContainer.innerHTML = "";
      }
      hideCustomerPanel();
    });
  });
}

// 대화방 삭제 함수
async function deleteConversation(conversationId) {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      alert("대화방 삭제에 실패했습니다.");
      return;
    }

    console.log("대화방 삭제 완료:", conversationId);
  } catch (error) {
    console.error("대화방 삭제 오류:", error);
    alert("대화방 삭제 중 오류가 발생했습니다.");
  }
}

// ====== 알림 센터 기능 ======

// 알림 패널 업데이트
function updateNotificationPanel() {
  const notificationList = document.getElementById("notification-list");
  const notificationCount = document.getElementById("notification-count");
  
  if (!notificationList) return;
  
  // 읽지 않은 알림 개수
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // 알림 뱃지 업데이트
  if (notificationCount) {
    if (unreadCount > 0) {
      notificationCount.textContent = unreadCount;
      notificationCount.classList.remove("hidden");
    } else {
      notificationCount.classList.add("hidden");
    }
  }
  
  // 알림 목록 렌더링
  if (notifications.length === 0) {
    notificationList.innerHTML = `
      <div class="notification-empty">
        표시할 알림이 없습니다.
      </div>
    `;
    return;
  }
  
  notificationList.innerHTML = notifications.map(notif => {
    const time = new Date(notif.timestamp);
    const timeStr = time.toLocaleString('ko-KR', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `
      <div class="notification-item ${notif.read ? '' : 'unread'}" 
           data-notification-id="${notif.id}" 
           data-conversation-id="${notif.conversationId || ''}">
        <div class="notification-title">${notif.title}</div>
        <div class="notification-body">${notif.body}</div>
        <div class="notification-time">${timeStr}</div>
      </div>
    `;
  }).join('');
  
  // 알림 아이템 클릭 이벤트
  notificationList.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => {
      const conversationId = item.dataset.conversationId;
      if (conversationId) {
        // 대화방으로 이동
        const convItem = document.querySelector(`[data-id="${conversationId}"]`);
        if (convItem) {
          convItem.click();
        }
        // 알림 패널 닫기
        document.getElementById("notification-panel").classList.add("hidden");
      }
    });
  });
}

// 모든 알림 읽음 처리
function markAllNotificationsAsRead() {
  notifications.forEach(n => n.read = true);
  updateNotificationPanel();
}

// 알림 전체 삭제
function clearAllNotifications() {
  if (confirm("모든 알림을 삭제하시겠습니까?")) {
    notifications = [];
    updateNotificationPanel();
  }
}

// 페이지 로드 시 initDashboard 실행
window.addEventListener("load", initDashboard);

// 로그아웃 버튼 이벤트
window.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutAndGoLogin);
  }

  // 고객 메모 저장 버튼
  const saveMemoBtn = document.getElementById("save-memo-btn");
  if (saveMemoBtn) {
    saveMemoBtn.addEventListener("click", saveCustomerMemo);
  }

  // 상담 연결 버튼
  const connectBtn = document.getElementById("connect-conversation-btn");
  if (connectBtn) {
    connectBtn.addEventListener("click", connectConversation);
  }

  // 상담 종료 버튼
  const endBtn = document.getElementById("end-conversation-btn");
  if (endBtn) {
    endBtn.addEventListener("click", endConversation);
  }

  // 알림 버튼 이벤트
  const notificationBtn = document.getElementById("notification-btn");
  const notificationPanel = document.getElementById("notification-panel");
  if (notificationBtn && notificationPanel) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationPanel.classList.toggle("hidden");
      // 패널이 열리면 모든 알림 읽음 처리
      if (!notificationPanel.classList.contains("hidden")) {
        markAllNotificationsAsRead();
      }
    });
  }

  // 알림 전체 삭제 버튼
  const clearNotificationsBtn = document.getElementById("clear-notifications");
  if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener("click", clearAllNotifications);
  }

  // 알림 패널 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    const notificationPanel = document.getElementById("notification-panel");
    const notificationBtn = document.getElementById("notification-btn");
    if (notificationPanel && !notificationPanel.contains(e.target) && e.target !== notificationBtn) {
      notificationPanel.classList.add("hidden");
    }
  });

  // 모든 버튼은 이미 index.html에 표시되어 있음
  // 관리자 전용 기능은 team.html에서 제어

  // 채널 탭 이벤트 연결 (즉시 실행)
  setupChannelTabs();
});
