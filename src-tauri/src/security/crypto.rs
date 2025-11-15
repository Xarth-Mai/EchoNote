//! Small AES-GCM + HKDF wrapper for encrypting secrets bound to a device ID.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use ring::hkdf::{Salt, HKDF_SHA256};

pub struct EncryptedBlob {
    pub salt: [u8; 32],
    pub nonce: [u8; 12],
    pub ciphertext: Vec<u8>,
}

pub fn encrypt(device_id: &[u8], plaintext: &[u8]) -> Result<EncryptedBlob, String> {
    let key = derive_key(device_id, None)?;
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key.key));
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|err| format!("failed to encrypt API key: {err}"))?;

    Ok(EncryptedBlob {
        salt: key.salt,
        nonce,
        ciphertext,
    })
}

pub fn decrypt(device_id: &[u8], blob: &EncryptedBlob) -> Result<Vec<u8>, String> {
    let derived = derive_key(device_id, Some(blob.salt))?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&derived.key));
    cipher
        .decrypt(Nonce::from_slice(&blob.nonce), blob.ciphertext.as_ref())
        .map_err(|err| format!("failed to decrypt API key: {err}"))
}

struct DerivedKey {
    key: [u8; 32],
    salt: [u8; 32],
}

fn derive_key(device_id: &[u8], existing_salt: Option<[u8; 32]>) -> Result<DerivedKey, String> {
    let salt_bytes = match existing_salt {
        Some(existing) => existing,
        None => {
            let mut salt = [0u8; 32];
            OsRng.fill_bytes(&mut salt);
            salt
        }
    };
    let salt = Salt::new(HKDF_SHA256, &salt_bytes);
    let prk = salt.extract(device_id);
    let okm = prk
        .expand(&[], HKDF_SHA256)
        .map_err(|_| "failed to expand HKDF key material".to_string())?;
    let mut key = [0u8; 32];
    okm.fill(&mut key)
        .map_err(|_| "failed to fill HKDF output".to_string())?;
    Ok(DerivedKey {
        key,
        salt: salt_bytes,
    })
}
