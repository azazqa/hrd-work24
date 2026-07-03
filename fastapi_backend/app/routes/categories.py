from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import aliased
from sqlalchemy import case

from app.database import User, get_async_session
from app.models import Category
from app.schemas import CategoryRead, CategoryCreate, CategoryUpdate
from app.users import current_active_user
from app.permissions import require_permission

router = APIRouter(tags=["category"])


def transform(rows):
    """
    rows: list[tuple[Category, parent_name]]
    Returned by select(Category, Parent.name.label("parent_name"))
    """
    out: list[CategoryRead] = []
    for row in rows:
        category, parent_name = row
        base = CategoryRead.model_validate(category).model_dump()
        base["parent_name"] = parent_name
        out.append(CategoryRead(**base))
    return out


@router.get("/", response_model=Page[CategoryRead])
async def list_categories(
    page: int = 1,
    size: int = 10,
    parent_id: UUID | None = None,
    roots_only: bool = False,
    name: str | None = None,
    description: str | None = None,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("categories", "read")),
):
    params = Params(page=page, size=size)
    Parent = aliased(Category)
    query = (
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Category.parent_id == Parent.id)
        .filter(Category.is_delete == False)
    )
    if roots_only:
        query = query.filter(Category.parent_id == None)
    elif parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    if name is not None and name.strip():
        query = query.filter(Category.name.ilike(f"%{name.strip()}%"))
    if description is not None and description.strip():
        query = query.filter(Category.description.ilike(f"%{description.strip()}%"))

    # Ordering:
    # - Group by root category name
    # - Root category row first within the group
    # - Then children by their own name
    group_name = case(
        (Category.parent_id.is_(None), Category.name),
        else_=Parent.name,
    )
    root_first = case((Category.parent_id.is_(None), 0), else_=1)
    query = query.order_by(group_name.asc(), root_first.asc(), Category.name.asc(), Category.id.asc())
    return await apaginate(db, query, params, transformer=transform)


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("categories", "read")),
):
    Parent = aliased(Category)
    result = await db.execute(
        select(Category, Parent.name.label("parent_name"))
        .outerjoin(Parent, Category.parent_id == Parent.id)
        .filter(Category.id == category_id, Category.is_delete == False)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    category, parent_name = row
    base = CategoryRead.model_validate(category).model_dump()
    base["parent_name"] = parent_name
    return CategoryRead(**base)


@router.post("/", response_model=CategoryRead)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("categories", "create")),
):
    if data.parent_id:
        parent_res = await db.execute(
            select(Category).filter(Category.id == data.parent_id, Category.is_delete == False)
        )
        parent = parent_res.scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=422,
                detail="상위 카테고리는 최상위 카테고리만 선택할 수 있습니다.",
            )

    category = Category(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    parent_name = None
    if category.parent_id:
        Parent = aliased(Category)
        parent_res = await db.execute(
            select(Parent.name).filter(Parent.id == category.parent_id, Parent.is_delete == False)
        )
        parent_name = parent_res.scalar_one_or_none()

    base = CategoryRead.model_validate(category).model_dump()
    base["parent_name"] = parent_name
    return CategoryRead(**base)


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("categories", "update")),
):
    result = await db.execute(select(Category).filter(Category.id == category_id, Category.is_delete == False))
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = data.model_dump(exclude_unset=True)
    if "parent_id" in updates and updates["parent_id"] is not None:
        parent_res = await db.execute(
            select(Category).filter(
                Category.id == updates["parent_id"],
                Category.is_delete == False,
            )
        )
        parent = parent_res.scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=422,
                detail="상위 카테고리는 최상위 카테고리만 선택할 수 있습니다.",
            )

    for key, value in updates.items():
        setattr(category, key, value)

    await db.commit()
    await db.refresh(category)
    parent_name = None
    if category.parent_id:
        Parent = aliased(Category)
        parent_res = await db.execute(
            select(Parent.name).filter(Parent.id == category.parent_id, Parent.is_delete == False)
        )
        parent_name = parent_res.scalar_one_or_none()

    base = CategoryRead.model_validate(category).model_dump()
    base["parent_name"] = parent_name
    return CategoryRead(**base)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    _: User = Depends(require_permission("categories", "delete")),
):
    result = await db.execute(select(Category).filter(Category.id == category_id, Category.is_delete == False))
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.is_delete = True
    await db.commit()
    return {"message": "Category successfully deleted"}
