from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="RootCause AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Failure = Literal[
    "payment_db",
    "payment_latency",
    "inventory_crash",
    "order_failure",
    "redis_hotspot",
    "auth_timeout",
    "shipping_delay",
    "notification_backlog",
]

DEFAULT_PRESET = "six"
DEFAULT_EXAMPLE = "commerce"

SERVICE_TEMPLATES = {
    "gateway": {"name": "API Gateway", "latency_ms": 82, "error_rate": 0.2, "cpu": 26},
    "order": {"name": "Order Service", "latency_ms": 118, "error_rate": 0.5, "cpu": 33},
    "user": {"name": "User Service", "latency_ms": 102, "error_rate": 0.4, "cpu": 31},
    "inventory": {"name": "Inventory Service", "latency_ms": 122, "error_rate": 0.6, "cpu": 35},
    "payment": {"name": "Payment Service", "latency_ms": 109, "error_rate": 0.3, "cpu": 29},
    "payment_db": {"name": "Payment Database", "latency_ms": 36, "error_rate": 0.0, "cpu": 28},
    "auth": {"name": "Auth Service", "latency_ms": 96, "error_rate": 0.3, "cpu": 30},
    "catalog": {"name": "Catalog Service", "latency_ms": 101, "error_rate": 0.4, "cpu": 32},
    "cart": {"name": "Cart Service", "latency_ms": 112, "error_rate": 0.5, "cpu": 35},
    "shipping": {"name": "Shipping Service", "latency_ms": 104, "error_rate": 0.4, "cpu": 31},
    "notification": {"name": "Notification Service", "latency_ms": 90, "error_rate": 0.2, "cpu": 27},
    "redis_cache": {"name": "Redis Cache", "latency_ms": 44, "error_rate": 0.1, "cpu": 24},
}

PRESET_LAYOUTS = {
    "six": ["gateway", "order", "user", "inventory", "payment", "payment_db"],
    "eight": ["gateway", "auth", "catalog", "cart", "order", "inventory", "payment", "payment_db"],
    "ten": ["gateway", "auth", "catalog", "cart", "order", "inventory", "shipping", "notification", "payment", "payment_db"],
}

EXAMPLE_METADATA = {
    "commerce": {"label": "Commerce Flow", "description": "Order-to-payment retail scenario"},
    "payments": {"label": "Payments Focus", "description": "Monetization and ledger ops scenario"},
    "platform": {"label": "Platform Flow", "description": "Event-driven platform resilience scenario"},
}

PRESET_METADATA = {
    "six": {"label": "6 microservices", "description": "Core retail stack"},
    "eight": {"label": "8 microservices", "description": "Expanded storefront and auth components"},
    "ten": {"label": "10 microservices", "description": "Large platform with shipping and notifications"},
}

EXAMPLE_OVERRIDES = {
    "commerce": {"gateway": {"latency_ms": 84, "error_rate": 0.2, "cpu": 27}, "order": {"latency_ms": 116, "error_rate": 0.5, "cpu": 33}},
    "payments": {"gateway": {"latency_ms": 86, "error_rate": 0.2, "cpu": 28}, "payment": {"latency_ms": 121, "error_rate": 0.3, "cpu": 31}, "payment_db": {"latency_ms": 42, "error_rate": 0.1, "cpu": 29}},
    "platform": {"gateway": {"latency_ms": 90, "error_rate": 0.3, "cpu": 29}, "catalog": {"latency_ms": 124, "error_rate": 0.5, "cpu": 35}, "notification": {"latency_ms": 92, "error_rate": 0.2, "cpu": 28}},
}

