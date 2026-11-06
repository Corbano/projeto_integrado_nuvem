from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Auto Center API", version="0.1.0")

    @app.get("/health", tags=["infra"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
