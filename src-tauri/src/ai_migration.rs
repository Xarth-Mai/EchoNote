//! One-time migration helpers to split legacy `ai_config.json` into preferences + secrets.

use std::fs;

use tauri::AppHandle;

use crate::ai_prefs::{merge_legacy_into_preferences, save_preferences};
use crate::security::secrets::{
    legacy_combined_path, persist_store_snapshot, read_legacy_combined, secrets_path, SecretSlot,
};

pub fn migrate_if_needed(app: &AppHandle) -> Result<(), String> {
    let Some(legacy_store) = read_legacy_combined(app)? else {
        return Ok(());
    };

    let secret_path = secrets_path(app)?;
    let prefs_path = crate::ai_prefs::preferences_path(app)?;

    // 如果新结构已存在，避免覆盖用户的最新配置。
    if secret_path.exists() || prefs_path.exists() {
        return Ok(());
    }

    let mut prefs = crate::ai_prefs::load_preferences(app)?;
    merge_legacy_into_preferences(&mut prefs, legacy_store.clone());
    save_preferences(app, &prefs)?;

    let secret_snapshot = legacy_store
        .into_iter()
        .filter_map(|(provider_id, slot)| {
            if slot.salt.is_none() && slot.nonce.is_none() && slot.ciphertext.is_none() {
                return None;
            }
            Some((
                provider_id,
                SecretSlot {
                    salt: slot.salt,
                    nonce: slot.nonce,
                    ciphertext: slot.ciphertext,
                },
            ))
        })
        .collect();
    persist_store_snapshot(app, &secret_snapshot)?;

    let legacy_path = legacy_combined_path(app)?;
    let backup_path = legacy_path.with_extension("bak");
    let _ = fs::rename(legacy_path, backup_path);

    Ok(())
}
