"""add cascade deletes to task FKs

Revision ID: 7a2cdcc63b16
Revises: c35120d6ff8e
Create Date: 2026-03-17 14:58:44.605591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a2cdcc63b16'
down_revision: Union[str, None] = 'c35120d6ff8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite batch mode: recreate table with new FK constraints
    # naming_convention helps batch mode find existing constraints
    naming_convention = {
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    }
    with op.batch_alter_table(
        'tasks',
        schema=None,
        naming_convention=naming_convention,
        recreate='always',
    ) as batch_op:
        batch_op.drop_constraint(
            'fk_tasks_profile_id_profiles', type_='foreignkey'
        )
        batch_op.drop_constraint(
            'fk_tasks_video_id_videos', type_='foreignkey'
        )
        batch_op.create_foreign_key(
            'fk_tasks_profile_id_profiles',
            'profiles', ['profile_id'], ['id'], ondelete='CASCADE'
        )
        batch_op.create_foreign_key(
            'fk_tasks_video_id_videos',
            'videos', ['video_id'], ['id'], ondelete='CASCADE'
        )


def downgrade() -> None:
    naming_convention = {
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    }
    with op.batch_alter_table(
        'tasks',
        schema=None,
        naming_convention=naming_convention,
        recreate='always',
    ) as batch_op:
        batch_op.drop_constraint(
            'fk_tasks_profile_id_profiles', type_='foreignkey'
        )
        batch_op.drop_constraint(
            'fk_tasks_video_id_videos', type_='foreignkey'
        )
        batch_op.create_foreign_key(
            'fk_tasks_profile_id_profiles',
            'profiles', ['profile_id'], ['id']
        )
        batch_op.create_foreign_key(
            'fk_tasks_video_id_videos',
            'videos', ['video_id'], ['id']
        )
