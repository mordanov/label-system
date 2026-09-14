from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import icons
from .config import settings
from .routers import label_settings

app = FastAPI(title="Label System", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.remote_backend_url:
    from .routers import proxy
    app.include_router(proxy.router)
else:
    from .routers import products
    app.include_router(products.router)
    app.include_router(label_settings.router)

app.include_router(icons.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/config")
async def config():
    return {"print_enabled": settings.print_enabled}
