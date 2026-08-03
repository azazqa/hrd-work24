from __future__ import annotations

import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi_pagination.ext.sqlalchemy import apaginate
from openpyxl import Workbook, load_workbook
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import Settlement, User
from app.pagination import MAX_PAGE_SIZE, Page, Params
from app.users import current_active_user

router = APIRouter()

EXCEL_HEADERS: list[tuple[str, str]] = [
    ("매입년월", "purchase_ym"),
    ("매출년월", "sales_ym"),
    ("고객사", "client_name"),
    ("과정명", "course_name"),
    ("교육기간", "education_period"),
    ("인원", "headcount"),
    ("기준수강료", "base_tuition"),
    ("교재비", "textbook_fee"),
    ("정산제외금", "exclude_amount"),
    ("배분율", "share_rate"),
    ("순매출액", "net_sales"),
    ("정산율", "settlement_rate"),
    ("정산액", "settlement_amount"),
    ("비고", "note"),
    ("영업대표", "sales_rep"),
]

HEADER_TO_FIELD = {label: field for label, field in EXCEL_HEADERS}
HEADER_TO_FIELD_NORM = {
    label.replace(" ", ""): field for label, field in EXCEL_HEADERS
}

_YM_DIGITS_RE = re.compile(r"\D+")
_RANGE_SPLIT_RE = re.compile(r"[~～∼]+")
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y.%m.%d",
    "%Y/%m/%d",
    "%Y%m%d",
    "%y-%m-%d",
    "%y.%m.%d",
    "%y/%m/%d",
)


def _parse_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_ym(value: Any) -> str | None:
    """매입/매출년월 → YYYYMM 문자열."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        text = str(int(value))
    else:
        text = _YM_DIGITS_RE.sub("", str(value).strip())
    if len(text) >= 6 and text[:6].isdigit():
        return text[:6]
    if len(text) == 4 and text.isdigit():
        return None
    return None


def _year_from_ym(ym: str) -> int:
    return int(ym[:4])


def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("정수 값이 아닙니다.")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    return int(Decimal(text))


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("숫자 값이 아닙니다.")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    return Decimal(text)


def _parse_rate(value: Any) -> Decimal | None:
    """배분율/정산율: '30%' → 0.3, '0.36' → 0.36, 0.5 → 0.5."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("비율 값이 아닙니다.")
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    if text.endswith("%"):
        num = Decimal(text[:-1].strip())
        return num / Decimal("100")
    return Decimal(text)


def _parse_single_date_text(text: str) -> date | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    digits = _YM_DIGITS_RE.sub("", cleaned)
    if len(digits) >= 8 and digits[:8].isdigit():
        try:
            return datetime.strptime(digits[:8], "%Y%m%d").date()
        except ValueError:
            return None
    return None


