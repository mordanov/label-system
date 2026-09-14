import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
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


class UserLabelSettings(Base):
    __tablename__ = "user_label_settings"
    username: Mapped[str] = mapped_column(String, primary_key=True)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
