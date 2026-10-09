"""
Derive native (non-Docker) Prometheus + Grafana configs from the repo's monitoring/ configs.

docker-compose wires services by container hostname (backend:8000, prometheus:9090) and mounts
provisioning under /etc/grafana. When running the official binaries directly on this machine,
those need to become 127.0.0.1 addresses and local paths. This script writes the translated
copies into tools/ (gitignored) so monitoring/ stays the single source of truth.

    python simulation/prepare_monitoring.py
"""
import glob
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TOOLS = os.path.join(ROOT, "tools")
MON = os.path.join(ROOT, "monitoring")
LOCAL = os.path.join(TOOLS, "local")

BACKEND = os.environ.get("EVCP_BACKEND_ADDR", "127.0.0.1:8000")
PROMETHEUS_PORT = os.environ.get("PROMETHEUS_PORT", "9090")
GRAFANA_PORT = os.environ.get("GRAFANA_PORT", "3001")


def fwd(path: str) -> str:
    return path.replace("\\", "/")


def main():
    os.makedirs(LOCAL, exist_ok=True)

    # --- Prometheus ---
    with open(os.path.join(MON, "prometheus", "prometheus.yml"), encoding="utf-8") as f:
        prom = f.read().replace("backend:8000", BACKEND).replace('environment: "production"', 'environment: "local"')
    prom_cfg = os.path.join(LOCAL, "prometheus.yml")
    with open(prom_cfg, "w", encoding="utf-8") as f:
        f.write(prom)

    # --- Grafana provisioning ---
    prov = os.path.join(LOCAL, "grafana-provisioning")
    shutil.rmtree(prov, ignore_errors=True)
    shutil.copytree(os.path.join(MON, "grafana", "provisioning"), prov)
    for d in ("plugins", "alerting"):
        os.makedirs(os.path.join(prov, d), exist_ok=True)

    ds = os.path.join(prov, "datasources", "datasource.yml")
    with open(ds, encoding="utf-8") as f:
        text = f.read().replace("http://prometheus:9090", f"http://127.0.0.1:{PROMETHEUS_PORT}")
    with open(ds, "w", encoding="utf-8") as f:
        f.write(text)

    dash = os.path.join(prov, "dashboards", "dashboard.yml")
    with open(dash, encoding="utf-8") as f:
        text = f.read().replace("/etc/grafana/provisioning/dashboards", fwd(os.path.join(prov, "dashboards")))
    with open(dash, "w", encoding="utf-8") as f:
        f.write(text)

    # --- Grafana custom.ini (same settings docker-compose passes as GF_* env vars) ---
    grafana_homes = glob.glob(os.path.join(TOOLS, "grafana*", "conf", "defaults.ini"))
    if not grafana_homes:
        raise SystemExit("Grafana not found under tools/. Download and extract it first.")
    grafana_home = os.path.dirname(os.path.dirname(grafana_homes[0]))
    data_dir = os.path.join(LOCAL, "grafana-data")
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(grafana_home, "conf", "custom.ini"), "w", encoding="utf-8") as f:
        f.write(
            "[server]\n"
            f"http_port = {GRAFANA_PORT}\n"
            "[paths]\n"
            f"data = {fwd(data_dir)}\n"
            f"logs = {fwd(os.path.join(data_dir, 'log'))}\n"
            f"provisioning = {fwd(prov)}\n"
            "[security]\n"
            f"admin_user = {os.environ.get('GRAFANA_ADMIN_USER', 'admin')}\n"
            f"admin_password = {os.environ.get('GRAFANA_ADMIN_PASSWORD', 'admin')}\n"
            "[users]\n"
            "allow_sign_up = false\n"
            "[auth.anonymous]\n"
            "# local simulation only: dashboards are viewable without logging in; editing still needs admin\n"
            "enabled = true\n"
            "org_role = Viewer\n"
            "[dashboards]\n"
            "default_home_dashboard_path = "
            f"{fwd(os.path.join(prov, 'dashboards', 'evcp_dashboard.json'))}\n"
            "[analytics]\n"
            "reporting_enabled = false\n"
            "check_for_updates = false\n"
            "check_for_plugin_updates = false\n"
        )

    print(f"Prometheus config : {prom_cfg}  (scrapes {BACKEND})")
    print(f"Grafana home      : {grafana_home}  (port {GRAFANA_PORT})")
    print(f"Grafana provision : {prov}")


if __name__ == "__main__":
    main()
