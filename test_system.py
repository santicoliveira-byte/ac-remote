import urllib.request
import json
import sys
import time

BASE_URL = "http://127.0.0.1:5000"

print("="*60)
print("   AC REMOTE PRO - SUITE DE TESTES E VERIFICAÇÃO DO SISTEMA")
print("="*60)

passed = 0
failed = 0

def test_endpoint(name, url, method="GET", payload=None, expected_status=200):
    global passed, failed
    full_url = BASE_URL + url
    req = urllib.request.Request(full_url, method=method)
    if payload:
        data_bytes = json.dumps(payload).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    else:
        data_bytes = None

    try:
        start = time.time()
        with urllib.request.urlopen(req, data=data_bytes, timeout=5) as response:
            duration = int((time.time() - start) * 1000)
            status = response.status
            body = response.read().decode('utf-8', errors='ignore')
            
            if status == expected_status:
                print(f" [PASS] {name} ({method} {url}) -> {status} OK in {duration}ms")
                passed += 1
                try:
                    return json.loads(body)
                except Exception:
                    return body
            else:
                print(f" [FAIL] {name} -> Esperava {expected_status}, obteve {status}")
                failed += 1
                return None
    except Exception as e:
        print(f" [FAIL] {name} ({method} {url}) -> Exceção: {e}")
        failed += 1
        return None

# 1. Página Principal (HTML)
print("\n--- 1. VERIFICAR FRONTEND & ATIVOS ESTÁTICOS ---")
html_body = test_endpoint("Página Principal (index.html)", "/")
if html_body and "AC REMOTE" in html_body and "shift-lights-bar" in html_body:
    print("   [OK] index.html contém o novo HUD Cockpit e Shift Lights!")
else:
    print("   [AVISO] Verifique o conteúdo do index.html")

# 2. Status do Servidor
print("\n--- 2. VERIFICAR STATUS DO SERVIDOR ---")
status_data = test_endpoint("Endpoint Status", "/api/status")
if status_data:
    print(f"   [OK] IP Local: {status_data.get('local_ip')}")
    print(f"   [OK] Modo Demo: {status_data.get('demo_mode')}")
    print(f"   [OK] Contagem: {status_data.get('cars_count')} carros / {status_data.get('tracks_count')} pistas")

# 3. Ping / Diagnóstico
print("\n--- 3. VERIFICAR PING & DIAGNÓSTICO ---")
ping_data = test_endpoint("Endpoint Ping", "/api/ping")
if ping_data:
    print(f"   [OK] Pong: {ping_data.get('pong')}, CPU: {ping_data.get('cpu')}%, RAM: {ping_data.get('ram')}%")

# 4. Telemetria em Tempo Real (Shared Memory)
print("\n--- 4. VERIFICAR TELEMETRIA (SHARED MEMORY) ---")
telem_data = test_endpoint("Endpoint Telemetria", "/api/telemetry")
if telem_data and telem_data.get("success"):
    d = telem_data.get("data", {})
    print(f"   [OK] Telemetria Ativa: {d.get('active')}")
    print(f"   [OK] Mudança: {d.get('gear')}, RPM: {d.get('rpm')}, Vel: {d.get('speed_kmh')} km/h")
    print(f"   [OK] G-Force: {d.get('g_force')}")
    print(f"   [OK] Pneus Temps: {d.get('tyre_temps')}")
    print(f"   [OK] Pneus Pressures: {d.get('tyre_pressures')}")
    print(f"   [OK] Pneus Wear: {d.get('tyre_wear')}")
    print(f"   [OK] Travões Brakes: {d.get('brake_temps')}")
    print(f"   [OK] Bandeira: {d.get('flag')}")
    print(f"   [OK] Status Corrida: {d.get('status')}")

# 5. Lista de Carros
print("\n--- 5. VERIFICAR GARAGEM DE CARROS ---")
cars_data = test_endpoint("Endpoint Carros", "/api/cars")
if cars_data and cars_data.get("cars"):
    cars = cars_data["cars"]
    print(f"   [OK] Carros carregados: {len(cars)}")
    c0 = cars[0]
    print(f"   [OK] Primeiro Carro: {c0.get('name')} ({c0.get('brand')}) com {len(c0.get('skins', []))} skins")
    print(f"   [OK] Specs: {c0.get('specs')}")

# 6. Lista de Pistas
print("\n--- 6. VERIFICAR SELETOR DE PISTAS ---")
tracks_data = test_endpoint("Endpoint Pistas", "/api/tracks")
if tracks_data and tracks_data.get("tracks"):
    tracks = tracks_data["tracks"]
    print(f"   [OK] Pistas carregadas: {len(tracks)}")
    t0 = tracks[0]
    print(f"   [OK] Primeira Pista: {t0.get('name')} ({t0.get('specs')})")

# 7. Configuração & Servidores Favoritos
print("\n--- 7. VERIFICAR CONFIGURAÇÃO & SERVIDORES ---")
cfg_data = test_endpoint("Endpoint Config", "/api/config")
if cfg_data:
    srvs = cfg_data.get("favorite_servers", [])
    print(f"   [OK] Servidores Favoritos: {len(srvs)}")

# 8. Teste de Ações de Controlo em Pista (Button Box)
print("\n--- 8. VERIFICAR AÇÕES DO BUTTON BOX ---")
actions = ["volume_up", "volume_down", "volume_mute", "camera_f1", "camera_f6", "lights", "wipers", "tc_toggle", "abs_toggle"]
for act in actions:
    act_data = test_endpoint(f"Ação: {act}", "/api/action", method="POST", payload={"action": act})

# 9. Teste de Validação de Lançamento (Dry Run sem abrir acs.exe)
print("\n--- 9. VERIFICAR ROTA DE LANÇAMENTO (DRY-RUN) ---")
launch_payload = {
    "car_id": "ks_ferrari_488_gt3",
    "skin_id": "00_racing_red",
    "track_id": "spa",
    "track_layout": "",
    "mode": "practice",
    "weather": "clear",
    "time": "14:00",
    "start_game": False  # Apenas atualiza race.ini e valida
}
launch_data = test_endpoint("Lançamento /api/launch (dry run)", "/api/launch", method="POST", payload=launch_payload)
# 10. Teste da Estratégia de Boxes & Relatório de Sessão (Fase 2)
print("\n--- 10. VERIFICAR ESTRATÉGIA DE BOXES & RELATÓRIO (FASE 2) ---")
pit_get = test_endpoint("Estratégia Boxes (GET /api/pit_strategy)", "/api/pit_strategy")
if pit_get and pit_get.get("strategy"):
    st = pit_get["strategy"]
    print(f"   [OK] Composto Alvo: {st.get('tyre_compound')}, Combustível: {st.get('fuel_to_add')} L")

pit_post = test_endpoint("Programar Boxes (POST /api/pit_strategy)", "/api/pit_strategy", method="POST", payload={
    "fuel_to_add": 42.0,
    "tyre_compound": "MEDIUM",
    "repair_body": True,
    "repair_suspension": False
})
if pit_post:
    print(f"   [OK] Resposta Pit Strategy: {pit_post.get('message')}")

report_data = test_endpoint("Relatório da Sessão (GET /api/session_report)", "/api/session_report")
if report_data and report_data.get("report"):
    rep = report_data["report"]
    print(f"   [OK] Relatório Gerado: Voltas {rep.get('completed_laps')}, Melhor Tempo: {rep.get('best_time')}")

print("\n" + "="*60)
print(f"   RESULTADO DOS TESTES: {passed} PASSOU | {failed} FALHOU")
print("="*60)
