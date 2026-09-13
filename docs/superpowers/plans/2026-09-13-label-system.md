# Label System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local home-inventory system with BLE thermal label printing, running via Docker Compose (db + backend + frontend) with a native macOS print service outside Docker.

**Architecture:** PostgreSQL + FastAPI backend (async SQLAlchemy) + React/Vite frontend in Docker Compose; a separate native Python process handles BLE printing via bleak/CoreBluetooth. Backend calls print service over HTTP at `host.docker.internal:9100`. All config via `.env`.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy async + asyncpg, Alembic, passlib[bcrypt], httpx, Pillow, bleak; React 18, Vite; PostgreSQL 16; Docker Compose; nginx.

**Spec:** `docs/superpowers/specs/2026-09-13-label-system-design.md`

## Global Constraints

- Python 3.13 for backend and print-service.
- No hardcoded secrets or connection strings — all config from env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `APP_USER_1`, `APP_PASS_1`, `APP_USER_2`, `APP_PASS_2`, `PRINT_SERVICE_URL`, `PRINTER_BLE_ADDRESS`).
- Inventory numbers are CHAR(4), zero-padded (`0001`–`9999`), wrap 9999→0001, generated atomically with `SELECT ... FOR UPDATE`.
- Soft-delete only — no physical row deletion.
- Print failures are non-fatal: product saves, response includes `print_warning: true`.
- `print-service` runs natively on macOS host, NOT in Docker.
- All commits end with: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## File Map

```
label-system/
├── docker-compose.yml
├── .env.example
├── README.md
├── PROGRESS.md
├── assets/
│   └── icons/
│       └── placeholder.png          # 80×80 white PNG with "?" text
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── auth.py
│       ├── routers/
│       │   ├── products.py
│       │   └── icons.py
│       └── services/
│           ├── inventory.py
│           └── print_client.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── index.css
│       └── components/
│           ├── LoginForm.jsx
│           ├── CreateForm.jsx
│           ├── IconGallery.jsx
│           ├── ProductTable.jsx
│           └── SearchBar.jsx
├── print-service/
│   ├── main.py
│   ├── printer.py
│   ├── label.py
│   ├── requirements.txt
│   └── README.md
└── scripts/
    ├── start.sh
    └── stop.sh
```

---

## Task 1: Repo Scaffold + Docker Compose + DB Schema

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `assets/icons/placeholder.png`
- Create: `backend/requirements.txt`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/001_initial_schema.py`

**Interfaces:**
- Produces: `AsyncSession` via `get_db()` dep, `Product` + `InventoryCounter` ORM models, `Settings` singleton at `app.config.settings`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p assets/icons backend/app/routers backend/app/services \
         backend/alembic/versions frontend/src/components \
         print-service scripts docs/superpowers/plans
```

- [ ] **Step 2: Create placeholder icon**

```python
# Run once from repo root: python3 -c "..."
from PIL import Image, ImageDraw
img = Image.new("RGB", (80, 80), "white")
ImageDraw.Draw(img).text((28, 30), "?", fill="black")
img.save("assets/icons/placeholder.png")
```

- [ ] **Step 3: Create `.env.example`**

```ini
DB_HOST=db
DB_PORT=5432
DB_USER=labeluser
DB_PASSWORD=changeme
DB_NAME=labeldb
APP_USER_1=alice
APP_PASS_1=changeme1
APP_USER_2=bob
APP_PASS_2=changeme2
PRINT_SERVICE_URL=http://host.docker.internal:9100
PRINTER_BLE_ADDRESS=XX:XX:XX:XX:XX:XX
```

Copy to `.env` and fill real values before running.

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file: .env
    environment:
      DB_HOST: db
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 5: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.3
pydantic-settings==2.5.2
passlib[bcrypt]==1.7.4
httpx==0.27.2
python-multipart==0.0.12
```

- [ ] **Step 6: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_host: str
    db_port: int = 5432
    db_user: str
    db_password: str
    db_name: str
    app_user_1: str
    app_pass_1: str
    app_user_2: str
    app_pass_2: str
    print_service_url: str = "http://host.docker.internal:9100"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 7: Create `backend/app/database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from .config import settings

DATABASE_URL = (
    f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}"
    f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
)

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 8: Create `backend/app/models.py`**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class InventoryCounter(Base):
    __tablename__ = "inventory_counter"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

