import os
import tempfile

import pytest
from fastapi import HTTPException

from app.models import CourseExportJob, SchedulerJob, SchedulerJobQueue
from app.routes.courses import (
    _build_conditions_summary,
    _export_body_from_params,
    _export_download_filename,
    _export_year_label,
    _normalize_export_params,
)


def test_normalize_export_params_date_range():
    params = _normalize_export_params(
        srch_tra_st_dt="2025-07-01",
        srch_tra_end_dt="2025-07-31",
        srch_tra_organ_nm="  한국기관  ",
        srch_tra_process_nm="  데이터 분석  ",
        has_reg_course_man=True,
        owned_year=None,
        min_score=0,
    )
    assert params == {
        "srch_tra_st_dt": "20250701",
        "srch_tra_end_dt": "20250731",
        "has_reg_course_man": True,
        "srch_tra_organ_nm": "한국기관",
        "srch_tra_process_nm": "데이터 분석",
    }


def test_normalize_export_params_owned_mode():
    params = _normalize_export_params(
        srch_tra_st_dt=None,
        srch_tra_end_dt=None,
        srch_tra_organ_nm=None,
        srch_tra_process_nm=None,
        has_reg_course_man=False,
        owned_year=2025,
        min_score=1.5,
    )
    assert params == {
        "owned_year": 2025,
        "min_score": 1.5,
        "has_reg_course_man": False,
    }


def test_normalize_export_params_requires_dates():
    with pytest.raises(HTTPException) as exc_info:
        _normalize_export_params(
            srch_tra_st_dt=None,
            srch_tra_end_dt=None,
            srch_tra_organ_nm=None,
            srch_tra_process_nm=None,
            has_reg_course_man=False,
            owned_year=None,
            min_score=0,
        )
    assert exc_info.value.status_code == 400


def test_build_conditions_summary_date_range():
    summary = _build_conditions_summary(
        {
            "srch_tra_st_dt": "20250701",
            "srch_tra_end_dt": "20250731",
            "srch_tra_process_nm": "데이터 분석",
            "has_reg_course_man": True,
        }
    )
    assert "훈련시작일 2025-07-01 ~ 2025-07-31" in summary
    assert "과정명 '데이터 분석'" in summary
    assert "수강신청 인원 있음" in summary


def test_build_conditions_summary_owned():
    summary = _build_conditions_summary(
        {"owned_year": 2025, "min_score": 2, "has_reg_course_man": False}
    )
    assert "보유과정 2025년" in summary
    assert "관련도≥2" in summary


def test_export_year_label_owned():
    assert _export_year_label({"owned_year": 2024}) == "2024"


def test_export_year_label_same_year_range():
    assert (
        _export_year_label(
            {"srch_tra_st_dt": "20250601", "srch_tra_end_dt": "20250630"}
        )
        == "2025"
    )


def test_export_year_label_cross_year_range():
    assert (
        _export_year_label(
            {"srch_tra_st_dt": "20241201", "srch_tra_end_dt": "20250228"}
        )
        == "2024-2025"
    )


def test_export_download_filename_includes_year():
    from datetime import datetime

    name = _export_download_filename(
        {"owned_year": 2024},
        when=datetime(2026, 7, 15, 11, 30, 0),
    )
    assert name == "courses_2024_20260715_113000.xlsx"


def test_export_body_from_params_list_mode():
    body = _export_body_from_params(
        {"srch_tra_st_dt": "20250701", "srch_tra_end_dt": "20250731"}, None
    )
    assert body is not None
    assert body["query"]["bool"]["must"][0] == {
        "range": {"traStartDate": {"gte": "2025-07-01", "lte": "2025-07-31"}}
    }


def test_export_body_from_params_owned_without_names_is_none():
    body = _export_body_from_params({"owned_year": 2025, "min_score": 0}, None)
    assert body is None


def test_export_body_from_params_owned_with_names():
    body = _export_body_from_params(
        {"owned_year": 2025, "min_score": 0}, ["과정 A", "과정 B"]
    )
    assert body is not None
    assert len(body["query"]["bool"]["should"]) == 2


@pytest.mark.asyncio
async def test_create_export_job_enqueues_queue(test_client, authenticated_user, db_session):
    db_session.add(
        SchedulerJob(job_key="course_export", title="과정 내보내기", enabled=False)
    )
    await db_session.commit()

    res = await test_client.post(
        "/courses/export-jobs",
        headers=authenticated_user["headers"],
        json={
            "memo": "7월 목록",
            "srch_tra_st_dt": "2025-07-01",
            "srch_tra_end_dt": "2025-07-31",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "PENDING"
    assert data["memo"] == "7월 목록"
    assert "훈련시작일 2025-07-01 ~ 2025-07-31" in data["conditions_summary"]

    export = await db_session.get(CourseExportJob, data["id"])
    assert export is not None
    assert export.queue_id is not None
    queue = await db_session.get(SchedulerJobQueue, export.queue_id)
    assert queue is not None
    assert queue.job_key == "course_export"
    assert queue.payload == {"export_id": export.id}


@pytest.mark.asyncio
async def test_create_export_job_missing_job_definition_returns_404(
    test_client, authenticated_user
):
    res = await test_client.post(
        "/courses/export-jobs",
        headers=authenticated_user["headers"],
        json={"srch_tra_st_dt": "2025-07-01", "srch_tra_end_dt": "2025-07-31"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_export_jobs_filters_by_user(
    test_client, authenticated_user, db_session
):
    mine = CourseExportJob(
        status="SUCCEEDED",
        memo="mine",
        params={},
        requested_by_user_id=authenticated_user["user"].id,
    )
    other = CourseExportJob(
        status="SUCCEEDED",
        memo="other",
        params={},
        requested_by_user_id=None,
    )
    db_session.add_all([mine, other])
    await db_session.commit()

    res = await test_client.get(
        "/courses/export-jobs", headers=authenticated_user["headers"]
    )
    assert res.status_code == 200
    memos = {item["memo"] for item in res.json()["items"]}
    assert "mine" in memos
    assert "other" not in memos


@pytest.mark.asyncio
async def test_download_not_ready_returns_404(
    test_client, authenticated_user, db_session
):
    job = CourseExportJob(
        status="PENDING",
        params={},
        requested_by_user_id=authenticated_user["user"].id,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    res = await test_client.get(
        f"/courses/export-jobs/{job.id}/download",
        headers=authenticated_user["headers"],
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_download_succeeded_streams_file(
    test_client, authenticated_user, db_session
):
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.write(fd, b"dummy-content")
    os.close(fd)
    try:
        job = CourseExportJob(
            status="SUCCEEDED",
            params={},
            file_path=path,
            file_name="courses_test.xlsx",
            requested_by_user_id=authenticated_user["user"].id,
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)

        res = await test_client.get(
            f"/courses/export-jobs/{job.id}/download",
            headers=authenticated_user["headers"],
        )
        assert res.status_code == 200
        assert res.content == b"dummy-content"
        assert "courses_test.xlsx" in res.headers["content-disposition"]
    finally:
        if os.path.exists(path):
            os.unlink(path)
