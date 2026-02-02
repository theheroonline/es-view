#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Deserialize)]
pub struct HttpRequest {
    url: String,
    method: String,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    status: u16,
    ok: bool,
    body: String,
}

#[command]
async fn http_request(request: HttpRequest) -> Result<HttpResponse, String> {
    let client = reqwest::Client::new();
    
    let method = match request.method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "PATCH" => reqwest::Method::PATCH,
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    let mut req_builder = client.request(method, &request.url);

    // Add headers
    if let Some(headers) = request.headers {
        for (key, value) in headers {
            req_builder = req_builder.header(&key, &value);
        }
    }

    // Add body
    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }

    // Send request
    let response = req_builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(HttpResponse { status, ok, body })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![http_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