SCENARIOS = {
    "payment_db": {
        "root": "payment_db",
        "confidence": 0.94,
        "severity": "HIGH",
        "affected": ["gateway", "order", "payment", "payment_db"],
        "metrics": {"gateway": (1300, 12, 64), "order": (1800, 24, 76), "payment": (2410, 38.2, 91), "payment_db": (2800, 42, 96)},
        "evidence": ["Database latency anomaly detected first", "Timeouts followed in Payment Service", "Failures propagated through Order Service", "82% of failed traces cross Payment"],
        "events": ["Payment DB latency increases", "Payment begins timing out", "Order errors increase", "Root cause identified"],
        "series": [100, 105, 114, 175, 410, 1320, 2780, 2410],
    },
    "payment_latency": {
        "root": "payment",
        "confidence": 0.91,
        "severity": "HIGH",
        "affected": ["gateway", "order", "payment"],
        "metrics": {"gateway": (1100, 11, 62), "order": (1600, 22, 72), "payment": (2180, 31.6, 89)},
        "evidence": ["Payment latency anomaly detected first", "No upstream database timeout observed", "Order failures follow Payment timeouts", "76% of failed traces cross Payment"],
        "events": ["Payment latency increases", "Order begins timing out", "Gateway errors increase", "Root cause identified"],
        "series": [100, 108, 130, 320, 1100, 2190, 2180, 2110],
    },
    "inventory_crash": {
        "root": "inventory",
        "confidence": 0.89,
        "severity": "MEDIUM",
        "affected": ["gateway", "order", "inventory"],
        "metrics": {"gateway": (820, 8, 56), "order": (1120, 16, 69), "inventory": (920, 21.8, 98)},
        "evidence": ["Inventory health checks failed first", "CPU saturation preceded request failures", "Order failures are inventory-dependent", "No payment anomaly detected"],
        "events": ["Inventory CPU saturates", "Inventory health checks fail", "Order errors increase", "Root cause identified"],
        "series": [105, 109, 122, 360, 990, 1250, 1100, 1120],
    },
    "order_failure": {
        "root": "order",
        "confidence": 0.92,
        "severity": "HIGH",
        "affected": ["gateway", "order"],
        "metrics": {"gateway": (760, 13, 58), "order": (1560, 27.4, 94)},
        "evidence": ["Order error anomaly detected first", "Dependent services remain healthy", "Gateway failures follow Order errors", "Trace failures terminate at Order"],
        "events": ["Order error rate increases", "Order requests fail", "Gateway returns 500", "Root cause identified"],
        "series": [104, 110, 136, 610, 1430, 1600, 1530, 1560],
    },
    "redis_hotspot": {
        "root": "redis_cache",
        "confidence": 0.87,
        "severity": "MEDIUM",
        "affected": ["gateway", "cart", "order", "inventory", "redis_cache"],
        "metrics": {"gateway": (980, 9, 58), "cart": (1180, 18, 70), "order": (1500, 22, 76), "inventory": (1240, 19, 73), "redis_cache": (2400, 34.5, 92)},
        "evidence": ["Redis cache saturation appears first", "Cart and order requests queue behind cache misses", "Read latency spikes align with inventory retries", "Fallback path is amplifying the outage"],
        "events": ["Redis hot keys spike", "Cache miss rate climbs", "Cart and order queues back up", "Root cause identified"],
        "series": [110, 124, 210, 520, 1030, 1790, 2300, 2400],
    },
    "auth_timeout": {
        "root": "auth",
        "confidence": 0.9,
        "severity": "HIGH",
        "affected": ["gateway", "auth", "user", "order"],
        "metrics": {"gateway": (875, 11, 60), "auth": (2400, 28.4, 91), "user": (1360, 20, 74), "order": (1480, 21.5, 75)},
        "evidence": ["Token validation latency surged first", "User session lookups timed out across the gateway", "Order creation retries follow session failures", "No payment impact was detected"],
        "events": ["Auth validation slows down", "User sessions start timing out", "Order requests go into retry loops", "Root cause identified"],
        "series": [92, 110, 220, 670, 1180, 1790, 2340, 2400],
    },
    "shipping_delay": {
        "root": "shipping",
        "confidence": 0.84,
        "severity": "MEDIUM",
        "affected": ["gateway", "order", "shipping", "notification"],
        "metrics": {"gateway": (710, 8, 54), "order": (980, 15, 66), "shipping": (1640, 20.5, 88), "notification": (840, 11, 62)},
        "evidence": ["Shipping dispatch latency is the earliest anomaly", "Fulfillment handlers are queueing work", "Customers receive delayed updates from notifications", "Inventory is not the primary source of error"],
        "events": ["Shipping provider latency spikes", "Order fulfillment slows", "Customer alerts are delayed", "Root cause identified"],
        "series": [104, 111, 136, 360, 820, 1280, 1540, 1640],
    },
    "notification_backlog": {
        "root": "notification",
        "confidence": 0.82,
        "severity": "LOW",
        "affected": ["gateway", "order", "notification"],
        "metrics": {"gateway": (640, 7, 52), "order": (820, 12, 62), "notification": (1380, 18.4, 84)},
        "evidence": ["Notification queue growth is the earliest symptom", "Delivery retries are saturating downstream workers", "Order processing remains stable under the queue load", "User-facing updates are deferred but not lost"],
        "events": ["Notification backlog grows", "Delivery retries increase", "Customer messages lag", "Root cause identified"],
        "series": [98, 102, 118, 214, 560, 920, 1280, 1380],
    },
}

active: Failure | None = None
active_preset = DEFAULT_PRESET
active_example = DEFAULT_EXAMPLE
counter = 1041


class Simulation(BaseModel):
    failure: Failure | None = Field(default=None)
    preset: str = Field(default=DEFAULT_PRESET)
    example: str = Field(default=DEFAULT_EXAMPLE)


def build_preset_list():
    presets = []
    for preset_key, preset_meta in PRESET_METADATA.items():
        example_list = []
        for example_key, example_meta in EXAMPLE_METADATA.items():
            example_list.append({"id": example_key, "label": example_meta["label"], "description": example_meta["description"]})
        presets.append({
            "id": preset_key,
            "size": len(PRESET_LAYOUTS[preset_key]),
            "label": preset_meta["label"],
            "description": preset_meta["description"],
            "examples": example_list,
        })
    return presets


