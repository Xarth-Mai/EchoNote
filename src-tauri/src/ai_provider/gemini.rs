use serde::{Deserialize, Serialize};

use super::{AiChatRequest, AiChatResult, HTTP_CLIENT};

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
    #[serde(rename = "responseMimeType", skip_serializing_if = "Option::is_none")]
    response_mime_type: Option<String>,
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

#[derive(Debug, Deserialize)]
struct GeminiModelList {
    models: Option<Vec<GeminiModelEntry>>,
}

#[derive(Debug, Deserialize)]
struct GeminiModelEntry {
    name: String,
}

pub async fn invoke_gemini_completion(
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
            response_mime_type: Some("application/json".to_string()),
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

async fn handle_gemini_response(response: reqwest::Response) -> Result<AiChatResult, String> {
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
    Ok(AiChatResult {
        content,
        finish_reason,
        model: None,
        prompt_tokens: parsed.usage.as_ref().and_then(|u| u.prompt_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|u| u.candidates_tokens),
        total_tokens: parsed.usage.as_ref().and_then(|u| u.total_tokens),
    })
}
