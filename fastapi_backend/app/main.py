from fastapi import FastAPI
from fastapi_pagination import add_pagination
from .schemas import UserCreate, UserRead, UserUpdate
from .users import auth_backend, fastapi_users, AUTH_URL_PATH
from fastapi.middleware.cors import CORSMiddleware
from .utils import simple_generate_unique_route_id
from app.routes.auth_refresh import router as auth_refresh_router
from app.routes.channels import router as channels_router
from app.routes.couriers import router as couriers_router
from app.routes.categories import router as categories_router
from app.routes.products import router as products_router
from app.routes.receivers import router as receivers_router
from app.routes.orders import router as orders_router
from app.routes.shipments import router as shipments_router
from app.routes.settlements import router as settlements_router
from app.routes.product_alias_dicts import router as product_alias_dicts_router
from app.routes.stocks import router as stocks_router
from app.routes.logistics_locations import router as logistics_locations_router
from app.routes.notices import router as notices_router
from app.routes.admin_users import router as admin_users_router
from app.routes.permissions import router as permissions_router
from app.routes.admin_permissions import router as admin_permissions_router
from app.config import settings

app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
)

# Middleware for CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication and user management routes
app.include_router(auth_refresh_router, prefix=f"/{AUTH_URL_PATH}", tags=["auth"])
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
# 회원가입(공개 register)은 비공개 사이트 전환으로 비활성화.
# 사용자 생성은 /admin/users (슈퍼유저 전용)에서 수행한다.
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Superuser-only user management endpoints
app.include_router(admin_users_router, prefix="/admin/users", tags=["admin-users"])
app.include_router(admin_permissions_router, prefix="/admin/permissions", tags=["admin-permissions"])

# Current user's permissions (used by frontend for menu/button hiding)
app.include_router(permissions_router, prefix="/permissions", tags=["permissions"])

app.include_router(channels_router, prefix="/channels")
app.include_router(couriers_router, prefix="/couriers")
app.include_router(categories_router, prefix="/categories")
app.include_router(products_router, prefix="/products")
app.include_router(receivers_router, prefix="/receivers")
app.include_router(orders_router, prefix="/orders")
app.include_router(shipments_router, prefix="/shipments")
app.include_router(settlements_router, prefix="/settlements")
app.include_router(product_alias_dicts_router, prefix="/product-alias-dicts")
app.include_router(stocks_router, prefix="/stocks")
app.include_router(logistics_locations_router, prefix="/logistics-locations")
app.include_router(notices_router, prefix="/notices")
add_pagination(app)
