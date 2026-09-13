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
