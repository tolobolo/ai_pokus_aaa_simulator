use actix_cors::Cors;
use actix_web::{web, App, HttpServer};

mod handlers;

// Shared state passed to every handler
pub struct AppState {
    pub data_dir: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data_dir = "data".to_string();

    println!("Server running at http://127.0.0.1:8080");

    HttpServer::new(move || {
        // Allow all origins so the frontend (on a different port) can call us
        let cors = Cors::permissive();

        let state = web::Data::new(AppState {
            data_dir: data_dir.clone(),
        });

        App::new()
            .app_data(state)
            .wrap(cors)
            .route("/patients", web::get().to(handlers::list_patients))
            .route("/patients/{name}/video", web::get().to(handlers::get_video))
            .route("/patients/{name}/image", web::get().to(handlers::get_image))
            .route("/patients/{name}/answer", web::get().to(handlers::get_answer))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
