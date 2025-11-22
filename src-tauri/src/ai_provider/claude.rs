use serde::{Deserialize, Serialize};

use super::{AiChatRequest, AiChatResult, HTTP_CLIENT};

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
    #[serde(skip_serializing_if = "Option::is_none", rename = "response_format")]
    response_format: Option<AnthropicResponseFormat>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct AnthropicResponseFormat {
    #[serde(rename = "type")]
    kind: String,
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

pub async fn invoke_claude_completion(
    request: AiChatRequest,
    model: String,
    api_key: &str,
    api_base: &str,
) -> Result<AiChatResult, String> {
    if request.messages.is_empty() {
        return Err("AI request must contain at least one message".to_string());
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
        response_format: Some(AnthropicResponseFormat {
            kind: "json_object".to_string(),
        }),
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

async fn handle_claude_response(response: reqwest::Response) -> Result<AiChatResult, String> {
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

    Ok(AiChatResult {
        content,
        finish_reason: parsed.stop_reason,
        model: parsed.model,
        prompt_tokens: parsed.usage.as_ref().and_then(|u| u.input_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|u| u.output_tokens),
        total_tokens,
    })
}
