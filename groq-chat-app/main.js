import Groq from "groq-sdk";
import { v4 as uuidv4 } from "uuid";

const groq = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY });

const app = document.getElementById("app");

// Create chat container
const chatContainer = document.createElement("div");
chatContainer.className = "flex-1 overflow-y-auto p-4 space-y-4 bg-white rounded shadow";
app.appendChild(chatContainer);

// Create input container
const inputContainer = document.createElement("div");
inputContainer.className = "mt-4 flex items-center space-x-2";
app.appendChild(inputContainer);

// Create textarea for user input
const textarea = document.createElement("textarea");
textarea.className = "flex-1 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500";
textarea.rows = 2;
textarea.placeholder = "Type your message...";
inputContainer.appendChild(textarea);

// Create send button
const sendButton = document.createElement("button");
sendButton.className = "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
sendButton.textContent = "Send";
sendButton.disabled = true;
inputContainer.appendChild(sendButton);

// Create clear history button
const clearButton = document.createElement("button");
clearButton.className = "bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700";
clearButton.textContent = "Clear History";
inputContainer.appendChild(clearButton);

// Loading indicator
const loadingIndicator = document.createElement("div");
loadingIndicator.className = "text-gray-500 italic";
loadingIndicator.textContent = "Loading...";
loadingIndicator.style.display = "none";
app.appendChild(loadingIndicator);

// Utility: escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Utility: detect code blocks and language
function parseMessageContent(content) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  const parts = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.substring(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "plaintext", content: match[2] });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.substring(lastIndex) });
  }
  return parts;
}

// Render a single message
function renderMessage(message) {
  const messageDiv = document.createElement("div");
  messageDiv.className = message.role === "user" ? "text-right" : "text-left";

  const bubble = document.createElement("div");
  bubble.className =
    message.role === "user"
      ? "inline-block bg-blue-600 text-white p-3 rounded-lg max-w-[70%] whitespace-pre-wrap"
      : "inline-block bg-gray-200 text-gray-900 p-3 rounded-lg max-w-[70%] whitespace-pre-wrap";

  // Parse content for code blocks
  const parts = parseMessageContent(message.content);

  parts.forEach((part) => {
    if (part.type === "text") {
      const span = document.createElement("span");
      span.innerHTML = escapeHtml(part.content);
      bubble.appendChild(span);
    } else if (part.type === "code") {
      const pre = document.createElement("pre");
      pre.className = "rounded bg-gray-900 text-white p-2 my-2 overflow-x-auto relative";

      const code = document.createElement("code");
      code.className = `language-${part.lang}`;
      code.textContent = part.content;
      pre.appendChild(code);

      // Copy button for code block
      const copyBtn = document.createElement("button");
      copyBtn.className = "absolute top-1 right-1 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(part.content).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
        });
      });
      pre.appendChild(copyBtn);

      bubble.appendChild(pre);

      // Highlight code using Prism if available
      if (window.Prism) {
        window.Prism.highlightElement(code);
      }
    }
  });

  // Copy button for entire message
  const copyMessageBtn = document.createElement("button");
  copyMessageBtn.className = "ml-2 text-sm text-blue-500 hover:underline";
  copyMessageBtn.textContent = "Copy";
  copyMessageBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(message.content).then(() => {
      copyMessageBtn.textContent = "Copied!";
      setTimeout(() => (copyMessageBtn.textContent = "Copy"), 2000);
    });
  });

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(copyMessageBtn);

  return messageDiv;
}

// Load chat history from localStorage
function loadChatHistory() {
  const history = localStorage.getItem("groqChatHistory");
  if (history) {
    try {
      return JSON.parse(history);
    } catch {
      return [];
    }
  }
  return [];
}

// Save chat history to localStorage
function saveChatHistory(history) {
  localStorage.setItem("groqChatHistory", JSON.stringify(history));
}

// Render chat history
function renderChatHistory(history) {
  chatContainer.innerHTML = "";
  history.forEach((msg) => {
    const msgElem = renderMessage(msg);
    chatContainer.appendChild(msgElem);
  });
  scrollToBottom();
}

// Scroll to bottom of chat
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Send message to Groq API
async function sendMessage(content) {
  loadingIndicator.style.display = "block";
  sendButton.disabled = true;
  textarea.disabled = true;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content }],
    });
    const aiMessage = response.choices[0]?.message;
    return aiMessage;
  } catch (error) {
    console.error("Error from Groq API:", error);
    return { role: "assistant", content: "Error: Unable to get response from Groq API." };
  } finally {
    loadingIndicator.style.display = "none";
    sendButton.disabled = false;
    textarea.disabled = false;
  }
}

// Initialize app
async function init() {
  let chatHistory = loadChatHistory();
  renderChatHistory(chatHistory);

  textarea.addEventListener("input", () => {
    sendButton.disabled = textarea.value.trim() === "";
  });

  sendButton.addEventListener("click", async () => {
    const userMessage = textarea.value.trim();
    if (!userMessage) return;

    // Add user message to history and render
    chatHistory.push({ id: uuidv4(), role: "user", content: userMessage });
    renderChatHistory(chatHistory);
    saveChatHistory(chatHistory);
    textarea.value = "";
    sendButton.disabled = true;

    // Send to Groq API and get response
    const aiMessage = await sendMessage(userMessage);
    if (aiMessage) {
      chatHistory.push({ id: uuidv4(), role: aiMessage.role, content: aiMessage.content });
      renderChatHistory(chatHistory);
      saveChatHistory(chatHistory);
    }
  });

  clearButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      chatHistory = [];
      saveChatHistory(chatHistory);
      renderChatHistory(chatHistory);
    }
  });
}

init();
