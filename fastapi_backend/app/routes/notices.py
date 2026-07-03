from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import User, get_async_session
from app.models import Notice
from app.schemas import NoticeCreate, NoticeRead
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["notice"])


@router.get("/latest", response_model=NoticeRead | None)
async def get_latest_notice(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("notices", "read")),
):
    result = await db.execute(
        select(Notice)
        .filter(Notice.is_delete == False)
        .order_by(Notice.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


@router.post("/", response_model=NoticeRead)
async def create_notice(
    data: NoticeCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("notices", "create")),
):
    notice = Notice(
        content=data.content,
        update_user_id=user.id,
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    return notice

