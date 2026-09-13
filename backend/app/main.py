from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import products, icons

app = FastAPI(title="Label System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(icons.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
