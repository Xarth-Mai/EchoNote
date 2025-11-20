//! OpenAI API client helpers.

use once_cell::sync::Lazy;
use reqwest::StatusCode;
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
pub struct OpenAiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAiChatRequest {
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub messages: Vec<OpenAiMessage>,
    #[serde(default, rename = "temperature")]
    pub temperature: Option<f32>,
    #[serde(default, rename = "maxTokens")]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenAiChatResult {
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

pub async fn invoke_provider_chat(
    provider_id: &str,
    request: OpenAiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<OpenAiChatResult, String> {
    match resolve_provider_kind(provider_id) {
        ProviderKind::OpenAiCompatible => {
            invoke_chat_completion(request, model, api_key, api_base).await
        }
        ProviderKind::Gemini => invoke_gemini_completion(request, model, api_key, api_base).await,
        ProviderKind::Claude => invoke_claude_completion(request, model, api_key, api_base).await,
    }
}

pub async fn list_provider_models(
    provider_id: &str,
    api_base: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    match resolve_provider_kind(provider_id) {
        ProviderKind::OpenAiCompatible => list_models(api_base, api_key).await,
        ProviderKind::Gemini => list_gemini_models(api_base, api_key).await,
        ProviderKind::Claude => list_claude_models(api_base, api_key).await,
    }
}

#[derive(Debug, Serialize)]
struct ChatCompletionPayload {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(rename = "max_tokens", skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormatPayload>,
}

#[derive(Debug, Serialize)]
struct ResponseFormatPayload {
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatCompletionChoice>,
    model: Option<String>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
    message: ChoiceMessage,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    #[serde(rename = "prompt_tokens")]
    prompt_tokens: Option<u32>,
    #[serde(rename = "completion_tokens")]
    completion_tokens: Option<u32>,
    #[serde(rename = "total_tokens")]
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorWrapper {
    error: OpenAiErrorBody,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorBody {
    message: String,
    #[serde(rename = "type")]
    kind: Option<String>,
    code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelListResponse {
    data: Vec<ModelDescription>,
}

#[derive(Debug, Deserialize)]
struct ModelDescription {
    id: String,
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

pub async fn invoke_chat_completion(
    request: OpenAiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<OpenAiChatResult, String> {
    if request.messages.is_empty() {
        return Err("OpenAI request must contain at least one message".to_string());
    }

    let endpoint = format!("{}/chat/completions", api_base.trim_end_matches('/'));

    let payload = ChatCompletionPayload {
        model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        response_format: Some(ResponseFormatPayload {
            kind: "json_object".to_string(),
        }),
    };

    let response = HTTP_CLIENT
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("failed to reach OpenAI API: {err}"))?;

    handle_response(response).await
}

pub async fn list_models(api_base: &str, api_key: &str) -> Result<Vec<String>, String> {
    let endpoint = format!("{}/models", api_base.trim_end_matches('/'));
    let response = HTTP_CLIENT
        .get(endpoint)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|err| format!("failed to reach OpenAI API: {err}"))?;
    handle_model_list_response(response).await
}

async fn invoke_gemini_completion(
    request: OpenAiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<OpenAiChatResult, String> {
    if request.messages.is_empty() {
        return Err("OpenAI request must contain at least one message".to_string());
    }

    let (system_messages, conversation): (Vec<_>, Vec<_>) = request
        .messages
        .into_iter()
        .partition(|msg| msg.role.eq_ignore_ascii_case("system"));
    let system_instruction = if system_messages.is_empty() {
        None
    } else {
        let text = system_messages
            .into_iter()
            .map(|msg| msg.content)
            .collect::<Vec<_>>()
            .join("\n\n");
        Some(GeminiContent {
            role: None,
            parts: vec![GeminiPart { text }],
        })
    };

    let mut contents: Vec<GeminiContent> = Vec::new();
    for msg in conversation {
        let role = if msg.role.eq_ignore_ascii_case("assistant") {
            "model"
        } else {
            "user"
        };
        contents.push(GeminiContent {
            role: Some(role.to_string()),
            parts: vec![GeminiPart { text: msg.content }],
        });
    }

    if contents.is_empty() {
        return Err("Gemini request must contain at least one user message".to_string());
    }

    let payload = GeminiPayload {
        contents,
        system_instruction,
        generation_config: Some(GeminiGenerationConfig {
            temperature: request.temperature,
            max_output_tokens: request.max_tokens,
        }),
    };

    let endpoint = format!(
        "{}/v1beta/models/{}:generateContent",
        api_base.trim_end_matches('/'),
        model
    );
    let response = HTTP_CLIENT
        .post(endpoint)
        .query(&[("key", api_key)])
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("failed to reach Gemini API: {err}"))?;

    handle_gemini_response(response).await
}

pub async fn list_gemini_models(api_base: &str, api_key: &str) -> Result<Vec<String>, String> {
    let endpoint = format!("{}/v1beta/models", api_base.trim_end_matches('/'));
    let response = HTTP_CLIENT
        .get(endpoint)
        .query(&[("key", api_key)])
        .send()
        .await
        .map_err(|err| format!("failed to reach Gemini API: {err}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(format!("Gemini API error (status {}): {}", status, text));
    }

    let payload: GeminiModelList = response
        .json()
        .await
        .map_err(|err| format!("failed to decode Gemini response: {err}"))?;
    let mut models = payload
        .models
        .unwrap_or_default()
        .into_iter()
        .map(|model| {
            model
                .name
                .split('/')
                .last()
                .unwrap_or(&model.name)
                .to_string()
        })
        .collect::<Vec<_>>();
    models.sort();
    Ok(models)
}

async fn invoke_claude_completion(
    request: OpenAiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<OpenAiChatResult, String> {
    if request.messages.is_empty() {
        return Err("OpenAI request must contain at least one message".to_string());
    }

    let (system_messages, conversation): (Vec<_>, Vec<_>) = request
        .messages
        .into_iter()
        .partition(|msg| msg.role.eq_ignore_ascii_case("system"));
    let system = if system_messages.is_empty() {
        None
    } else {
        Some(
            system_messages
                .into_iter()
                .map(|msg| msg.content)
                .collect::<Vec<_>>()
                .join("\n\n"),
        )
    };

    let mut messages: Vec<AnthropicMessage> = Vec::new();
    for msg in conversation {
        let role = if msg.role.eq_ignore_ascii_case("assistant") {
            "assistant"
        } else {
            "user"
        };
        messages.push(AnthropicMessage {
            role: role.to_string(),
            content: msg.content,
        });
    }

    if messages.is_empty() {
        return Err("Claude request must contain at least one user message".to_string());
    }

    let max_tokens = request.max_tokens.unwrap_or(1024).max(1);
    let payload = AnthropicMessagePayload {
        model,
        messages,
        max_tokens,
        temperature: request.temperature,
        system,
    };

    let endpoint = format!("{}/v1/messages", api_base.trim_end_matches('/'));
    let response = HTTP_CLIENT
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("failed to reach Claude API: {err}"))?;

    handle_claude_response(response).await
}

pub async fn list_claude_models(api_base: &str, api_key: &str) -> Result<Vec<String>, String> {
    let endpoint = format!("{}/v1/models", api_base.trim_end_matches('/'));
    let response = HTTP_CLIENT
        .get(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|err| format!("failed to reach Claude API: {err}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(format!("Claude API error (status {}): {}", status, text));
    }

    let payload: AnthropicModelList = response
        .json()
        .await
        .map_err(|err| format!("failed to decode Claude response: {err}"))?;
    let mut models = payload
        .data
        .into_iter()
        .map(|entry| entry.id)
        .collect::<Vec<_>>();
    models.sort();
    Ok(models)
}

#[derive(Debug, Serialize)]
struct GeminiPayload {
    contents: Vec<GeminiContent>,
    #[serde(rename = "system_instruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiContent>,
    #[serde(rename = "generationConfig", skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Serialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(rename = "maxOutputTokens", skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GeminiGenerateResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    #[serde(rename = "usageMetadata")]
    usage: Option<GeminiUsage>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiCandidatePart>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidatePart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiUsage {
    #[serde(rename = "promptTokenCount")]
    prompt_tokens: Option<u32>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_tokens: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    total_tokens: Option<u32>,
}

async fn handle_gemini_response(response: reqwest::Response) -> Result<OpenAiChatResult, String> {
    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(format!("Gemini API error (status {}): {}", status, text));
    }

    let parsed: GeminiGenerateResponse = response
        .json()
        .await
        .map_err(|err| format!("failed to decode Gemini response: {err}"))?;

    let candidate_text = parsed
        .candidates
        .and_then(|mut list| list.pop())
        .and_then(|candidate| {
            candidate
                .content
                .parts
                .into_iter()
                .find_map(|part| part.text)
                .map(|text| (text, candidate.finish_reason))
        })
        .ok_or_else(|| "Gemini API returned no completion candidates".to_string())?;

    let (content, finish_reason) = candidate_text;
    Ok(OpenAiChatResult {
        content,
        finish_reason,
        model: None,
        prompt_tokens: parsed.usage.as_ref().and_then(|u| u.prompt_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|u| u.candidates_tokens),
        total_tokens: parsed.usage.as_ref().and_then(|u| u.total_tokens),
    })
}

#[derive(Debug, Serialize)]
struct AnthropicMessagePayload {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(rename = "max_tokens")]
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessageResponse {
    content: Vec<AnthropicContentBlock>,
    #[serde(rename = "stop_reason")]
    stop_reason: Option<String>,
    model: Option<String>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    #[serde(rename = "input_tokens")]
    input_tokens: Option<u32>,
    #[serde(rename = "output_tokens")]
    output_tokens: Option<u32>,
    #[serde(rename = "total_tokens")]
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModelList {
    data: Vec<AnthropicModelEntry>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModelEntry {
    id: String,
}

async fn handle_claude_response(response: reqwest::Response) -> Result<OpenAiChatResult, String> {
    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(format!("Claude API error (status {}): {}", status, text));
    }

    let parsed: AnthropicMessageResponse = response
        .json()
        .await
        .map_err(|err| format!("failed to decode Claude response: {err}"))?;

    let content = parsed
        .content
        .into_iter()
        .find_map(|block| block.text)
        .unwrap_or_default();
    let total_tokens = parsed
        .usage
        .as_ref()
        .and_then(|usage| usage.total_tokens)
        .or_else(|| {
            parsed
                .usage
                .as_ref()
                .and_then(|usage| usage.input_tokens)
                .zip(parsed.usage.as_ref().and_then(|usage| usage.output_tokens))
                .map(|(input, output)| input + output)
        });

    Ok(OpenAiChatResult {
        content,
        finish_reason: parsed.stop_reason,
        model: parsed.model,
        prompt_tokens: parsed.usage.as_ref().and_then(|u| u.input_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|u| u.output_tokens),
        total_tokens,
    })
}

async fn handle_response(response: reqwest::Response) -> Result<OpenAiChatResult, String> {
    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(decode_error(status, &text));
    }

    let parsed: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|err| format!("failed to decode OpenAI response: {err}"))?;

    let mut choices = parsed.choices.into_iter();
    let first_choice = choices
        .next()
        .ok_or_else(|| "OpenAI API returned no completion choices".to_string())?;

    Ok(OpenAiChatResult {
        content: first_choice.message.content,
        finish_reason: first_choice.finish_reason,
        model: parsed.model,
        prompt_tokens: parsed.usage.as_ref().and_then(|u| u.prompt_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|u| u.completion_tokens),
        total_tokens: parsed.usage.as_ref().and_then(|u| u.total_tokens),
    })
}

async fn handle_model_list_response(response: reqwest::Response) -> Result<Vec<String>, String> {
    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(decode_error(status, &text));
    }

    let payload: ModelListResponse = response
        .json()
        .await
        .map_err(|err| format!("failed to decode OpenAI response: {err}"))?;

    let mut models = payload
        .data
        .into_iter()
        .map(|model| model.id)
        .collect::<Vec<_>>();
    models.sort();
    Ok(models)
}

fn decode_error(status: StatusCode, payload: &str) -> String {
    if let Ok(wrapper) = serde_json::from_str::<OpenAiErrorWrapper>(payload) {
        let mut message = format!("OpenAI API error: {}", wrapper.error.message);
        if let Some(code) = wrapper.error.code {
            message.push_str(&format!(" (code: {code})"));
        }
        if let Some(kind) = wrapper.error.kind {
            message.push_str(&format!(" [{kind}]"));
        }
        return message;
    }

    format!("OpenAI API error (status {}): {}", status, payload)
}
