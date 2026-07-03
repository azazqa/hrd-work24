from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_pagination import add_pagination

from app.config import settings
from app.routes.admin_scheduler import router as admin_scheduler_router
from app.routes.auth_refresh import router as auth_refresh_router
from app.routes.courses import router as courses_router
from app.routes.work24_api_logs import router as work24_api_logs_router
from app.schemas import UserRead, UserUpdate
from app.users import AUTH_URL_PATH, auth_backend, fastapi_users
from app.utils import simple_generate_unique_route_id

app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_refresh_router, prefix=f"/{AUTH_URL_PATH}", tags=["auth"])
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
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

app.include_router(
    admin_scheduler_router,
    prefix="/admin/scheduler",
    tags=["admin-scheduler"],
)

app.include_router(
    courses_router,
    prefix="/courses",
    tags=["courses"],
)

app.include_router(
    work24_api_logs_router,
    prefix="/admin/work24-api-logs",
    tags=["admin-work24-api-logs"],
)

add_pagination(app)
