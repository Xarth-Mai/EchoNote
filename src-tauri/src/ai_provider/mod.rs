//! AI provider clients: OpenAI-compatible, Gemini, and Claude.

mod claude;
mod gemini;
mod openai;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    // 复用单例 Client，避免重复创建连接池。
    reqwest::Client::builder()
        .user_agent("EchoNote/0.1")
        .build()
        .expect("failed to build reqwest client")
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProviderKind {
    OpenAiCompatible,
    Gemini,
    Claude,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatRequest {
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub messages: Vec<AiMessage>,
    #[serde(default, rename = "temperature")]
    pub temperature: Option<f32>,
    #[serde(default, rename = "maxTokens")]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiChatResult {
    pub content: String,
    #[serde(rename = "finishReason", skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(rename = "promptTokens", skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u32>,
    #[serde(rename = "completionTokens", skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u32>,
    #[serde(rename = "totalTokens", skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
}

pub async fn invoke_ai_chat(
    provider_id: &str,
    request: AiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<AiChatResult, String> {
    match resolve_provider_kind(provider_id) {
        ProviderKind::OpenAiCompatible => {
            openai::invoke_openai_completion(request, model, api_key, api_base).await
        }
        ProviderKind::Gemini => gemini::invoke_gemini_completion(request, model, api_key, api_base).await,
        ProviderKind::Claude => claude::invoke_claude_completion(request, model, api_key, api_base).await,
    }
}

pub async fn list_provider_models(
    provider_id: &str,
    api_base: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    match resolve_provider_kind(provider_id) {
        ProviderKind::OpenAiCompatible => openai::list_openai_models(api_base, api_key).await,
        ProviderKind::Gemini => gemini::list_gemini_models(api_base, api_key).await,
        ProviderKind::Claude => claude::list_claude_models(api_base, api_key).await,
    }
}

fn resolve_provider_kind(provider_id: &str) -> ProviderKind {
    if provider_id == "gemini" {
        return ProviderKind::Gemini;
    }
    if provider_id == "claude" {
        return ProviderKind::Claude;
    }
    ProviderKind::OpenAiCompatible
}
