// Experimental locators. Validate against current public UIs before enabling.
export const browserTargets = {
  copilot: {
    url: "https://copilot.microsoft.com/",
    inputRole: "textbox",
    inputName: /Message Copilot|Ask Copilot/i,
    answerRoles: ["article"] as const,
    answerTestId: "chat-message-assistant",
    stopName: /stop generating|stop response/i,
  },
  "google-ai": {
    url: "https://www.google.com/search?udm=50",
    inputRole: "textbox",
    inputName: /Ask anything|Search/i,
    answerRoles: ["article"] as const,
    answerTestId: "ai-response",
    stopName: /stop generating/i,
  },
};
