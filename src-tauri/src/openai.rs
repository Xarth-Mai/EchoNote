//! OpenAI API client helpers.

use once_cell::sync::Lazy;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("EchoNote/0.1")
        .build()
        .expect("failed to build reqwest client")
});

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

#[derive(Debug, Serialize)]
struct ChatCompletionPayload {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(rename = "max_tokens", skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
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
