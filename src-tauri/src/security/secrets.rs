//! Local, device-bound storage for AI provider credentials and preferences.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::crypto::{self, EncryptedBlob};
use super::device;

const SECRET_FILE_NAME: &str = "ai_config.json";
const LEGACY_FILE_NAME: &str = "ai_keys.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderSlot {
    pub salt: Option<String>,
    pub nonce: Option<String>,
    pub ciphertext: Option<String>,
    #[serde(default, rename = "modelList")]
    pub model_list: Option<Vec<String>>,
    #[serde(default, rename = "baseUrl")]
    pub base_url: Option<String>,
    #[serde(default, rename = "selectedModel")]
    pub selected_model: Option<String>,
}

type SecretStore = HashMap<String, ProviderSlot>;

pub fn save_api_key(app: &AppHandle, provider_id: &str, api_key: &str) -> Result<(), String> {
    let device_id = device::device_id(app)?;
    let blob = crypto::encrypt(device_id.as_bytes(), api_key.as_bytes())?;
    let mut store = load_store(app)?;
    let mut slot = ProviderSlot::default();
    slot.salt = Some(BASE64.encode(blob.salt));
    slot.nonce = Some(BASE64.encode(blob.nonce));
    slot.ciphertext = Some(BASE64.encode(blob.ciphertext));
    slot.model_list = store
        .get(provider_id)
        .and_then(|existing| existing.model_list.clone());
    slot.base_url = store
        .get(provider_id)
        .and_then(|existing| existing.base_url.clone());
    slot.selected_model = store
        .get(provider_id)
        .and_then(|existing| existing.selected_model.clone());
    store.insert(provider_id.to_string(), slot);
    persist_store(app, &store)
}

pub fn load_api_key(app: &AppHandle, provider_id: &str) -> Result<Option<String>, String> {
    let store = load_store(app)?;
    let Some(secret) = store.get(provider_id) else {
        return Ok(None);
    };
    let blob = deserialize_blob(secret)?;
    let device_id = device::device_id(app)?;
    let plaintext = crypto::decrypt(device_id.as_bytes(), &blob)?;
    let decoded = String::from_utf8(plaintext)
        .map_err(|_| "stored API key is not valid UTF-8".to_string())?;
    Ok(Some(decoded))
}

pub fn delete_api_key(app: &AppHandle, provider_id: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    if let Some(mut slot) = store.remove(provider_id) {
        // 保留模型缓存与 Base URL，防止无意丢失已有配置
        if slot.model_list.is_some() || slot.base_url.is_some() {
            slot.salt = None;
            slot.nonce = None;
            slot.ciphertext = None;
            store.insert(provider_id.to_string(), slot);
        }
    }
    persist_store(app, &store)?;
    Ok(())
}

pub fn save_model_cache(
    app: &AppHandle,
    provider_id: &str,
    models: &[String],
) -> Result<(), String> {
    let mut store = load_store(app)?;
    let mut slot = store.remove(provider_id).unwrap_or_default();
    slot.model_list = Some(models.to_vec());
    store.insert(provider_id.to_string(), slot);
    persist_store(app, &store)
}

pub fn load_model_cache(app: &AppHandle, provider_id: &str) -> Result<Option<Vec<String>>, String> {
    let store = load_store(app)?;
    Ok(store
        .get(provider_id)
        .and_then(|slot| slot.model_list.clone()))
}

pub fn save_base_url(app: &AppHandle, provider_id: &str, base_url: &str) -> Result<(), String> {
    let normalized = base_url.trim();
    let mut store = load_store(app)?;
    let mut slot = store.remove(provider_id).unwrap_or_default();
    if normalized.is_empty() {
        slot.base_url = None;
    } else {
        slot.base_url = Some(normalized.to_string());
    }
    store.insert(provider_id.to_string(), slot);
    persist_store(app, &store)
}

pub fn load_base_url(app: &AppHandle, provider_id: &str) -> Result<Option<String>, String> {
    let store = load_store(app)?;
    Ok(store
        .get(provider_id)
        .and_then(|slot| slot.base_url.clone()))
}

pub fn delete_provider(app: &AppHandle, provider_id: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    store.remove(provider_id);
    persist_store(app, &store)
}

pub fn save_selected_model(app: &AppHandle, provider_id: &str, model: &str) -> Result<(), String> {
    let mut store = load_store(app)?;
    let mut slot = store.remove(provider_id).unwrap_or_default();
    if model.trim().is_empty() {
        slot.selected_model = None;
    } else {
        slot.selected_model = Some(model.trim().to_string());
    }
    store.insert(provider_id.to_string(), slot);
    persist_store(app, &store)
}

pub fn load_selected_model(app: &AppHandle, provider_id: &str) -> Result<Option<String>, String> {
    let store = load_store(app)?;
    Ok(store
        .get(provider_id)
        .and_then(|slot| slot.selected_model.clone()))
}

fn load_store(app: &AppHandle) -> Result<SecretStore, String> {
    let path = secrets_path(app)?;
    if !path.exists() {
        // 兼容旧文件名
        let legacy = legacy_path(app)?;
        if legacy.exists() {
            return read_store(&legacy);
        }
        return Ok(HashMap::new());
    }
    read_store(&path)
}

fn read_store(path: &PathBuf) -> Result<SecretStore, String> {
    let content = fs::read_to_string(path)
        .map_err(|err| format!("failed to read secret store {}: {err}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(HashMap::new());
    }
    serde_json::from_str::<SecretStore>(&content)
        .map_err(|err| format!("failed to parse secret store {}: {err}", path.display()))
}

fn persist_store(app: &AppHandle, store: &SecretStore) -> Result<(), String> {
    let path = secrets_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .map_err(|err| format!("failed to create {}: {err}", dir.display()))?;
    }
    let serialized = serde_json::to_string_pretty(store)
        .map_err(|err| format!("failed to serialize secret store: {err}"))?;
    fs::write(&path, serialized).map_err(|err| format!("failed to write {}: {err}", path.display()))
}

fn secrets_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join(SECRET_FILE_NAME))
}

fn legacy_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join(LEGACY_FILE_NAME))
}

fn deserialize_blob(secret: &ProviderSlot) -> Result<EncryptedBlob, String> {
    let salt_b64 = secret
        .salt
        .as_ref()
        .ok_or_else(|| "missing salt for provider".to_string())?;
    let nonce_b64 = secret
        .nonce
        .as_ref()
        .ok_or_else(|| "missing nonce for provider".to_string())?;
    let cipher_b64 = secret
        .ciphertext
        .as_ref()
        .ok_or_else(|| "missing ciphertext for provider".to_string())?;

    let salt_vec = BASE64
        .decode(salt_b64.as_bytes())
        .map_err(|err| format!("invalid salt encoding: {err}"))?;
    let nonce_vec = BASE64
        .decode(nonce_b64.as_bytes())
        .map_err(|err| format!("invalid nonce encoding: {err}"))?;
    let mut salt = [0u8; 32];
    let mut nonce = [0u8; 12];
    if salt_vec.len() != salt.len() {
        return Err("invalid salt length".to_string());
    }
    if nonce_vec.len() != nonce.len() {
        return Err("invalid nonce length".to_string());
    }
    salt.copy_from_slice(&salt_vec);
    nonce.copy_from_slice(&nonce_vec);
    Ok(EncryptedBlob {
        salt,
        nonce,
        ciphertext: BASE64
            .decode(cipher_b64.as_bytes())
            .map_err(|err| format!("invalid ciphertext encoding: {err}"))?,
    })
}