def get_selected_preset(preset_id: str | None = None, example_id: str | None = None):
    preset_key = preset_id or active_preset or DEFAULT_PRESET
    if preset_key not in PRESET_LAYOUTS:
        preset_key = DEFAULT_PRESET
    example_key = example_id or active_example or DEFAULT_EXAMPLE
    if example_key not in EXAMPLE_METADATA:
        example_key = DEFAULT_EXAMPLE
    if example_key not in {example["id"] for example in build_preset_list()[0]["examples"]}:
        example_key = next(iter(EXAMPLE_METADATA))
    if example_key not in {example["id"] for example in next(preset for preset in build_preset_list() if preset["id"] == preset_key)["examples"]}:
        example_key = next(iter(next(preset for preset in build_preset_list() if preset["id"] == preset_key)["examples"])["id"]) if next(preset for preset in build_preset_list() if preset["id"] == preset_key)["examples"] else DEFAULT_EXAMPLE
    return preset_key, example_key


def service_baseline(preset_id: str, example_id: str):
    service_ids = PRESET_LAYOUTS[preset_id]
    profile_overrides = EXAMPLE_OVERRIDES.get(example_id, {})
    data = []
    for service_id in service_ids:
        template = dict(SERVICE_TEMPLATES[service_id])
        if service_id in profile_overrides:
            template.update(profile_overrides[service_id])
        data.append({"id": service_id, "name": template["name"], "latency_ms": template["latency_ms"], "error_rate": template["error_rate"], "cpu": template["cpu"], "status": "healthy", "anomaly_score": 0.04})
    return data


def services_for(preset_id: str | None = None, example_id: str | None = None):
    preset_key, example_key = get_selected_preset(preset_id, example_id)
    current = service_baseline(preset_key, example_key)
    if active:
        scenario = SCENARIOS[active]
        for item in current:
            if item["id"] in scenario["affected"]:
                metrics = scenario["metrics"].get(item["id"])
                if metrics:
                    item["latency_ms"], item["error_rate"], item["cpu"] = metrics
                    item["status"] = "critical" if item["id"] == scenario["root"] else "degraded"
                    item["anomaly_score"] = scenario["confidence"] if item["id"] == scenario["root"] else round(scenario["confidence"] * 0.76, 2)
    return current


def snapshot():
    preset_key, example_key = get_selected_preset()
    data = services_for(preset_key, example_key)
    if not active:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "services": data,
            "topology": {"nodes": data, "edges": []},
            "incident": None,
            "rca": None,
            "timeline": [],
            "series": [96, 102, 99, 104, 98, 101, 103, 100],
            "selected_preset": next(preset for preset in build_preset_list() if preset["id"] == preset_key),
            "selected_example": next(example for example in next(preset for preset in build_preset_list() if preset["id"] == preset_key)["examples"] if example["id"] == example_key),
            "selected_failure": None,
        }

    scenario = SCENARIOS[active]
    root = next((service for service in data if service["id"] == scenario["root"]), data[0])
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "services": data,
        "topology": {"nodes": data, "edges": []},
        "incident": {"id": counter, "severity": scenario["severity"], "status": "investigating"},
        "rca": {"root_cause": root, "confidence": scenario["confidence"], "evidence": scenario["evidence"], "affected_services": scenario["affected"]},
        "timeline": [{"time": f"12:41:{2 + i * 3:02}", "message": event, "is_origin": i == 0, "is_resolution": i == 3} for i, event in enumerate(scenario["events"])],
        "series": scenario["series"],
        "selected_preset": next(preset for preset in build_preset_list() if preset["id"] == preset_key),
        "selected_example": next(example for example in next(preset for preset in build_preset_list() if preset["id"] == preset_key)["examples"] if example["id"] == example_key),
        "selected_failure": active,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/presets")
def get_presets():
    return {"presets": build_preset_list()}


@app.get("/api/dashboard")
def dashboard():
    return snapshot()


@app.get("/api/services")
def get_services():
    return {"services": services_for()}


@app.get("/api/topology")
def topology():
    return snapshot()["topology"]


@app.post("/api/simulate")
def simulate(payload: Simulation):
    global active, active_preset, active_example, counter
    active_preset = payload.preset if payload.preset in PRESET_LAYOUTS else DEFAULT_PRESET
    active_example = payload.example if payload.example in EXAMPLE_METADATA else DEFAULT_EXAMPLE

    if payload.failure is None:
        active = None
        return snapshot()

    active = payload.failure
    counter += 1
    return snapshot()


@app.post("/api/reset")
def reset():
    global active, active_preset, active_example
    active = None
    active_preset = DEFAULT_PRESET
    active_example = DEFAULT_EXAMPLE
    return snapshot()


@app.get("/api/incidents/{incident_id}/rca")
def rca(incident_id: int):
    if not active:
        raise HTTPException(404, "No active incident")
    return snapshot()["rca"]