def _parse_education_period_date(value: Any) -> date | None:
    """교육기간 → YYYY-MM-DD 날짜. 구간이면 앞쪽 날짜만. 실패 시 None."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    # 구간(2023.11.01~2023.11.30) → 앞쪽만
    first = _RANGE_SPLIT_RE.split(text, maxsplit=1)[0].strip()
    return _parse_single_date_text(first)


class SettlementListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_ym: str
    purchase_year: int
    sales_ym: str | None
    client_name: str
    course_name: str
    education_period: str | None
    education_period_date: date | None
    headcount: int | None
    base_tuition: Decimal | None
    net_sales: Decimal | None
    settlement_amount: Decimal | None
    sales_rep: str | None


class SettlementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_ym: str
    purchase_year: int
    sales_ym: str | None
    client_name: str
    course_name: str
    education_period: str | None
    education_period_date: date | None
    headcount: int | None
    base_tuition: Decimal | None
    textbook_fee: Decimal | None
    exclude_amount: Decimal | None
    share_rate: Decimal | None
    net_sales: Decimal | None
    settlement_rate: Decimal | None
    settlement_amount: Decimal | None
    note: str | None
    sales_rep: str | None


class SettlementImportError(BaseModel):
    row: int
    message: str


class SettlementImportResult(BaseModel):
    deleted: int
    created: int
    failed: int
    errors: list[SettlementImportError] = Field(default_factory=list)


def _transform_list(items: list[Settlement]) -> list[SettlementListItem]:
    return [SettlementListItem.model_validate(row) for row in items]


def _row_to_fields(row_values: dict[str, Any]) -> dict[str, Any]:
    purchase_ym = _normalize_ym(row_values.get("purchase_ym"))
    if not purchase_ym:
        raise ValueError("매입년월이 올바르지 않습니다.")

    client_name = _parse_str(row_values.get("client_name"))
    if not client_name:
        raise ValueError("고객사가 비어 있습니다.")

    course_name = _parse_str(row_values.get("course_name"))
    if not course_name:
        raise ValueError("과정명이 비어 있습니다.")

    try:
        fields: dict[str, Any] = {
            "purchase_ym": purchase_ym,
            "purchase_year": _year_from_ym(purchase_ym),
            "sales_ym": _normalize_ym(row_values.get("sales_ym")),
            "client_name": client_name,
            "course_name": course_name,
            "education_period": _parse_str(row_values.get("education_period")),
            "education_period_date": _parse_education_period_date(
                row_values.get("education_period")
            ),
            "headcount": _parse_int(row_values.get("headcount")),
            "base_tuition": _parse_decimal(row_values.get("base_tuition")),
            "textbook_fee": _parse_decimal(row_values.get("textbook_fee")),
            "exclude_amount": _parse_decimal(row_values.get("exclude_amount")),
            "share_rate": _parse_rate(row_values.get("share_rate")),
            "net_sales": _parse_decimal(row_values.get("net_sales")),
            "settlement_rate": _parse_rate(row_values.get("settlement_rate")),
            "settlement_amount": _parse_decimal(row_values.get("settlement_amount")),
            "note": _parse_str(row_values.get("note")),
            "sales_rep": _parse_str(row_values.get("sales_rep")),
        }
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"숫자 파싱 실패: {exc}") from exc
    return fields


@router.get("", response_model=Page[SettlementListItem])
async def list_settlements(
    page: int = 1,
    size: int = 20,
    year: int | None = Query(default=None, description="매입년도"),
    client_name: str | None = Query(default=None, description="고객사 검색"),
    course_name: str | None = Query(default=None, description="과정명 검색"),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    if size < 1:
        raise HTTPException(status_code=400, detail="size must be >= 1")
    if size > MAX_PAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"size must be <= {MAX_PAGE_SIZE}")

    params = Params(page=page, size=size)
    stmt = select(Settlement).where(Settlement.is_delete == False)  # noqa: E712
    if year is not None:
        stmt = stmt.where(Settlement.purchase_year == year)
    if client_name and client_name.strip():
        stmt = stmt.where(Settlement.client_name.ilike(f"%{client_name.strip()}%"))
    if course_name and course_name.strip():
        stmt = stmt.where(Settlement.course_name.ilike(f"%{course_name.strip()}%"))
    stmt = stmt.order_by(Settlement.purchase_ym.desc(), Settlement.id.desc())
    return await apaginate(session, stmt, params, transformer=_transform_list)


@router.get("/import/template")
async def download_import_template(
    _: User = Depends(current_active_user),
):
    wb = Workbook()
    ws = wb.active
    ws.title = "정산"
    ws.append([label for label, _ in EXCEL_HEADERS])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="settlements_template.xlsx"'
        },
    )


@router.post("/import", response_model=SettlementImportResult)
async def import_settlements(
    year: int = Form(..., ge=2000, le=2100, description="교체할 매입년도"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="xlsx 파일만 업로드할 수 있습니다.")

    content = await file.read()
    try:
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"엑셀 파일을 읽을 수 없습니다: {exc}"
        ) from exc

    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header_row = next(rows, None)
    if not header_row:
        wb.close()
        raise HTTPException(status_code=400, detail="헤더 행이 없습니다.")

    col_map: dict[int, str] = {}
    for idx, cell in enumerate(header_row):
        if cell is None:
            continue
        label = str(cell).strip()
        field = HEADER_TO_FIELD.get(label) or HEADER_TO_FIELD_NORM.get(
            label.replace(" ", "")
        )
        if field:
            col_map[idx] = field

    required = {"purchase_ym", "client_name", "course_name"}
    if not required.issubset(set(col_map.values())):
        wb.close()
        raise HTTPException(
            status_code=400, detail="매입년월, 고객사, 과정명 열이 필요합니다."
        )

    soft_delete_result = await session.execute(
        update(Settlement)
        .where(
            Settlement.is_delete == False,  # noqa: E712
            Settlement.purchase_year == year,
        )
        .values(is_delete=True)
    )
    deleted = soft_delete_result.rowcount or 0

    created = 0
    failed = 0
    errors: list[SettlementImportError] = []
    to_insert: list[Settlement] = []

    for row_num, row in enumerate(rows, start=2):
        if row is None or all(c is None or str(c).strip() == "" for c in row):
            continue

        row_values: dict[str, Any] = {}
        for idx, field in col_map.items():
            if idx < len(row):
                row_values[field] = row[idx]

        try:
            fields = _row_to_fields(row_values)
            if fields["purchase_year"] != year:
                failed += 1
                errors.append(
                    SettlementImportError(
                        row=row_num,
                        message=(
                            f"매입년월 년도({fields['purchase_year']})가 "
                            f"선택 년도({year})와 다릅니다."
                        ),
                    )
                )
                continue
            to_insert.append(Settlement(**fields))
            created += 1
        except Exception as exc:
            failed += 1
            errors.append(
                SettlementImportError(row=row_num, message=str(exc) or "처리 실패")
            )

    if to_insert:
        session.add_all(to_insert)
    await session.commit()
    wb.close()
    return SettlementImportResult(
        deleted=deleted, created=created, failed=failed, errors=errors
    )
