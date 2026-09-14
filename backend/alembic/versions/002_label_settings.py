"""add user_label_settings table

Revision ID: 002
Revises: 001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_label_settings',
        sa.Column('username', sa.String(), primary_key=True),
        sa.Column('settings', JSONB(), nullable=False, server_default='{}'),
    )


def downgrade() -> None:
    op.drop_table('user_label_settings')
