use actix_files::Files;
use actix_web::{web, App, HttpServer};

mod handlers;

// Shared state passed to every handler
pub struct AppState {
    pub data_dir: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data_dir = "data".to_string();
    let addr = "0.0.0.0:9090";

    println!("Server running at http://{addr}");

    HttpServer::new(move || {
        let state = web::Data::new(AppState {
            data_dir: data_dir.clone(),
        });

        App::new()
            .app_data(state)
            // API routes
            .route("/patients", web::get().to(handlers::list_patients))
            .route("/patients/{name}/video", web::get().to(handlers::get_video))
            .route("/patients/{name}/image", web::get().to(handlers::get_image))
            .route("/patients/{name}/metadata", web::get().to(handlers::get_metadata))
            // Serve the frontend folder at /
            // index_file("index.html") makes / load index.html automatically
            .service(Files::new("/", "../frontend").index_file("index.html"))
    })
    .bind(addr)?
    .run()
    .await
}
