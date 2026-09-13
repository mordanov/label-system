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
