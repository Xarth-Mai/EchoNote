//! Generates and persists a per-device identifier used for local encryption.

use std::fs;
use std::path::PathBuf;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use once_cell::sync::OnceCell;
use rand::rngs::OsRng;
use rand::RngCore;
use ring::hkdf::{Salt, HKDF_SHA256};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// 固定密钥的原始 seed（由产品要求提供），实际用于派生 AES-256 密钥。
const DEVICE_KEY_SEED: &[u8] = b"Ech0N0te";
const DEVICE_KEY_SALT: &[u8] = b"echonote-device-key";
const ENCODING_PREFIX: &str = "v1:";

static DEVICE_ID: OnceCell<String> = OnceCell::new();

/// 返回缓存的 device_id，如不存在则在应用数据目录生成新的 UUID v4。
pub fn device_id(app: &AppHandle) -> Result<String, String> {
    DEVICE_ID
        .get_or_try_init(|| load_or_create_device_id(app))
        .map(|value| value.clone())
}

fn load_or_create_device_id(app: &AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
    fs::create_dir_all(&dir)
        .map_err(|err| format!("failed to prepare app data dir {}: {err}", dir.display()))?;
    let file = dir.join("device_id");

    if file.exists() {
        if let Ok(existing) = read_existing(&file) {
            return Ok(existing);
        }
    }

    let id = Uuid::new_v4().to_string();
    let encoded = encrypt_device_id(&id)?;
    fs::write(&file, encoded)
        .map_err(|err| format!("failed to write {}: {err}", file.display()))?;
    Ok(id)
}

fn read_existing(path: &PathBuf) -> Result<String, String> {
    let contents = fs::read_to_string(path)
        .map_err(|err| format!("failed to read device id {}: {err}", path.display()))?;
    let trimmed = contents.trim();
    if trimmed.is_empty() {
        return Err("device id file is empty".to_string());
    }

    // 支持旧版本明文存储；若为 v1: 编码则执行解密。
    if let Some(rest) = trimmed.strip_prefix(ENCODING_PREFIX) {
        return decrypt_device_id(rest);
    }

    Ok(trimmed.to_string())
}

fn encrypt_device_id(id: &str) -> Result<String, String> {
    let key = derive_device_key()?;
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), id.as_bytes())
        .map_err(|err| format!("failed to encrypt device id: {err}"))?;

    Ok(format!(
        "{ENCODING_PREFIX}{}:{}",
        BASE64.encode(nonce),
        BASE64.encode(ciphertext)
    ))
}

fn decrypt_device_id(encoded: &str) -> Result<String, String> {
    let mut parts = encoded.split(':');
    let Some(nonce_b64) = parts.next() else {
        return Err("device id missing nonce".to_string());
    };
    let Some(cipher_b64) = parts.next() else {
        return Err("device id missing ciphertext".to_string());
    };

    let nonce_vec = BASE64
        .decode(nonce_b64.as_bytes())
        .map_err(|err| format!("invalid device id nonce: {err}"))?;
    let cipher_vec = BASE64
        .decode(cipher_b64.as_bytes())
        .map_err(|err| format!("invalid device id ciphertext: {err}"))?;

    let mut nonce = [0u8; 12];
    if nonce_vec.len() != nonce.len() {
        return Err("device id nonce length invalid".to_string());
    }
    nonce.copy_from_slice(&nonce_vec);

    let key = derive_device_key()?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), cipher_vec.as_slice())
        .map_err(|err| format!("failed to decrypt device id: {err}"))?;
    String::from_utf8(plaintext).map_err(|_| "device id is not valid utf-8".to_string())
}

fn derive_device_key() -> Result<[u8; 32], String> {
    let salt = Salt::new(HKDF_SHA256, DEVICE_KEY_SALT);
    let prk = salt.extract(DEVICE_KEY_SEED);
    let okm = prk
        .expand(&[], HKDF_SHA256)
        .map_err(|_| "failed to expand device key".to_string())?;
    let mut key = [0u8; 32];
    okm.fill(&mut key)
        .map_err(|_| "failed to fill device key".to_string())?;
    Ok(key)
}
