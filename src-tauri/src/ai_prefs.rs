//! Shared AI preference handling backed by a Tauri Store-compatible JSON file.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::security::secrets::LegacyStore;

pub const PREFS_FILE_NAME: &str = "ai_preferences.json";
pub const DEFAULT_PROMPT: &str = "Provide the summary exactly according to the system rules.";
pub const DEFAULT_GREETING_PROMPT: &str =
    "Please craft a short, warm hero greeting for today's diary. Keep it optimistic, personal, and add an emoji.";
pub const DEFAULT_TEMPERATURE: f32 = 1.0;
pub const DEFAULT_MAX_TOKENS: u32 = 60;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiPreferences {
    pub active_provider_id: Option<String>,
    #[serde(default)]
    pub providers: HashMap<String, ProviderPreferences>,
    pub advanced: Option<AdvancedPreferences>,
    #[serde(default)]
    pub api_key_hints: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPreferences {
    pub base_url: Option<String>,
    pub selected_model: Option<String>,
    #[serde(default)]
    pub model_list: Option<Vec<String>>,
    pub prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub greeting_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedPreferences {
    pub prompt: Option<String>,
    pub greeting_prompt: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct ProviderContext {
    pub base_url: String,
    pub model: String,
    pub prompt: String,
    pub greeting_prompt: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct WrappedPreferences {
    #[serde(rename = "aiSettings")]
    pub ai_settings: Option<AiPreferences>,
}

pub fn load_preferences(app: &AppHandle) -> Result<AiPreferences, String> {
    let path = preferences_path(app)?;
    if !path.exists() {
        return Ok(default_preferences());
    }

    let content = fs::read_to_string(&path)
        .map_err(|err| format!("failed to read AI preferences {}: {err}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(default_preferences());
    }

    let parsed: WrappedPreferences = serde_json::from_str(&content)
        .map_err(|err| format!("failed to parse AI preferences {}: {err}", path.display()))?;
    Ok(sanitize_preferences(parsed.ai_settings.unwrap_or_default()))
}

pub fn save_preferences(app: &AppHandle, prefs: &AiPreferences) -> Result<(), String> {
    let sanitized = sanitize_preferences(prefs.clone());
    let wrapped = WrappedPreferences {
        ai_settings: Some(sanitized),
    };
    let path = preferences_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .map_err(|err| format!("failed to create {}: {err}", dir.display()))?;
    }
    let serialized = serde_json::to_string_pretty(&wrapped)
        .map_err(|err| format!("failed to serialize preferences: {err}"))?;
    fs::write(&path, serialized)
        .map_err(|err| format!("failed to write preferences {}: {err}", path.display()))
}

pub fn persist_model_list(
    app: &AppHandle,
    provider_id: &str,
    models: &[String],
) -> Result<(), String> {
    let mut prefs = load_preferences(app)?;
    let provider = prefs.providers.entry(provider_id.to_string()).or_default();
    provider.model_list = Some(
        models
            .iter()
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .collect(),
    );
    if provider.selected_model.is_none() {
        if let Some(first) = provider.model_list.as_ref().and_then(|list| list.first()) {
            provider.selected_model = Some(first.clone());
        }
    }
    save_preferences(app, &prefs)
}

pub fn resolve_provider_context(
    app: &AppHandle,
    provider_id: &str,
) -> Result<ProviderContext, String> {
    let prefs = sanitize_preferences(load_preferences(app)?);
    let advanced = sanitize_advanced(prefs.advanced.unwrap_or_default());
    let provider = prefs.providers.get(provider_id);

    let base_url = provider
        .and_then(|p| sanitize_base_url(p.base_url.clone()))
        .unwrap_or_else(|| default_api_base_for(provider_id).to_string());

    let model = provider
        .and_then(|p| p.selected_model.clone())
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| default_model_for(provider_id));

    let prompt = provider
        .and_then(|p| p.prompt.clone())
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| {
            advanced
                .prompt
                .clone()
                .unwrap_or_else(|| DEFAULT_PROMPT.to_string())
        });

    let greeting_prompt = provider
        .and_then(|p| p.greeting_prompt.clone())
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| {
            advanced
                .greeting_prompt
                .clone()
                .unwrap_or_else(|| DEFAULT_GREETING_PROMPT.to_string())
        });

    let temperature = provider
        .and_then(|p| p.temperature)
        .unwrap_or_else(|| advanced.temperature.unwrap_or(DEFAULT_TEMPERATURE));

    let max_tokens = provider
        .and_then(|p| p.max_tokens)
        .unwrap_or_else(|| advanced.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS));

    Ok(ProviderContext {
        base_url,
        model,
        prompt,
        greeting_prompt,
        temperature,
        max_tokens,
    })
}

