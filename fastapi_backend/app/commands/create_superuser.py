import asyncio
import os

from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi_users import exceptions as fa_exceptions

from app.database import async_session_maker
from app.models import User
from app.schemas import UserCreate, UserUpdate
from app.users import UserManager


EMAIL = "erp@bdf.kr"
FULL_NAME = "관리자"


async def main() -> None:
    password = os.environ.get("SUPERUSER_PASSWORD")
    if not password:
        raise SystemExit("SUPERUSER_PASSWORD env var is required.")

    async with async_session_maker() as session:
        user_db = SQLAlchemyUserDatabase(session, User)
        user_manager = UserManager(user_db)

        try:
            existing = await user_manager.get_by_email(EMAIL)
        except fa_exceptions.UserNotExists:
            existing = None

        if existing is not None:
            updated = existing
            # set password (and any password policy validation)
            updated = await user_manager.update(
                UserUpdate(password=password),
                updated,
                safe=False,
                request=None,
            )
            updated.is_superuser = True  # type: ignore[attr-defined]
            updated.is_active = True  # type: ignore[attr-defined]
            updated.full_name = FULL_NAME  # type: ignore[attr-defined]
            session.add(updated)
            await session.commit()
            return

        created = await user_manager.create(
            UserCreate(email=EMAIL, password=password, full_name=FULL_NAME),
            safe=True,
            request=None,
        )
        created.is_superuser = True  # type: ignore[attr-defined]
        created.is_active = True  # type: ignore[attr-defined]
        created.full_name = FULL_NAME  # type: ignore[attr-defined]
        session.add(created)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())

