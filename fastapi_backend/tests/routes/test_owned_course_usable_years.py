import pytest

from app.models import OwnedCourse
from app.routes.courses import _load_active_owned_names


@pytest.mark.asyncio
async def test_load_active_owned_names_usable_in_year_window(db_session):
    """usable_in_year=Y 이면 dev_year in [Y-2, Y]만 포함 (NULL·범위밖·비활성 제외)."""
    db_session.add_all(
        [
            OwnedCourse(course_name="y2021", dev_year=2021, is_active=True),
            OwnedCourse(course_name="y2022", dev_year=2022, is_active=True),
            OwnedCourse(course_name="y2023", dev_year=2023, is_active=True),
            OwnedCourse(course_name="y2024", dev_year=2024, is_active=True),
            OwnedCourse(course_name="y2025", dev_year=2025, is_active=True),
            OwnedCourse(course_name="nullDev", dev_year=None, is_active=True),
            OwnedCourse(course_name="inactive2023", dev_year=2023, is_active=False),
            OwnedCourse(
                course_name="deleted2023",
                dev_year=2023,
                is_active=True,
                is_delete=True,
            ),
        ]
    )
    await db_session.commit()

    names = await _load_active_owned_names(db_session, usable_in_year=2024)
    assert names == ["y2022", "y2023", "y2024"]

    all_active = await _load_active_owned_names(db_session)
    assert "nullDev" in all_active
    assert "y2021" in all_active
    assert "inactive2023" not in all_active
    assert "deleted2023" not in all_active