pub fn merge_legacy_into_preferences(prefs: &mut AiPreferences, legacy: LegacyStore) {
    for (provider_id, slot) in legacy.into_iter() {
        let provider = prefs.providers.entry(provider_id).or_default();
        if let Some(url) = slot.base_url {
            provider.base_url = Some(url);
        }
        if let Some(model) = slot.selected_model {
            provider.selected_model = Some(model);
        }
        if let Some(models) = slot.model_list {
            provider.model_list = Some(models);
        }
    }
}

pub fn default_preferences() -> AiPreferences {
    let mut providers = HashMap::new();
    for id in ["noai", "chatgpt", "deepseek", "gemini", "claude"] {
        providers.insert(id.to_string(), default_provider_preferences(id));
    }
    AiPreferences {
        active_provider_id: Some("noai".to_string()),
        providers,
        advanced: Some(AdvancedPreferences {
            prompt: Some(DEFAULT_PROMPT.to_string()),
            greeting_prompt: Some(DEFAULT_GREETING_PROMPT.to_string()),
            temperature: Some(DEFAULT_TEMPERATURE),
            max_tokens: Some(DEFAULT_MAX_TOKENS),
        }),
        api_key_hints: HashMap::new(),
    }
}

pub fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|err| format!("failed to resolve app config dir: {err}"))?;
    Ok(dir.join(PREFS_FILE_NAME))
}

pub fn default_api_base_for(provider_id: &str) -> &'static str {
    match provider_id {
        "deepseek" => "https://api.deepseek.com",
        "gemini" => "https://generativelanguage.googleapis.com",
        "claude" => "https://api.anthropic.com",
        _ => "https://api.openai.com/v1",
    }
}

pub fn default_model_for(provider_id: &str) -> String {
    match provider_id {
        "deepseek" => "deepseek-chat".to_string(),
        "gemini" => "gemini-flash-lite-latest".to_string(),
        "claude" => "claude-haiku-4-5".to_string(),
        "noai" => String::new(),
        _ => "gpt-5.1".to_string(),
    }
}

fn sanitize_preferences(mut prefs: AiPreferences) -> AiPreferences {
    let mut providers: HashMap<String, ProviderPreferences> = HashMap::new();

    for builtin in ["noai", "chatgpt", "deepseek", "gemini", "claude"] {
        providers.insert(
            builtin.to_string(),
            sanitize_provider(
                builtin,
                prefs
                    .providers
                    .remove(builtin)
                    .unwrap_or_else(|| default_provider_preferences(builtin)),
            ),
        );
    }

    for (id, provider) in prefs.providers.into_iter() {
        providers.insert(id.clone(), sanitize_provider(&id, provider));
    }

    AiPreferences {
        active_provider_id: prefs
            .active_provider_id
            .filter(|id| providers.contains_key(id))
            .or_else(|| Some("noai".to_string())),
        providers,
        advanced: Some(sanitize_advanced(prefs.advanced.unwrap_or_default())),
        api_key_hints: prefs.api_key_hints,
    }
}

fn sanitize_provider(provider_id: &str, mut provider: ProviderPreferences) -> ProviderPreferences {
    provider.base_url = sanitize_base_url(provider.base_url.take())
        .or_else(|| Some(default_api_base_for(provider_id).to_string()));
    provider.selected_model = provider
        .selected_model
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
        .or_else(|| Some(default_model_for(provider_id)));
    provider.model_list = provider.model_list.map(|models| {
        models
            .into_iter()
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .collect()
    });
    provider.prompt = provider
        .prompt
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    provider.greeting_prompt = provider
        .greeting_prompt
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());
    provider.temperature = provider.temperature.map(|t| t.clamp(0.0, 2.0));
    provider.max_tokens = provider.max_tokens.filter(|v| *v > 0);
    provider
}

fn sanitize_advanced(mut advanced: AdvancedPreferences) -> AdvancedPreferences {
    advanced.prompt = Some(
        advanced
            .prompt
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .unwrap_or_else(|| DEFAULT_PROMPT.to_string()),
    );
    advanced.greeting_prompt = Some(
        advanced
            .greeting_prompt
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .unwrap_or_else(|| DEFAULT_GREETING_PROMPT.to_string()),
    );
    advanced.temperature = Some(
        advanced
            .temperature
            .map(|t| t.clamp(0.0, 2.0))
            .unwrap_or(DEFAULT_TEMPERATURE),
    );
    advanced.max_tokens = Some(
        advanced
            .max_tokens
            .filter(|v| *v > 0)
            .unwrap_or(DEFAULT_MAX_TOKENS),
    );
    advanced
}

fn sanitize_base_url(value: Option<String>) -> Option<String> {
    let raw = value?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.trim_end_matches('/').to_string())
}

fn default_provider_preferences(provider_id: &str) -> ProviderPreferences {
    ProviderPreferences {
        base_url: Some(default_api_base_for(provider_id).to_string()),
        selected_model: Some(default_model_for(provider_id)),
        model_list: None,
        prompt: None,
        max_tokens: None,
        temperature: None,
        greeting_prompt: None,
    }
}
