use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct PatientList {
    patients: Vec<String>,
}

// -- Structs used to deserialize the nested metadata.json --

#[derive(Deserialize)]
struct RawMetadata {
    mhd: RawMhd,
    calipers: RawCalipers,
}

#[derive(Deserialize)]
struct RawMhd {
    #[serde(rename = "DimSize")]
    dim_size: String,
    #[serde(rename = "ElementSpacing")]
    element_spacing: String,
}

#[derive(Deserialize)]
struct RawCalipers {
    objects: Vec<RawObject>,
}

#[derive(Deserialize)]
struct RawObject {
    calipers: Vec<RawCaliper>,
}

#[derive(Deserialize)]
struct RawCaliper {
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    length: f64,
}

// -- Flat struct that is serialised and returned to the client --

#[derive(Serialize)]
struct Metadata {
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    length: f64,
    dim_size: String,
    element_spacing: String,
}

// ---------------------------------------------------------------------------
// Safety helper
// ---------------------------------------------------------------------------

// Reject names that could be used for path traversal (e.g. "../../etc/passwd").
// Only letters, digits, hyphens, and underscores are allowed.
fn is_valid_name(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /patients
/// Returns a sorted list of all patient names (one per sub-folder in data/).
pub async fn list_patients(state: web::Data<AppState>) -> HttpResponse {
    let data_dir = PathBuf::from(&state.data_dir);

    match fs::read_dir(&data_dir) {
        Ok(entries) => {
            let mut patients: Vec<String> = entries
                .filter_map(|entry| {
                    let entry = entry.ok()?;
                    // Only include directories, not loose files
                    if entry.file_type().ok()?.is_dir() {
                        entry.file_name().into_string().ok()
                    } else {
                        None
                    }
                })
                .collect();

            patients.sort();
            HttpResponse::Ok().json(PatientList { patients })
        }
        Err(_) => HttpResponse::InternalServerError().body("Could not read data directory"),
    }
}

/// GET /patients/{name}/video
/// Returns the raw bytes of the patient's video.mp4 file.
pub async fn get_video(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let name = path.into_inner();
    if !is_valid_name(&name) {
        return HttpResponse::BadRequest().body("Invalid patient name");
    }

    let file_path = PathBuf::from(&state.data_dir).join(&name).join("video.mp4");
    match fs::read(&file_path) {
        Ok(data) => HttpResponse::Ok().content_type("video/mp4").body(data),
        Err(_) => HttpResponse::NotFound().body(format!("Video not found for: {name}")),
    }
}

/// GET /patients/{name}/image
/// Returns the raw bytes of the patient's image.png file.
pub async fn get_image(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let name = path.into_inner();
    if !is_valid_name(&name) {
        return HttpResponse::BadRequest().body("Invalid patient name");
    }

    let file_path = PathBuf::from(&state.data_dir).join(&name).join("image.png");
    match fs::read(&file_path) {
        Ok(data) => HttpResponse::Ok().content_type("image/png").body(data),
        Err(_) => HttpResponse::NotFound().body(format!("Image not found for: {name}")),
    }
}

/// GET /patients/{name}/metadata
/// Parses metadata.json and returns the caliper measurements and image dimensions.
pub async fn get_metadata(path: web::Path<String>, state: web::Data<AppState>) -> HttpResponse {
    let name = path.into_inner();
    if !is_valid_name(&name) {
        return HttpResponse::BadRequest().body("Invalid patient name");
    }

    let file_path = PathBuf::from(&state.data_dir).join(&name).join("metadata.json");

    let content = match fs::read_to_string(&file_path) {
        Ok(c) => c,
        Err(_) => return HttpResponse::NotFound().body(format!("Metadata not found for: {name}")),
    };

    let raw: RawMetadata = match serde_json::from_str(&content) {
        Ok(r) => r,
        Err(_) => return HttpResponse::InternalServerError().body("metadata.json has invalid format"),
    };

    let cal = &raw.calipers.objects[0].calipers[0];

    let metadata = Metadata {
        x1: cal.x1,
        y1: cal.y1,
        x2: cal.x2,
        y2: cal.y2,
        length: cal.length,
        dim_size: raw.mhd.dim_size,
        element_spacing: raw.mhd.element_spacing,
    };

    HttpResponse::Ok().json(metadata)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use std::sync::atomic::{AtomicU32, Ordering};

    // Each test gets a unique ID so parallel tests don't share the same directory.
    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn next_test_dir() -> String {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        format!("/tmp/cecilie_test_{}_{}", std::process::id(), id)
    }

    // Build a test app pointing at the given data directory.
    async fn make_app(
        data_dir: &str,
    ) -> impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    > {
        let state = web::Data::new(AppState {
            data_dir: data_dir.to_string(),
        });

        test::init_service(
            App::new()
                .app_data(state)
                .route("/patients", web::get().to(list_patients))
                .route("/patients/{name}/video", web::get().to(get_video))
                .route("/patients/{name}/image", web::get().to(get_image))
                .route("/patients/{name}/metadata", web::get().to(get_metadata)),
        )
        .await
    }

    // Create a temporary directory with one patient ("alice") and all three files.
    fn make_dir_with_patient() -> String {
        let dir = next_test_dir();
        let patient = format!("{dir}/alice");
        fs::create_dir_all(&patient).unwrap();
        fs::write(format!("{patient}/video.mp4"), b"fake video bytes").unwrap();
        fs::write(format!("{patient}/image.png"), b"fake image bytes").unwrap();
        fs::write(
            format!("{patient}/metadata.json"),
            r#"{
                "mhd": { "DimSize": "100 200", "ElementSpacing": "0.5 0.5" },
                "calipers": {
                    "objects": [{
                        "calipers": [{
                            "x1": 100.0, "y1": 200.0,
                            "x2": 300.0, "y2": 400.0,
                            "length": 219.09
                        }]
                    }]
                }
            }"#,
        )
        .unwrap();
        dir
    }

    // Create an empty temporary directory (no patients).
    fn make_empty_dir() -> String {
        let dir = next_test_dir();
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &str) {
        let _ = fs::remove_dir_all(dir);
    }

    // --- list_patients ---

    #[actix_web::test]
    async fn test_list_patients_returns_200_and_alice() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get().uri("/patients").to_request();
        let body: serde_json::Value = test::call_and_read_body_json(&app, req).await;

        assert_eq!(body["patients"], serde_json::json!(["alice"]));
        cleanup(&dir);
    }

    #[actix_web::test]
    async fn test_list_patients_empty_dir() {
        let dir = make_empty_dir();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get().uri("/patients").to_request();
        let body: serde_json::Value = test::call_and_read_body_json(&app, req).await;

        assert_eq!(body["patients"], serde_json::json!([]));
        cleanup(&dir);
    }

    // --- get_video ---

    #[actix_web::test]
    async fn test_get_video_found() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/alice/video")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers().get("content-type").unwrap(), "video/mp4");
        cleanup(&dir);
    }

    #[actix_web::test]
    async fn test_get_video_unknown_patient_returns_404() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/nobody/video")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 404);
        cleanup(&dir);
    }

    // --- get_image ---

    #[actix_web::test]
    async fn test_get_image_found() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/alice/image")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers().get("content-type").unwrap(), "image/png");
        cleanup(&dir);
    }

    #[actix_web::test]
    async fn test_get_image_unknown_patient_returns_404() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/nobody/image")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 404);
        cleanup(&dir);
    }

    // --- get_metadata ---

    #[actix_web::test]
    async fn test_get_metadata_returns_correct_coordinates() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/alice/metadata")
            .to_request();
        let body: serde_json::Value = test::call_and_read_body_json(&app, req).await;

        assert_eq!(body["x1"], 100.0);
        assert_eq!(body["y1"], 200.0);
        assert_eq!(body["x2"], 300.0);
        assert_eq!(body["y2"], 400.0);
        assert_eq!(body["dim_size"], "100 200");
        assert_eq!(body["element_spacing"], "0.5 0.5");
        cleanup(&dir);
    }

    #[actix_web::test]
    async fn test_get_metadata_unknown_patient_returns_404() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        let req = test::TestRequest::get()
            .uri("/patients/nobody/metadata")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 404);
        cleanup(&dir);
    }

    // --- invalid patient names ---

    #[actix_web::test]
    async fn test_path_traversal_is_rejected() {
        let dir = make_dir_with_patient();
        let app = make_app(&dir).await;

        // actix-web will not route a slash inside a path segment, so those get 404.
        // Names with only dots hit our is_valid_name check and return 400.
        for bad_name in &["../secret", "a/b", "a\\b"] {
            let uri = format!("/patients/{bad_name}/metadata");
            let req = test::TestRequest::get().uri(&uri).to_request();
            let resp = test::call_service(&app, req).await;
            assert!(
                resp.status() == 400 || resp.status() == 404,
                "expected 400 or 404 for {bad_name}, got {}",
                resp.status()
            );
        }
        cleanup(&dir);
    }
}
