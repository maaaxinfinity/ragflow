"""Add is_favorite column to free_chat_session table."""

import logging

from peewee import BooleanField
from playhouse.migrate import MySQLMigrator, PostgresqlMigrator, migrate

from api.db.db_models import DB


def add_is_favorite_column():
    """Add the is_favorite column if it does not already exist."""

    try:
        existing_columns = {col.name for col in DB.get_columns("free_chat_session")}
        if "is_favorite" in existing_columns:
            logging.info("[DB Migration] Column is_favorite already exists on free_chat_session")
            return True

        db_class_name = DB.__class__.__name__
        if "MySQL" in db_class_name:
            migrator = MySQLMigrator(DB)
        elif "Postgresql" in db_class_name:
            migrator = PostgresqlMigrator(DB)
        else:
            logging.warning(f"Unsupported database type for migration: {db_class_name}")
            return False

        migrate(
            migrator.add_column(
                "free_chat_session",
                "is_favorite",
                BooleanField(null=False, default=False),
            )
        )

        # 确保历史数据使用默认值
        DB.execute_sql("UPDATE free_chat_session SET is_favorite = 0 WHERE is_favorite IS NULL")
        logging.info("[DB Migration] Added is_favorite column to free_chat_session")
        return True
    except Exception as exc:  # pragma: no cover - 仅日志记录
        logging.error(f"[DB Migration] Failed to add is_favorite column: {exc}")
        return False


if __name__ == "__main__":
    add_is_favorite_column()
