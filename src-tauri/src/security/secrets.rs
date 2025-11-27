//! Local, device-bound storage for AI provider credentials.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::crypto::{self, EncryptedBlob};
use super::device;

const SECRET_FILE_NAME: &str = "ai_secrets.dat";
const LEGACY_KEYS_FILE: &str = "ai_keys.json";
const LEGACY_COMBINED_FILE: &str = "ai_config.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SecretSlot {
    pub salt: Option<String>,
    pub nonce: Option<String>,
    pub ciphertext: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LegacyProviderSlot {
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

type SecretStore = HashMap<String, SecretSlot>;
pub type LegacyStore = HashMap<String, LegacyProviderSlot>;

pub fn save_api_key(app: &AppHandle, provider_id: &str, api_key: &str) -> Result<(), String> {
    let device_id = device::device_id(app)?;
    let blob = crypto::encrypt(device_id.as_bytes(), api_key.as_bytes())?;
    let mut store = load_store(app)?;
    store.insert(
        provider_id.to_string(),
        SecretSlot {
            salt: Some(BASE64.encode(blob.salt)),
            nonce: Some(BASE64.encode(blob.nonce)),
            ciphertext: Some(BASE64.encode(blob.ciphertext)),
        },
    );
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
    store.remove(provider_id);
    persist_store(app, &store)?;
    Ok(())
}

pub fn has_api_key(app: &AppHandle, provider_id: &str) -> Result<bool, String> {
    let store = load_store(app)?;
    let Some(slot) = store.get(provider_id) else {
        return Ok(false);
    };
    Ok(slot
        .ciphertext
        .as_ref()
        .is_some_and(|cipher| !cipher.trim().is_empty()))
}

pub fn persist_store_snapshot(app: &AppHandle, store: &SecretStore) -> Result<(), String> {
    persist_store(app, store)
}

pub fn read_legacy_combined(app: &AppHandle) -> Result<Option<LegacyStore>, String> {
    let path = legacy_combined_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let store = read_legacy_store(&path)?;
    Ok(Some(store))
}

pub fn secrets_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join(SECRET_FILE_NAME))
}

pub fn legacy_combined_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join(LEGACY_COMBINED_FILE))
}

fn legacy_keys_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    Ok(dir.join(LEGACY_KEYS_FILE))
}

fn load_store(app: &AppHandle) -> Result<SecretStore, String> {
    let path = secrets_path(app)?;
    if path.exists() {
        return read_store(&path);
    }

    // 兼容旧版本：优先尝试 legacy secrets，再尝试组合配置文件。
    let legacy_keys = legacy_keys_path(app)?;
    if legacy_keys.exists() {
        let legacy = read_legacy_store(&legacy_keys)?;
        let converted = legacy_to_secret_store(legacy);
        persist_store(app, &converted)?;
        return Ok(converted);
    }

    let legacy_combined = legacy_combined_path(app)?;
    if legacy_combined.exists() {
        let legacy = read_legacy_store(&legacy_combined)?;
        let converted = legacy_to_secret_store(legacy);
        persist_store(app, &converted)?;
        return Ok(converted);
    }

    Ok(HashMap::new())
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

fn read_legacy_store(path: &PathBuf) -> Result<LegacyStore, String> {
    let content = fs::read_to_string(path)
        .map_err(|err| format!("failed to read secret store {}: {err}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(HashMap::new());
    }
    serde_json::from_str::<LegacyStore>(&content)
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

fn deserialize_blob(secret: &SecretSlot) -> Result<EncryptedBlob, String> {
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

fn legacy_to_secret_store(legacy: LegacyStore) -> SecretStore {
    legacy
        .into_iter()
        .filter_map(|(key, value)| {
            if value.salt.is_none() && value.nonce.is_none() && value.ciphertext.is_none() {
                return None;
            }
            Some((
                key,
                SecretSlot {
                    salt: value.salt,
                    nonce: value.nonce,
                    ciphertext: value.ciphertext,
                },
            ))
        })
        .collect()
}
