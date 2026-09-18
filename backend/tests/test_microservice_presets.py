from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_presets_include_6_8_and_10_service_templates():
    response = client.get("/api/presets")
    assert response.status_code == 200
    payload = response.json()
    sizes = {preset["size"] for preset in payload["presets"]}
    assert sizes == {6, 8, 10}
    assert any(preset["id"] == "six" for preset in payload["presets"])
    assert any(preset["id"] == "eight" for preset in payload["presets"])
    assert any(preset["id"] == "ten" for preset in payload["presets"])


def test_simulate_can_load_a_10_service_preset():
    response = client.post(
        "/api/simulate",
        json={"failure": "redis_hotspot", "preset": "ten", "example": "platform"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["selected_preset"]["id"] == "ten"
    assert payload["services"][0]["id"] == "gateway"
    assert len(payload["services"]) == 10


def test_topology_and_failure_can_be_applied_separately():
    apply_response = client.post(
        "/api/simulate",
        json={"preset": "eight", "example": "payments"},
    )
    assert apply_response.status_code == 200
    apply_payload = apply_response.json()
    assert apply_payload["selected_preset"]["id"] == "eight"
    assert apply_payload["selected_example"]["id"] == "payments"
    assert apply_payload["incident"] is None

    inject_response = client.post(
        "/api/simulate",
        json={"failure": "auth_timeout", "preset": "eight", "example": "payments"},
    )
    assert inject_response.status_code == 200
    inject_payload = inject_response.json()
    assert inject_payload["selected_preset"]["id"] == "eight"
    assert inject_payload["selected_example"]["id"] == "payments"
    assert inject_payload["incident"] is not None
