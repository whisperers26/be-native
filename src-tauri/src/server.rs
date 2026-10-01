use crate::config::{get, set};
use crate::window::*;
use crate::writing::{selection_writing, text_writing};
use log::{info, warn};
use std::thread;
use tauri::api::notification;
use tiny_http::{Request, Response, Server};

pub fn start_server() {
    let port = match get("server_port") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("server_port", 60828);
            60828
        }
    };
    thread::spawn(move || {
        let server = match Server::http(format!("127.0.0.1:{port}")) {
            Ok(v) => v,
            Err(e) => {
                let _ = notification::Notification::new("com.pot-spp.com")
                    .title("Server start failed")
                    .body("Please Change Server Port and restart the application")
                    .show();
                warn!("Server start failed: {}", e);
                return;
            }
        };
        for request in server.incoming_requests() {
            http_handle(request);
        }
    });
}

fn http_handle(request: Request) {
    info!("Handle {} request", request.url());
    match request.url() {
        "/" => handle_translate(request),
        "/config" => handle_config(request),
        "/translate" => handle_translate(request),
        "/selection_translate" => handle_selection_translate(request),
        "/input_translate" => handle_input_translate(request),
        "/ocr_recognize" => handle_ocr_recognize(request),
        "/ocr_translate" => handle_ocr_translate(request),
        "/ocr_recognize?screenshot=false" => handle_ocr_recognize(request),
        "/ocr_translate?screenshot=false" => handle_ocr_translate(request),
        "/ocr_recognize?screenshot=true" => handle_ocr_recognize(request),
        "/ocr_translate?screenshot=true" => handle_ocr_translate(request),
        "/ocr_copy" => handle_ocr_copy(request),
        "/ocr_copy?screenshot=false" => handle_ocr_copy(request),
        "/ocr_copy?screenshot=true" => handle_ocr_copy(request),
        "/writing" => handle_writing(request),
        "/selection_writing" => handle_selection_writing(request),
        "/test_mode?on=true" | "/test_mode?on=false" if cfg!(debug_assertions) => {
            handle_test_mode(request)
        }
        _ => warn!("Unknown request url: {}", request.url()),
    }
}

fn handle_config(request: Request) {
    config_window();
    response_ok(request);
}

fn handle_translate(mut request: Request) {
    let mut content = String::new();
    request.as_reader().read_to_string(&mut content).unwrap();
    text_translate(content);
    response_ok(request);
}

fn handle_selection_translate(request: Request) {
    selection_translate();
    response_ok(request);
}

fn handle_input_translate(request: Request) {
    input_translate();
    response_ok(request);
}

fn handle_ocr_recognize(request: Request) {
    if request.url().ends_with("false") {
        recognize_window();
    } else {
        ocr_recognize();
    }
    response_ok(request);
}

fn handle_ocr_translate(request: Request) {
    if request.url().ends_with("false") {
        image_translate();
    } else {
        ocr_translate();
    }
    response_ok(request);
}

fn handle_ocr_copy(request: Request) {
    if request.url().ends_with("false") {
        silent_recognize_window();
    } else {
        ocr_copy();
    }
    response_ok(request);
}

fn handle_writing(mut request: Request) {
    let mut content = String::new();
    request.as_reader().read_to_string(&mut content).unwrap();
    text_writing(content);
    response_ok(request);
}

fn handle_selection_writing(request: Request) {
    selection_writing();
    response_ok(request);
}

fn handle_test_mode(request: Request) {
    set_test_mode(request.url().ends_with("true"));
    response_ok(request);
}

fn response_ok(request: Request) {
    let response = Response::from_string("ok");
    request.respond(response).unwrap();
}
