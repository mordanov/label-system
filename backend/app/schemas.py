from pydantic import BaseModel
from datetime import datetime
import uuid

class ProductCreate(BaseModel):
    name: str
    icon_filename: str = ""
    units: int | None = None

class ProductBulkCreate(BaseModel):
    items: list[ProductCreate]

class ProductSetIcon(BaseModel):
    icon_filename: str

class ProductSetUnits(BaseModel):
    units: int | None

class ProductResponse(BaseModel):
    id: uuid.UUID
    inventory_number: str
    name: str
    icon_filename: str
    units: int | None
    created_at: datetime
    is_deleted: bool
    deleted_at: datetime | None
    deleted_by: str | None
    print_warning: bool = False

    model_config = {"from_attributes": True}

class IconInfo(BaseModel):
    filename: str


class LabelLayout(BaseModel):
    icon_x: int = 8
    icon_y: int = 8
    icon_size: int = 80
    name_x: int = 96
    name_y: int = 8
    name_font_size: int = 24
    number_x: int = 192
    number_y: int = 90
    number_font_size: int = 48
    date_x: int = 8
    date_y: int = 170
    date_font_size: int = 18