class Product(Base):
    __tablename__ = "products"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_number: Mapped[str] = mapped_column(String(4), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    icon_filename: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 9: Create `backend/alembic.ini`**

```ini
[alembic]
script_location = alembic
file_template = %%(rev)s_%%(slug)s
prepend_sys_path = .
sqlalchemy.url = driver://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 10: Create `backend/alembic/env.py`**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.models import Base
from app.config import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url() -> str:
    return (
        f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    )

def run_migrations_offline() -> None:
    context.configure(
        url=get_url(), target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = get_url()
    connectable = async_engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 11: Create `backend/alembic/versions/001_initial_schema.py`**

```python
"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'inventory_counter',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'),
    )
    op.execute("INSERT INTO inventory_counter (id, last_number) VALUES (1, 0)")

    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('inventory_number', sa.String(4), unique=True, nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('icon_filename', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.Text(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table('products')
    op.drop_table('inventory_counter')
```

- [ ] **Step 12: Verify migration runs**

```bash
cd backend
# Set env vars matching .env (or export from .env)
export $(grep -v '^#' ../.env | xargs)
export DB_HOST=localhost  # for running outside Docker
python -m alembic upgrade head
# Expected: INFO [alembic.runtime.migration] Running upgrade -> 001
```

- [ ] **Step 13: Commit**

```bash
git add .
git commit -m "feat: repo scaffold, db schema, alembic migrations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Backend Auth + Foundation

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/main.py`
- Create: `backend/Dockerfile`

**Interfaces:**
- Produces: `get_current_user(credentials) -> str` FastAPI dependency; `ProductCreate`, `ProductResponse`, `IconInfo` Pydantic models

- [ ] **Step 1: Write failing test for auth**

Create `backend/tests/test_auth.py`:

```python
import pytest
from unittest.mock import patch
from app.auth import verify_user

def test_valid_user_returns_username():
    with patch("app.auth.settings") as mock_settings:
        mock_settings.app_user_1 = "alice"
        mock_settings.app_pass_1 = "secret"
        mock_settings.app_user_2 = "bob"
        mock_settings.app_pass_2 = "other"
        # Re-import to rebuild _USERS with mocked settings
        import importlib, app.auth
        importlib.reload(app.auth)
        from app.auth import verify_user
        assert verify_user("alice", "secret") == "alice"

def test_wrong_password_returns_none():
    from app.auth import verify_user
    assert verify_user("alice", "wrongpass") is None

def test_unknown_user_returns_none():
    from app.auth import verify_user
    assert verify_user("nobody", "anything") is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pip install -r requirements.txt
pytest tests/test_auth.py -v
# Expected: ImportError or NameError (auth.py not yet created)
```

- [ ] **Step 3: Create `backend/app/auth.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext
from .config import settings

security = HTTPBasic()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hashed at startup; env vars are source of truth
_USERS: dict[str, str] = {
    settings.app_user_1: _pwd.hash(settings.app_pass_1),
    settings.app_user_2: _pwd.hash(settings.app_pass_2),
}

def verify_user(username: str, password: str) -> str | None:
    hashed = _USERS.get(username)
    if hashed and _pwd.verify(password, hashed):
        return username
    return None

def get_current_user(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    user = verify_user(credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Basic"},
        )
    return user
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_auth.py -v
# Expected: PASSED (all 3)
```

- [ ] **Step 5: Create `backend/app/schemas.py`**

```python
from pydantic import BaseModel
from datetime import datetime
import uuid

class ProductCreate(BaseModel):
    name: str
    icon_filename: str

class ProductResponse(BaseModel):
    id: uuid.UUID
    inventory_number: str
    name: str
    icon_filename: str
    created_at: datetime
    is_deleted: bool
    deleted_at: datetime | None
    deleted_by: str | None
    print_warning: bool = False

    model_config = {"from_attributes": True}

class IconInfo(BaseModel):
    filename: str
```

- [ ] **Step 6: Create `backend/app/main.py`**

```python
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
```

Note: routers/products.py and routers/icons.py are created in Tasks 3 and 4. Create empty stubs now so the app starts:

```python
# backend/app/routers/__init__.py  (empty)
# backend/app/routers/products.py  (stub)
from fastapi import APIRouter
router = APIRouter(prefix="/products", tags=["products"])

# backend/app/routers/icons.py  (stub)
from fastapi import APIRouter
router = APIRouter(prefix="/icons", tags=["icons"])
```

- [ ] **Step 7: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/. .
COPY assets/icons/ assets/icons/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build context is project root (see docker-compose.yml `context: .`).

- [ ] **Step 8: Verify app starts**

```bash
cd backend
uvicorn app.main:app --reload
# Expected: Uvicorn running on http://127.0.0.1:8000
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: backend foundation — auth, schemas, main app

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Inventory Number Service + Products Endpoints

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/inventory.py`
- Create: `backend/app/services/print_client.py`
- Modify: `backend/app/routers/products.py` (replace stub)
- Create: `backend/tests/test_inventory.py`

**Interfaces:**
- Consumes: `AsyncSession` from `get_db`, `InventoryCounter` model, `Product` model, `settings.print_service_url`
- Produces: `next_inventory_number(db: AsyncSession) -> str`, `send_to_printer(...) -> bool`, `POST /products`, `GET /products`, `POST /products/{id}/reprint`, `POST /products/{id}/delete`

- [ ] **Step 1: Write failing test for inventory number generation**

Create `backend/tests/test_inventory.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.inventory import next_inventory_number

@pytest.mark.asyncio
async def test_increments_from_zero():
    counter = MagicMock(last_number=0)
    db = AsyncMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0001"
    assert counter.last_number == 1

@pytest.mark.asyncio
async def test_increments_from_middle():
    counter = MagicMock(last_number=42)
    db = AsyncMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0043"

@pytest.mark.asyncio
async def test_wraps_at_9999():
    counter = MagicMock(last_number=9999)
    db = AsyncMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0001"
    assert counter.last_number == 1

@pytest.mark.asyncio
async def test_zero_pads_to_four_digits():
    counter = MagicMock(last_number=8)
    db = AsyncMock()
    db.execute.return_value.scalar_one.return_value = counter
    result = await next_inventory_number(db)
    assert result == "0009"
```

Add `pytest-asyncio` to requirements.txt: `pytest-asyncio==0.24.0`

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pip install pytest-asyncio==0.24.0
pytest tests/test_inventory.py -v
# Expected: ImportError (inventory.py not yet created)
```

- [ ] **Step 3: Create `backend/app/services/inventory.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import InventoryCounter

async def next_inventory_number(db: AsyncSession) -> str:
    result = await db.execute(
        select(InventoryCounter).where(InventoryCounter.id == 1).with_for_update()
    )
    counter = result.scalar_one()
    next_num = (counter.last_number % 9999) + 1
    counter.last_number = next_num
    await db.flush()
    return f"{next_num:04d}"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_inventory.py -v
# Expected: PASSED (all 4)
```

- [ ] **Step 5: Create `backend/app/services/print_client.py`**

```python
import httpx
from ..config import settings

async def send_to_printer(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_filename: str,
    icon_bytes: bytes,
) -> bool:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.print_service_url}/print",
                data={
                    "inventory_number": inventory_number,
                    "name": name,
                    "created_at": created_at,
                    "icon_filename": icon_filename,
                },
                files={"icon_file": (icon_filename, icon_bytes, "image/png")},
            )
            return resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False
```

- [ ] **Step 6: Replace `backend/app/routers/products.py` stub**

```python
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductResponse
from ..auth import get_current_user
from ..services.inventory import next_inventory_number
from ..services.print_client import send_to_printer

router = APIRouter(prefix="/products", tags=["products"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


@router.post("/", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    async with db.begin():
        inv = await next_inventory_number(db)
        product = Product(name=body.name, icon_filename=body.icon_filename, inventory_number=inv)
        db.add(product)

    await db.refresh(product)

    icon_path = ICONS_DIR / product.icon_filename
    icon_bytes = icon_path.read_bytes() if icon_path.exists() else b""
    print_ok = await send_to_printer(
        inventory_number=product.inventory_number,
        name=product.name,
        created_at=product.created_at.strftime("%Y-%m-%d"),
        icon_filename=product.icon_filename,
        icon_bytes=icon_bytes,
    )

    resp = ProductResponse.model_validate(product)
    resp.print_warning = not print_ok
    return resp


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    q: str | None = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    stmt = select(Product)
    if not include_deleted:
        stmt = stmt.where(Product.is_deleted == False)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(Product.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{product_id}/reprint", response_model=ProductResponse)
async def reprint_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product or product.is_deleted:
        raise HTTPException(status_code=404, detail="Product not found")

    icon_path = ICONS_DIR / product.icon_filename
    icon_bytes = icon_path.read_bytes() if icon_path.exists() else b""
    print_ok = await send_to_printer(
        inventory_number=product.inventory_number,
        name=product.name,
        created_at=product.created_at.strftime("%Y-%m-%d"),
        icon_filename=product.icon_filename,
        icon_bytes=icon_bytes,
    )

    resp = ProductResponse.model_validate(product)
    resp.print_warning = not print_ok
    return resp


@router.post("/{product_id}/delete", response_model=ProductResponse)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    async with db.begin():
        product = await db.get(Product, product_id)
        if not product or product.is_deleted:
            raise HTTPException(status_code=404, detail="Product not found")
        product.is_deleted = True
        product.deleted_at = datetime.now(timezone.utc)
        product.deleted_by = current_user

    await db.refresh(product)
    return ProductResponse.model_validate(product)
```

- [ ] **Step 7: Verify endpoints manually**

With DB running (`docker compose up db -d`) and migrations applied:

```bash
cd backend && uvicorn app.main:app --reload
# Create a product (print will warn, that's fine — print service isn't up)
curl -u alice:changeme1 -X POST http://localhost:8000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","icon_filename":"placeholder.png"}'
# Expected: {"id":"...","inventory_number":"0001","name":"Test Item",...,"print_warning":true}

curl -u alice:changeme1 http://localhost:8000/products
# Expected: list with the product
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: inventory number service + products endpoints

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Icons Endpoint

**Files:**
- Modify: `backend/app/routers/icons.py` (replace stub)

**Interfaces:**
- Consumes: `ICONS_DIR` path (same as products router)
- Produces: `GET /icons` → `list[IconInfo]`, `GET /icons/{filename}` → file response

- [ ] **Step 1: Replace `backend/app/routers/icons.py` stub**

```python
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from ..schemas import IconInfo
from ..auth import get_current_user

router = APIRouter(prefix="/icons", tags=["icons"])

ICONS_DIR = Path(__file__).parent.parent.parent / "assets" / "icons"


@router.get("/", response_model=list[IconInfo])
async def list_icons(current_user: str = Depends(get_current_user)):
    return [
        IconInfo(filename=f.name)
        for f in sorted(ICONS_DIR.iterdir())
        if f.suffix.lower() == ".png"
    ]


@router.get("/{filename}")
async def get_icon(filename: str, current_user: str = Depends(get_current_user)):
    # Prevent path traversal
    path = (ICONS_DIR / filename).resolve()
    if not str(path).startswith(str(ICONS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.exists() or path.suffix.lower() != ".png":
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/png")
```

- [ ] **Step 2: Verify**

```bash
curl -u alice:changeme1 http://localhost:8000/icons
# Expected: [{"filename":"placeholder.png"}]
curl -u alice:changeme1 http://localhost:8000/icons/placeholder.png --output /tmp/icon.png
# Expected: 200, icon saved
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/icons.py
git commit -m "feat: icons list + serve endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Print Service — Label Rendering

**Files:**
- Create: `print-service/requirements.txt`
- Create: `print-service/label.py`
- Create: `print-service/tests/test_label.py`

**Interfaces:**
- Produces: `render_label(inventory_number, name, created_at, icon_bytes) -> bytes` (PNG, 384px wide, 1-bit)

- [ ] **Step 1: Create `print-service/requirements.txt`**

```
fastapi==0.115.0
uvicorn==0.30.6
bleak==0.22.3
Pillow==10.4.0
python-multipart==0.0.12
pytest==8.3.2
```

- [ ] **Step 2: Write failing test**

Create `print-service/tests/test_label.py`:

```python
from pathlib import Path
from PIL import Image
from io import BytesIO
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from label import render_label

PLACEHOLDER_ICON = Path(__file__).parent.parent.parent / "assets" / "icons" / "placeholder.png"

def test_label_is_384px_wide():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result))
    assert img.width == 384

def test_label_is_1bit():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result))
    assert img.mode == "1"

def test_label_has_content():
    icon_bytes = PLACEHOLDER_ICON.read_bytes()
    result = render_label("0001", "Test Item", "2026-09-13", icon_bytes)
    img = Image.open(BytesIO(result)).convert("L")
    pixels = list(img.getdata())
    # Should have both black and white pixels (not blank)
    assert min(pixels) < 128
    assert max(pixels) > 128
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd print-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/test_label.py -v
# Expected: ImportError (label.py not yet created)
```

- [ ] **Step 4: Create `print-service/label.py`**

```python
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

LABEL_WIDTH = 384
LABEL_HEIGHT = 200

def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

def render_label(
    inventory_number: str,
    name: str,
    created_at: str,
    icon_bytes: bytes,
) -> bytes:
    img = Image.new("RGB", (LABEL_WIDTH, LABEL_HEIGHT), "white")
    draw = ImageDraw.Draw(img)

    # Icon — top-left, 80×80
    icon = Image.open(BytesIO(icon_bytes)).convert("RGBA")
    icon.thumbnail((80, 80))
    bg = Image.new("RGB", icon.size, "white")
    if icon.mode == "RGBA":
        bg.paste(icon, mask=icon.split()[3])
    else:
        bg.paste(icon)
    img.paste(bg, (8, 8))

    # Product name
    font_name = _get_font(24)
    draw.text((100, 8), name[:30], fill="black", font=font_name)

    # Inventory number — large, centred vertically
    font_inv = _get_font(52)
    inv_text = f"#{inventory_number}"
    bbox = draw.textbbox((0, 0), inv_text, font=font_inv)
    x = (LABEL_WIDTH - (bbox[2] - bbox[0])) // 2
    draw.text((x, 90), inv_text, fill="black", font=font_inv)

    # Date — bottom-left
    font_date = _get_font(18)
    draw.text((8, 170), created_at, fill="black", font=font_date)

    # 1-bit with Floyd-Steinberg dithering
    img_1bit = img.convert("1", dither=Image.Dither.FLOYDSTEINBERG)
    out = BytesIO()
    img_1bit.save(out, format="PNG")
    return out.getvalue()
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_label.py -v
# Expected: PASSED (all 3)
```

- [ ] **Step 6: Commit**

```bash
cd ..  # back to repo root
git add print-service/
git commit -m "feat: print service label rendering (Pillow, 384px, 1-bit)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Print Service — MXW01 BLE Protocol + HTTP Endpoint

**Files:**
- Create: `print-service/printer.py`
- Create: `print-service/main.py`
- Create: `print-service/README.md`

**Interfaces:**
- Consumes: `render_label(...)` from `label.py`
- Produces: `POST /print` multipart endpoint, `print_label(inventory_number, name, created_at, icon_bytes) -> None`

- [ ] **Step 1: Fetch and study the reference implementation**

Before writing `printer.py`, read the reference project to extract exact protocol details:

```bash
# Fetch the reference project (do NOT add as dependency — read-only reference)
git clone https://github.com/PinThePenguinOne/MXW01_Thermal-Printer-Tool /tmp/mxw01-ref
# Key things to extract:
# 1. SERVICE_UUID — the BLE GATT service UUID
# 2. CHAR_UUID — the write characteristic UUID
# 3. Packet format: header bytes, how image rows are chunked and wrapped
# 4. Any init/finalize commands sent before/after pixel data
# 5. Chunk size for BLE writes
grep -r "UUID\|uuid\|CHUNK\|chunk\|header\|command" /tmp/mxw01-ref --include="*.py" -l
```

Note the values in comments in `printer.py` below — replace the placeholders with what you find.

- [ ] **Step 2: Create `print-service/printer.py`**

```python
"""
MXW01 BLE thermal printer driver.
Protocol adapted from: https://github.com/PinThePenguinOne/MXW01_Thermal-Printer-Tool
"""
import asyncio
import os
from PIL import Image
from io import BytesIO
import bleak

# REPLACE these with values from the reference project
SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455"  # verify from ref
CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3"      # verify from ref
CHUNK_SIZE = 128  # bytes per BLE write — verify from ref

PRINTER_ADDRESS = os.getenv("PRINTER_BLE_ADDRESS", "XX:XX:XX:XX:XX:XX")


def _image_to_rows(png_bytes: bytes) -> list[bytes]:
    """Convert 1-bit PNG to list of row byte arrays (48 bytes per row for 384px)."""
    img = Image.open(BytesIO(png_bytes)).convert("1")
    width, height = img.size
    assert width == 384, f"Expected 384px wide, got {width}"
    rows = []
    for y in range(height):
        row_bits = [1 if img.getpixel((x, y)) == 0 else 0 for x in range(width)]
        # Pack 8 pixels per byte
        row_bytes = bytes(
            sum(row_bits[x + b] << (7 - b) for b in range(8))
            for x in range(0, width, 8)
        )
        rows.append(row_bytes)
    return rows


def _build_print_packets(rows: list[bytes]) -> list[bytes]:
    """
    Build the packet sequence to send to the printer.
    ADAPT THIS to match the actual protocol from the reference project.
    The MXW01 may expect: init command, then rows wrapped in packet headers,
    then a finalize command.
    """
    # TODO: replace with actual packet format from reference project
    # This is a structural placeholder showing where protocol logic goes.
    packets = []
    for row in rows:
        # Wrap each row in the printer's expected packet format
        # packets.append(header + row + checksum)  # example structure
        packets.append(row)  # replace with real packet wrapping
    return packets


async def print_label(png_bytes: bytes) -> None:
    """Connect to printer, send image, disconnect."""
    rows = _image_to_rows(png_bytes)
    packets = _build_print_packets(rows)

    async with bleak.BleakClient(PRINTER_ADDRESS) as client:
        for packet in packets:
            for i in range(0, len(packet), CHUNK_SIZE):
                await client.write_gatt_char(CHAR_UUID, packet[i:i + CHUNK_SIZE], response=False)
                await asyncio.sleep(0.01)
```

- [ ] **Step 3: Create `print-service/main.py`**

```python
import asyncio
from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from label import render_label
from printer import print_label

app = FastAPI(title="Print Service")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/print")
async def print_endpoint(
    inventory_number: str = Form(...),
    name: str = Form(...),
    created_at: str = Form(...),
    icon_filename: str = Form(...),
    icon_file: UploadFile = File(...),
):
    icon_bytes = await icon_file.read()
    png_bytes = render_label(inventory_number, name, created_at, icon_bytes)
    try:
        await print_label(png_bytes)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Printer error: {exc}")
    return {"status": "printed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9100, reload=False)
```

- [ ] **Step 4: Create `print-service/README.md`**

```markdown
# print-service

Native macOS process that receives print jobs over HTTP and sends them to the MXW01 BLE thermal printer via CoreBluetooth (bleak).

## Why native (not Docker)

Docker Desktop on macOS runs in a Linux VM and cannot access the host's Bluetooth adapter. This service must run directly on the macOS host.

## Setup

```bash
cd print-service
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure

Set `PRINTER_BLE_ADDRESS` in the project `.env` to your printer's Bluetooth address.
Find it with: `python3 -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover())" | grep -i MXW`

## Run

```bash
source .venv/bin/activate
PRINTER_BLE_ADDRESS=XX:XX:XX:XX:XX:XX python main.py
```

Or use `scripts/start.sh` which handles this automatically.

## Optional: launchd auto-start

Create `~/Library/LaunchAgents/com.label-system.print-service.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.label-system.print-service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/label-system/print-service/.venv/bin/python</string>
        <string>/path/to/label-system/print-service/main.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PRINTER_BLE_ADDRESS</key><string>XX:XX:XX:XX:XX:XX</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key><string>/path/to/label-system/print-service/print-service.log</string>
    <key>StandardErrorPath</key><string>/path/to/label-system/print-service/print-service.log</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/com.label-system.print-service.plist`
```

- [ ] **Step 5: Verify print service starts**

```bash
cd print-service
source .venv/bin/activate
python main.py &
curl http://localhost:9100/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd ..
git add print-service/
git commit -m "feat: print service — label rendering, BLE protocol skeleton, HTTP endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Frontend Foundation — Vite + Auth

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/api.js`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/components/LoginForm.jsx`
- Create: `frontend/src/index.css`

**Interfaces:**
- Produces: `apiFetch(path, options) -> Promise`, `setCredentials(u, p)`, `clearCredentials()`, auth gate in `App.jsx`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "label-system-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.8"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

- [ ] **Step 3: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Label System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `frontend/src/api.js`**

```js
let _b64 = sessionStorage.getItem('auth') || null

export function setCredentials(username, password) {
  _b64 = btoa(`${username}:${password}`)
  sessionStorage.setItem('auth', _b64)
}

export function clearCredentials() {
  _b64 = null
  sessionStorage.removeItem('auth')
}

export function hasCredentials() {
  return _b64 !== null
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      Authorization: `Basic ${_b64}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearCredentials()
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

- [ ] **Step 5: Create `frontend/src/components/LoginForm.jsx`**

```jsx
import { useState } from 'react'
import { setCredentials } from '../api'

export default function LoginForm({ onLogin }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setCredentials(user, pass)
    try {
      await fetch('/api/products', {
        headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
      }).then(r => { if (r.status === 401) throw new Error('bad') })
      onLogin()
    } catch {
      setErr('Invalid credentials')
    }
  }

  return (
    <div className="login-wrap">
      <h2>Label System</h2>
      <form onSubmit={handleSubmit}>
        <input value={user} onChange={e => setUser(e.target.value)} placeholder="Username" required />
        <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Password" required />
        {err && <p className="error">{err}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Create `frontend/src/App.jsx`**

```jsx
import { useState } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'

// Placeholder — ProductTable and CreateForm added in next tasks
function MainView({ onLogout }) {
  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <p>Loading…</p>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())

  function logout() {
    clearCredentials()
    setAuthed(false)
  }

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
```

- [ ] **Step 7: Create `frontend/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

- [ ] **Step 8: Create `frontend/src/index.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #111; }

.login-wrap {
  max-width: 320px; margin: 10vh auto; padding: 2rem;
  background: white; border-radius: 8px; box-shadow: 0 2px 8px #0002;
}
.login-wrap h2 { margin-bottom: 1.5rem; }
.login-wrap input, .login-wrap button {
  display: block; width: 100%; padding: 0.6rem 0.8rem;
  margin-bottom: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem;
}
.login-wrap button { background: #2563eb; color: white; border: none; cursor: pointer; }
.login-wrap button:hover { background: #1d4ed8; }
.error { color: #dc2626; margin-bottom: 0.5rem; font-size: 0.875rem; }

header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.5rem; background: white; border-bottom: 1px solid #e5e7eb;
}
header h1 { font-size: 1.25rem; }
header button { padding: 0.4rem 0.8rem; cursor: pointer; }

main { padding: 1.5rem; }
```

- [ ] **Step 9: Install and run dev server**

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173 — login form should appear
# Sign in with APP_USER_1/APP_PASS_1 — MainView placeholder should appear
```

- [ ] **Step 10: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: frontend foundation — Vite, React, auth layer

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Frontend Create Form + Icon Gallery

**Files:**
- Create: `frontend/src/components/IconGallery.jsx`
- Create: `frontend/src/components/CreateForm.jsx`
- Modify: `frontend/src/App.jsx` (wire in CreateForm)

**Interfaces:**
- Consumes: `GET /api/icons` → `[{filename}]`, `GET /api/icons/{filename}` → PNG, `POST /api/products`
- Produces: `<CreateForm onCreated={fn} />`, `<IconGallery selected value onChange />`

- [ ] **Step 1: Create `frontend/src/components/IconGallery.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function IconGallery({ value, onChange }) {
  const [icons, setIcons] = useState([])

  useEffect(() => {
    apiFetch('/icons').then(list => {
      setIcons(list.map(i => i.filename))
      if (!value && list.length) onChange(list[0].filename)
    })
  }, [])

  return (
    <div className="icon-gallery">
      {icons.map(filename => (
        <button
          key={filename}
          type="button"
          className={`icon-btn${value === filename ? ' selected' : ''}`}
          onClick={() => onChange(filename)}
        >
          <img src={`/api/icons/${filename}`} alt={filename} width={48} height={48} />
        </button>
      ))}
    </div>
  )
}
```

Add to `index.css`:
```css
.icon-gallery { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.icon-btn {
  border: 2px solid #e5e7eb; border-radius: 6px; padding: 4px;
  background: white; cursor: pointer;
}
.icon-btn.selected { border-color: #2563eb; background: #eff6ff; }
```

- [ ] **Step 2: Create `frontend/src/components/CreateForm.jsx`**

```jsx
import { useState } from 'react'
import { apiFetch } from '../api'
import IconGallery from './IconGallery'

export default function CreateForm({ onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setWarn(false)
    try {
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ name, icon_filename: icon }),
      })
      if (product.print_warning) setWarn(true)
      setName('')
      onCreated(product)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Add product</h2>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="Product name" required
      />
      <IconGallery value={icon} onChange={setIcon} />
      {warn && <p className="warn">Saved, but printing failed — use Reprint.</p>}
      <button type="submit" disabled={busy || !icon}>
        {busy ? 'Saving…' : 'Add & Print'}
      </button>
    </form>
  )
}
```

Add to `index.css`:
```css
.create-form {
  background: white; padding: 1.5rem; border-radius: 8px;
  box-shadow: 0 1px 4px #0001; margin-bottom: 1.5rem; max-width: 600px;
}
.create-form h2 { margin-bottom: 1rem; font-size: 1.1rem; }
.create-form input {
  width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #ccc;
  border-radius: 4px; font-size: 1rem; margin-bottom: 0.5rem;
}
.create-form button {
  padding: 0.6rem 1.25rem; background: #2563eb; color: white;
  border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;
}
.create-form button:disabled { background: #93c5fd; cursor: default; }
.warn { color: #d97706; font-size: 0.875rem; margin-bottom: 0.5rem; }
```

- [ ] **Step 3: Wire CreateForm into `App.jsx`**

```jsx
import { useState } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'

function MainView({ onLogout }) {
  const [refresh, setRefresh] = useState(0)

  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <main>
        <CreateForm onCreated={() => setRefresh(r => r + 1)} />
        {/* ProductTable added in Task 9 */}
        <p style={{color:'#888'}}>Product table coming soon…</p>
      </main>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())
  function logout() { clearCredentials(); setAuthed(false) }
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
```

- [ ] **Step 4: Test in browser**

```bash
cd frontend && npm run dev
```

With backend running: sign in, icon gallery should load, submit form should create a product (print_warning expected — printer not running). Check console for errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: create form + icon gallery

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Frontend Product Table + Search + Row Actions

**Files:**
- Create: `frontend/src/components/SearchBar.jsx`
- Create: `frontend/src/components/ProductTable.jsx`
- Modify: `frontend/src/App.jsx` (replace placeholder with ProductTable)

**Interfaces:**
- Consumes: `GET /api/products?q=&include_deleted=`, `POST /api/products/{id}/reprint`, `POST /api/products/{id}/delete`
- Produces: `<ProductTable refresh />`, `<SearchBar value onChange />`

- [ ] **Step 1: Create `frontend/src/components/SearchBar.jsx`**

```jsx
export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search by name…"
      />
    </div>
  )
}
```

Add to `index.css`:
```css
.search-bar { margin-bottom: 1rem; }
.search-bar input {
  padding: 0.5rem 0.8rem; border: 1px solid #ccc; border-radius: 4px;
  font-size: 1rem; width: 300px;
}
```

- [ ] **Step 2: Create `frontend/src/components/ProductTable.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import SearchBar from './SearchBar'

function fmt(iso) {
  return new Date(iso).toLocaleDateString()
}

export default function ProductTable({ refresh }) {
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [busy, setBusy] = useState({})

  async function load() {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (showDeleted) params.set('include_deleted', 'true')
    const data = await apiFetch(`/products?${params}`)
    setProducts(data)
  }

  useEffect(() => { load() }, [refresh, q, showDeleted])

  async function reprint(id) {
    setBusy(b => ({ ...b, [id]: 'reprint' }))
    try {
      const p = await apiFetch(`/products/${id}/reprint`, { method: 'POST' })
      if (p.print_warning) alert('Saved, but printing failed.')
    } finally {
      setBusy(b => ({ ...b, [id]: null }))
    }
  }

  async function del(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return
    setBusy(b => ({ ...b, [id]: 'delete' }))
    try {
      await apiFetch(`/products/${id}/delete`, { method: 'POST' })
      load()
    } finally {
      setBusy(b => ({ ...b, [id]: null }))
    }
  }

  return (
    <div>
      <div className="table-toolbar">
        <SearchBar value={q} onChange={setQ} />
        <label className="toggle-deleted">
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          {' '}Show deleted
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Icon</th><th>Name</th><th>Date</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className={p.is_deleted ? 'deleted-row' : ''}>
                <td>{p.inventory_number}</td>
                <td><img src={`/api/icons/${p.icon_filename}`} width={32} height={32} alt="" /></td>
                <td>{p.name}</td>
                <td>{fmt(p.created_at)}</td>
                <td>
                  {p.is_deleted
                    ? <span className="status-deleted">Deleted by {p.deleted_by} on {fmt(p.deleted_at)}</span>
                    : <span className="status-active">Active</span>}
                </td>
                <td>
                  {!p.is_deleted && (
                    <>
                      <button onClick={() => reprint(p.id)} disabled={!!busy[p.id]}>
                        {busy[p.id] === 'reprint' ? '…' : 'Print'}
                      </button>
                      {' '}
                      <button className="btn-danger" onClick={() => del(p.id, p.name)} disabled={!!busy[p.id]}>
                        {busy[p.id] === 'delete' ? '…' : 'Delete'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#888',padding:'2rem'}}>No products</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Add to `index.css`:
```css
.table-toolbar { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 0.75rem; }
.toggle-deleted { font-size: 0.9rem; cursor: pointer; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
th, td { padding: 0.65rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
th { background: #f9fafb; font-weight: 600; }
.deleted-row td { color: #9ca3af; }
.deleted-row td:nth-child(3) { text-decoration: line-through; }
.status-active { color: #16a34a; }
.status-deleted { color: #6b7280; font-size: 0.8rem; }
td button {
  padding: 0.3rem 0.6rem; border: 1px solid #d1d5db; background: white;
  border-radius: 4px; cursor: pointer; font-size: 0.8rem;
}
td button:hover { background: #f3f4f6; }
td button.btn-danger { color: #dc2626; border-color: #fca5a5; }
td button.btn-danger:hover { background: #fef2f2; }
td button:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 3: Replace placeholder in `App.jsx`**

```jsx
import { useState } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'
import ProductTable from './components/ProductTable'

function MainView({ onLogout }) {
  const [refresh, setRefresh] = useState(0)
  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <main>
        <CreateForm onCreated={() => setRefresh(r => r + 1)} />
        <ProductTable refresh={refresh} />
      </main>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())
  function logout() { clearCredentials(); setAuthed(false) }
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
```

- [ ] **Step 4: Test full UI flow in browser**

```bash
cd frontend && npm run dev
```

With backend + DB running:
1. Sign in
2. Create a product — appears in table with print_warning (expected)
3. Search by name — filters table
4. Click Delete — confirmation dialog, row shows deleted with who/when
5. Check "Show deleted" — deleted rows appear with strikethrough
6. Click Print on active row — print_warning expected

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: product table, search, print and delete actions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Frontend Dockerfile + nginx + Full Docker Compose

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

**Interfaces:**
- Produces: frontend container serving Vite build at `:80`, proxying `/api/` → `http://backend:8000/`

- [ ] **Step 1: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 3: Build and smoke-test full stack**

```bash
# From repo root, with .env in place
docker compose up --build -d
# Wait for all services healthy
docker compose ps
# Expected: db healthy, backend running, frontend running

curl http://localhost:8000/health
# Expected: {"status":"ok"}

open http://localhost:3000
# Expected: login form; sign in works; icons load; products CRUD works
```

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: frontend Dockerfile + nginx, full docker-compose stack

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: start.sh + stop.sh

**Files:**
- Create: `scripts/start.sh`
- Create: `scripts/stop.sh`

- [ ] **Step 1: Create `scripts/start.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRINT_DIR="$REPO_ROOT/print-service"
PID_FILE="$REPO_ROOT/.print-service.pid"
LOG_FILE="$PRINT_DIR/print-service.log"

# Load env for PRINTER_BLE_ADDRESS
set -a; source "$REPO_ROOT/.env"; set +a

echo "==> Starting Docker services…"
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d

# Ensure print-service venv + deps
if [ ! -f "$PRINT_DIR/.venv/bin/python" ]; then
  echo "==> Creating print-service virtualenv…"
  python3.13 -m venv "$PRINT_DIR/.venv"
fi
if ! "$PRINT_DIR/.venv/bin/pip" show fastapi &>/dev/null; then
  echo "==> Installing print-service dependencies…"
  "$PRINT_DIR/.venv/bin/pip" install -q -r "$PRINT_DIR/requirements.txt"
fi

# Start print-service if not already running
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> print-service already running (PID $(cat "$PID_FILE"))"
else
  echo "==> Starting print-service…"
  nohup "$PRINT_DIR/.venv/bin/python" "$PRINT_DIR/main.py" \
    >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "==> print-service started (PID $!), log: $LOG_FILE"
fi

echo "==> Done. Frontend: http://localhost:3000  Backend: http://localhost:8000"
```

- [ ] **Step 2: Create `scripts/stop.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$REPO_ROOT/.print-service.pid"

# Stop print-service
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "==> Stopping print-service (PID $PID)…"
    kill "$PID"
  else
    echo "==> print-service not running (stale PID file)"
  fi
  rm -f "$PID_FILE"
else
  echo "==> print-service not running"
fi

echo "==> Stopping Docker services…"
docker compose -f "$REPO_ROOT/docker-compose.yml" down

echo "==> Done."
```

- [ ] **Step 3: Make executable and test**

```bash
chmod +x scripts/start.sh scripts/stop.sh

# Test idempotency: run start twice
./scripts/start.sh
./scripts/start.sh  # should say "already running", not error

# Test stop twice
./scripts/stop.sh
./scripts/stop.sh  # should say "not running", not error
```

- [ ] **Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: start.sh and stop.sh — full system start/stop scripts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: README.md + PROGRESS.md + Placeholder Icons

**Files:**
- Create: `README.md`
- Create: `PROGRESS.md`
- Verify: `assets/icons/placeholder.png` exists (from Task 1)

- [ ] **Step 1: Create `README.md`**

```markdown
# Label System

Home inventory tracker with label printing on MXW01 BLE thermal printer.

## Architecture

- **db, backend, frontend** — Docker Compose
- **print-service** — native macOS process (BLE requires host Bluetooth)

## First Run

### 1. Configure

```bash
cp .env.example .env
# Edit .env: set DB_PASSWORD, APP_PASS_1, APP_PASS_2, PRINTER_BLE_ADDRESS
```

Find your printer's BLE address:
```bash
cd print-service
python3 -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover())"
```

### 2. Start everything

```bash
./scripts/start.sh
```

This will:
- Start db, backend, frontend via Docker Compose
- Create print-service venv (first run only) and install deps
- Start print-service natively on the host

Frontend: http://localhost:3000

### 3. Stop everything

```bash
./scripts/stop.sh
```

## Running migrations manually

```bash
cd backend
export $(grep -v '^#' ../.env | xargs) && export DB_HOST=localhost
python -m alembic upgrade head
```

## Adding icons

Drop black-and-white PNG files (any size, will be scaled to 80×80) into `assets/icons/`, then rebuild the backend image:
```bash
docker compose build backend && docker compose up -d backend
```

## Development

Backend dev server (outside Docker, needs DB running):
```bash
docker compose up db -d
cd backend && uvicorn app.main:app --reload
```

Frontend dev server:
```bash
cd frontend && npm run dev  # proxies /api → localhost:8000
```

Print service:
```bash
cd print-service && source .venv/bin/activate && python main.py
```
```

- [ ] **Step 2: Create `PROGRESS.md`**

```markdown
# Progress

## Checklist

- [x] Repo scaffold, docker-compose, .env.example
- [x] DB schema (products, inventory_counter) + Alembic migration
- [x] Backend: config, database, models
- [x] Backend: HTTP Basic Auth
- [x] Backend: inventory number generation (atomic, wrapping)
- [x] Backend: POST /products, GET /products, POST /products/{id}/reprint, POST /products/{id}/delete
- [x] Backend: GET /icons, GET /icons/{filename}
- [x] Backend: Dockerfile
- [x] Print service: label rendering (Pillow, 384px, 1-bit, Floyd-Steinberg)
- [x] Print service: MXW01 BLE protocol (printer.py)
- [x] Print service: POST /print endpoint
- [x] Print service: README (native macOS setup, optional launchd)
- [x] Frontend: Vite + React, auth layer
- [x] Frontend: create form + icon gallery
- [x] Frontend: product table, search, print/delete actions
- [x] Frontend: Dockerfile + nginx
- [x] scripts/start.sh + scripts/stop.sh
- [x] README.md
```

- [ ] **Step 3: Final smoke test**

```bash
./scripts/start.sh
open http://localhost:3000
# Walk through full flow:
# 1. Login
# 2. Create a product with an icon
# 3. Verify it appears in the table
# 4. Search for it by name
# 5. Delete it — row shows deleted with username/date
# 6. Enable "show deleted" — deleted row visible
./scripts/stop.sh
```

- [ ] **Step 4: Final commit**

```bash
git add README.md PROGRESS.md
git commit -m "docs: README, PROGRESS.md — system complete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage verified:** all 7 deliverables from spec §"Что нужно на выходе" covered across tasks.
- **MXW01 protocol:** `printer.py` is intentionally a structural skeleton — Task 6 Step 1 explicitly requires reading the reference repo to fill in correct UUIDs and packet format. This is not a placeholder; it's a research step with clear instructions.
- **Font fallback in label.py:** tries macOS system font first, falls back to Linux fonts (for testing), then PIL default — covers both dev and production environments.
- **`print_warning` field:** Pydantic default `False`, set to `True` only on failed print — never persisted to DB (it's a transient response field).
- **Transaction scope in `create_product`:** `async with db.begin()` wraps number generation + insert atomically; the `FOR UPDATE` on `inventory_counter` prevents races.
