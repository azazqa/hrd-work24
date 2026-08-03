import pytest

from app.models import ClientNameMapping


@pytest.mark.asyncio
async def test_client_mapping_crud(test_client, authenticated_user, db_session):
    headers = authenticated_user["headers"]

    create = await test_client.post(
        "/client-mappings",
        json={"institution_name": "기관1", "client_name": "고객1"},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    mapping_id = body["id"]
    assert body["institution_name"] == "기관1"
    assert body["client_name"] == "고객1"

    dup = await test_client.post(
        "/client-mappings",
        json={"institution_name": "기관1", "client_name": "고객X"},
        headers=headers,
    )
    assert dup.status_code == 409

    listed = await test_client.get(
        "/client-mappings?q=기관",
        headers=headers,
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    updated = await test_client.put(
        f"/client-mappings/{mapping_id}",
        json={"client_name": "고객1-수정"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["client_name"] == "고객1-수정"

    deleted = await test_client.delete(
        f"/client-mappings/{mapping_id}",
        headers=headers,
    )
    assert deleted.status_code == 204

    row = await db_session.get(ClientNameMapping, mapping_id)
    assert row is not None
    assert row.is_delete is True

    # soft-deleted 후 동일 훈련기관명으로 재등록 → revive
    revive = await test_client.post(
        "/client-mappings",
        json={"institution_name": "기관1", "client_name": "고객2"},
        headers=headers,
    )
    assert revive.status_code == 201
    assert revive.json()["id"] == mapping_id
    assert revive.json()["client_name"] == "고객2"
