import os
import sys
import json
import re
import time
import shutil
import socket
import subprocess
import traceback
from pathlib import Path
try:
    import psutil
except ImportError:
    psutil = None

try:
    import pydirectinput
    pydirectinput.FAILSAFE = False
except Exception:
    pydirectinput = None

try:
    import keyboard
except Exception:
    keyboard = None

def focus_game_window():
    """Traz a janela do Assetto Corsa para primeiro plano no Windows se visivel."""
    if sys.platform != 'win32' or IS_VERCEL:
        return False
    try:
        import win32gui
        target_hwnds = []
        def enum_cb(hwnd, extra):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if "Assetto Corsa" in title or "acs" in title.lower():
                    extra.append(hwnd)
        win32gui.EnumWindows(enum_cb, target_hwnds)
        if target_hwnds:
            hwnd = target_hwnds[0]
            win32gui.ShowWindow(hwnd, 9)  # SW_RESTORE
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.04)
            return True
    except Exception:
        pass
    return False

from flask import Flask, request, jsonify, render_template, send_file, Response, send_from_directory

app = Flask(__name__, template_folder='templates', static_folder='static')

BASE_DIR = Path(__file__).resolve().parent
IS_VERCEL = bool(os.environ.get('VERCEL'))

# Na Vercel, o diretório raiz é somente leitura; usa /tmp para gravar configurações temporárias
if IS_VERCEL:
    CONFIG_PATH = Path('/tmp/config.json')
else:
    CONFIG_PATH = BASE_DIR / "config.json"

def prevent_pc_sleep():
    """
    Mantém o PC sempre acordado (evita suspensão e perda de ligação com a rede/iPhone)
    usando a API nativa do Windows kernel32.
    """
    if sys.platform == 'win32' and not IS_VERCEL:
        try:
            import ctypes
            ES_CONTINUOUS = 0x80000000
            ES_SYSTEM_REQUIRED = 0x00000001
            ES_AWAYMODE_REQUIRED = 0x00000040
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED)
            print("[ENERGIA] Modo Keep-Awake ATIVADO: O PC estará sempre ligado (não irá suspender).")
        except Exception as e:
            print(f"[AVISO] Não foi possível ativar Keep-Awake: {e}")

DEFAULT_CONFIG = {
    "ac_path": r"C:\Program Files (x86)\Steam\steamapps\common\assettocorsa",
    "race_ini": "~/Documents/Assetto Corsa/cfg/race.ini",
    "remote_pc_url": "",
    "favorite_servers": [
        {
            "id": "srp-public",
            "name": "SRP - Shutoko Revival Project [PT/EU]",
            "track": "Shutoko Revival Project (Shibaura)",
            "car_count": "32 slots",
            "ping": "24ms",
            "ip": "141.95.74.88:9600",
            "cm_link": "https://acstuff.ru/s/q:race/online/join?ip=141.95.74.88&httpPort=9600"
        },
        {
            "id": "nords-tourist",
            "name": "Nürburgring Nordschleife - Tourist Trackday",
            "track": "Nordschleife (Tourist)",
            "car_count": "24 slots",
            "ping": "38ms",
            "ip": "51.89.96.120:9600",
            "cm_link": "https://acstuff.ru/s/q:race/online/join?ip=51.89.96.120&httpPort=9600"
        },
        {
            "id": "drift-playground",
            "name": "Drift Playground - Tandem Masters",
            "track": "Drift Playground",
            "car_count": "16 slots",
            "ping": "31ms",
            "ip": "135.125.188.42:9600",
            "cm_link": "https://acstuff.ru/s/q:race/online/join?ip=135.125.188.42&httpPort=9600"
        }
    ]
}

def load_config():
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            # Ensure defaults for missing keys
            for k, v in DEFAULT_CONFIG.items():
                if k not in cfg:
                    cfg[k] = v
            return cfg
    except Exception as e:
        print(f"[AVISO] Erro ao ler config.json: {e}")
        return DEFAULT_CONFIG.copy()

def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[ERRO] Erro ao guardar config.json: {e}")
        return False

def get_resolved_paths():
    cfg = load_config()
    ac_path_str = cfg.get("ac_path", DEFAULT_CONFIG["ac_path"])
    race_ini_str = cfg.get("race_ini", DEFAULT_CONFIG["race_ini"])
    
    resolved_ac = Path(os.path.expanduser(ac_path_str)).resolve()
    resolved_race = Path(os.path.expanduser(race_ini_str)).resolve()
    return resolved_ac, resolved_race

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not actually create an external connection, simply resolves local adapter
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def clean_and_parse_json(content):
    """
    Parser tolerante a JSON com comentários, trailing commas e caracteres inválidos
    comum em mods do Assetto Corsa.
    """
    if not content or not content.strip():
        return {}
    
    # 1. Tentativa padrão direta
    try:
        return json.loads(content)
    except Exception:
        pass

    # 2. Remover comentários de bloco e linha única (// e /* ... */)
    cleaned = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    cleaned = re.sub(r'//.*$', '', cleaned, flags=re.MULTILINE)
    
    # 3. Remover trailing commas em objetos e listas: , } -> } e , ] -> ]
    cleaned = re.sub(r',\s*([\}\]])', r'\1', cleaned)
    
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 4. Tentar corrigir quebras de linha brutas dentro de strings
    lines = cleaned.splitlines()
    reconstructed = []
    in_string = False
    for line in lines:
        reconstructed.append(line)
    
    cleaned2 = "\n".join(reconstructed)
    # Remove qualquer caractere de controlo ASCII exceto \n, \r, \t
    cleaned2 = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned2)
    cleaned2 = re.sub(r',\s*([\}\]])', r'\1', cleaned2)

    try:
        return json.loads(cleaned2)
    except Exception:
        pass

    # 5. Fallback com Regex para extrair campos essenciais se o JSON estiver muito quebrado
    extracted = {}
    name_m = re.search(r'"name"\s*:\s*"([^"]+)"', content)
    if name_m:
        extracted["name"] = name_m.group(1)
    brand_m = re.search(r'"brand"\s*:\s*"([^"]+)"', content)
    if brand_m:
        extracted["brand"] = brand_m.group(1)
    bhp_m = re.search(r'"bhp"\s*:\s*"([^"]+)"', content)
    if bhp_m:
        extracted.setdefault("specs", {})["bhp"] = bhp_m.group(1)
    weight_m = re.search(r'"weight"\s*:\s*"([^"]+)"', content)
    if weight_m:
        extracted.setdefault("specs", {})["weight"] = weight_m.group(1)
        
    return extracted

def normalize_bhp(bhp_val):
    if not bhp_val:
        return "N/D"
    if isinstance(bhp_val, list):
        bhp_val = bhp_val[0] if bhp_val else ""
    s = str(bhp_val).strip()
    # Extrair número principal se contiver ex: "450 bhp" ou "450 bhp @ 7500 rpm"
    m = re.search(r'(\d+)\s*(?:bhp|cv|hp|cvs)?', s, re.IGNORECASE)
    if m:
        return f"{m.group(1)} CV"
    return s

def normalize_weight(weight_val):
    if not weight_val:
        return "N/D"
    if isinstance(weight_val, list):
        weight_val = weight_val[0] if weight_val else ""
    s = str(weight_val).strip()
    m = re.search(r'(\d+[\.,]?\d*)\s*(?:kg)?', s, re.IGNORECASE)
    if m:
        return f"{m.group(1)} kg"
    return s

# ----------------- DEMO / MOCK DATA (quando AC ainda não está configurado) -----------------
DEMO_CARS = [
    {
        "id": "ks_ferrari_488_gt3",
        "name": "Ferrari 488 GT3",
        "brand": "Ferrari",
        "specs": {"bhp": "600 CV", "weight": "1260 kg", "torque": "700 Nm", "topSpeed": "290 km/h"},
        "skins": ["00_racing_red", "01_scuderia_yellow", "02_corsa_black", "03_matte_grey"],
        "default_skin": "00_racing_red",
        "badge_url": "/api/img/badge/ks_ferrari_488_gt3",
        "country": "Italy"
    },
    {
        "id": "ks_porsche_911_gt3_rs",
        "name": "Porsche 911 GT3 RS (991)",
        "brand": "Porsche",
        "specs": {"bhp": "500 CV", "weight": "1420 kg", "torque": "460 Nm", "topSpeed": "310 km/h"},
        "skins": ["00_lava_orange", "01_miami_blue", "02_guards_red", "03_racing_yellow"],
        "default_skin": "00_lava_orange",
        "badge_url": "/api/img/badge/ks_porsche_911_gt3_rs",
        "country": "Germany"
    },
    {
        "id": "bmw_m3_e30_drift",
        "name": "BMW M3 E30 Drift Edition",
        "brand": "BMW",
        "specs": {"bhp": "380 CV", "weight": "1150 kg", "torque": "410 Nm", "topSpeed": "260 km/h"},
        "skins": ["00_motorsport_classic", "01_matte_black", "02_alpina_blue"],
        "default_skin": "00_motorsport_classic",
        "badge_url": "/api/img/badge/bmw_m3_e30_drift",
        "country": "Germany"
    },
    {
        "id": "toyota_supra_mkiv_tuned",
        "name": "Toyota Supra RZ Mk.IV Time Attack",
        "brand": "Toyota",
        "specs": {"bhp": "720 CV", "weight": "1380 kg", "torque": "820 Nm", "topSpeed": "330 km/h"},
        "skins": ["00_quicksilver", "01_midnight_purple", "02_castrol_racing"],
        "default_skin": "00_quicksilver",
        "badge_url": "/api/img/badge/toyota_supra_mkiv_tuned",
        "country": "Japan"
    },
    {
        "id": "ks_lamborghini_huracan_performante",
        "name": "Lamborghini Huracán Performante",
        "brand": "Lamborghini",
        "specs": {"bhp": "640 CV", "weight": "1382 kg", "torque": "600 Nm", "topSpeed": "325 km/h"},
        "skins": ["00_arancio_anthaeus", "01_verde_mantis", "02_bianco_monocerus"],
        "default_skin": "00_arancio_anthaeus",
        "badge_url": "/api/img/badge/ks_lamborghini_huracan_performante",
        "country": "Italy"
    },
    {
        "id": "ks_mazda_miata",
        "name": "Mazda MX-5 Miata NA Cup",
        "brand": "Mazda",
        "specs": {"bhp": "165 CV", "weight": "960 kg", "torque": "190 Nm", "topSpeed": "215 km/h"},
        "skins": ["00_classic_red", "01_mariner_blue", "02_sunburst_yellow"],
        "default_skin": "00_classic_red",
        "badge_url": "/api/img/badge/ks_mazda_miata",
        "country": "Japan"
    }
]

DEMO_TRACKS = [
    {
        "id": "spa",
        "name": "Circuit de Spa-Francorchamps",
        "layout": "",
        "specs": {"length": "7.004 km", "pitboxes": "42", "country": "Belgium", "city": "Stavelot"},
        "preview_url": "/api/img/track/spa"
    },
    {
        "id": "ks_nordschleife",
        "name": "Nürburgring Nordschleife",
        "layout": "tourist",
        "specs": {"length": "20.832 km", "pitboxes": "36", "country": "Germany", "city": "Nürburg"},
        "preview_url": "/api/img/track/ks_nordschleife?layout=tourist"
    },
    {
        "id": "ks_nordschleife",
        "name": "Nürburgring Nordschleife",
        "layout": "endurance",
        "specs": {"length": "25.378 km", "pitboxes": "56", "country": "Germany", "city": "Nürburg"},
        "preview_url": "/api/img/track/ks_nordschleife?layout=endurance"
    },
    {
        "id": "monza",
        "name": "Autodromo Nazionale Monza",
        "layout": "",
        "specs": {"length": "5.793 km", "pitboxes": "30", "country": "Italy", "city": "Monza"},
        "preview_url": "/api/img/track/monza"
    },
    {
        "id": "ks_silverstone",
        "name": "Silverstone Circuit",
        "layout": "gp",
        "specs": {"length": "5.891 km", "pitboxes": "36", "country": "United Kingdom", "city": "Silverstone"},
        "preview_url": "/api/img/track/ks_silverstone?layout=gp"
    },
    {
        "id": "drift_playground",
        "name": "Drift Playground",
        "layout": "",
        "specs": {"length": "1.100 km", "pitboxes": "18", "country": "Japan", "city": "Ebisu Style"},
        "preview_url": "/api/img/track/drift_playground"
    }
]

# ----------------- ROTAS PRINCIPAIS -----------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')

@app.route('/api/status', methods=['GET'])
def get_status():
    cfg = load_config()
    ac_path, race_ini = get_resolved_paths()
    cars_dir = ac_path / "content" / "cars"
    tracks_dir = ac_path / "content" / "tracks"
    
    ac_valid = cars_dir.exists() and cars_dir.is_dir()
    race_ini_valid = race_ini.parent.exists()
    
    cars_count = 0
    tracks_count = 0
    
    if ac_valid:
        try:
            cars_count = len([p for p in cars_dir.iterdir() if p.is_dir()])
            tracks_count = len([p for p in tracks_dir.iterdir() if p.is_dir()])
        except Exception:
            pass

    return jsonify({
        "is_vercel": IS_VERCEL,
        "keep_awake": not IS_VERCEL and sys.platform == 'win32',
        "remote_pc_url": cfg.get("remote_pc_url", ""),
        "ac_path": str(ac_path),
        "ac_valid": ac_valid,
        "race_ini": str(race_ini),
        "race_ini_valid": race_ini_valid,
        "cars_count": cars_count if ac_valid else len(DEMO_CARS),
        "tracks_count": tracks_count if ac_valid else len(DEMO_TRACKS),
        "demo_mode": not ac_valid,
        "local_ip": "Vercel Cloud" if IS_VERCEL else get_local_ip(),
        "game_running": is_game_running()
    })

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'POST':
        data = request.json or {}
        cfg = load_config()
        if "ac_path" in data:
            cfg["ac_path"] = data["ac_path"].strip()
        if "race_ini" in data:
            cfg["race_ini"] = data["race_ini"].strip()
        if "remote_pc_url" in data:
            cfg["remote_pc_url"] = data["remote_pc_url"].strip()
        if "favorite_servers" in data:
            cfg["favorite_servers"] = data["favorite_servers"]
        
        saved = save_config(cfg)
        return jsonify({"success": saved, "config": cfg})
    else:
        return jsonify(load_config())

@app.route('/api/proxy/<path:subpath>', methods=['GET', 'POST'])
def proxy_to_pc(subpath):
    """
    Permite que a Vercel funcione como ponte transparente (Proxy)
    para o PC físico do utilizador quando acessado pela nuvem.
    """
    import requests
    cfg = load_config()
    target = request.headers.get('X-Target-PC') or request.args.get('target_pc') or cfg.get("remote_pc_url", "")
    if not target:
        return jsonify({"success": False, "error": "Nenhum endereço de PC configurado para reencaminhamento."}), 400

    target = target.rstrip('/')
    url = f"{target}/api/{subpath}"
    
    try:
        if request.method == 'POST':
            resp = requests.post(url, json=request.json, params=request.args, timeout=12)
        else:
            resp = requests.get(url, params=request.args, timeout=12)
            
        return Response(resp.content, status=resp.status_code, content_type=resp.headers.get('content-type', 'application/json'))
    except Exception as e:
        return jsonify({"success": False, "error": f"Não foi possível comunicar com o PC em {target}: {e}"}), 502


@app.route('/api/cars', methods=['GET'])
def get_cars():
    ac_path, _ = get_resolved_paths()
    cars_dir = ac_path / "content" / "cars"
    
    # Se o diretório do Assetto Corsa não existir ou for inválido, devolve dados demonstrativos
    if not cars_dir.exists() or not cars_dir.is_dir():
        return jsonify({
            "success": True,
            "demo_mode": True,
            "message": "Assetto Corsa não encontrado no caminho configurado. A apresentar dados de demonstração.",
            "cars": DEMO_CARS
        })

    cars_list = []
    try:
        car_folders = sorted([p for p in cars_dir.iterdir() if p.is_dir()], key=lambda x: x.name.lower())
        for folder in car_folders:
            car_id = folder.name
            ui_json_path = folder / "ui" / "ui_car.json"
            
            car_data = {
                "id": car_id,
                "name": car_id.replace("_", " ").title(),
                "brand": "Outro",
                "specs": {"bhp": "N/D", "weight": "N/D"},
                "skins": [],
                "country": ""
            }
            
            if ui_json_path.exists():
                try:
                    with open(ui_json_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                        raw = f.read()
                    parsed = clean_and_parse_json(raw)
                    if parsed:
                        if parsed.get("name"):
                            car_data["name"] = str(parsed["name"]).strip()
                        if parsed.get("brand"):
                            car_data["brand"] = str(parsed["brand"]).strip()
                        if parsed.get("country"):
                            car_data["country"] = str(parsed["country"]).strip()
                        
                        specs = parsed.get("specs", {})
                        if isinstance(specs, dict):
                            car_data["specs"] = {
                                "bhp": normalize_bhp(specs.get("bhp")),
                                "weight": normalize_weight(specs.get("weight")),
                                "torque": str(specs.get("torque", "N/D")),
                                "topSpeed": str(specs.get("topSpeed", "N/D")),
                                "acceleration": str(specs.get("acceleration", "N/D"))
                            }
                except Exception as e:
                    print(f"[AVISO] Falha ao processar {ui_json_path}: {e}")

            # Ler skins
            skins_dir = folder / "skins"
            skins = []
            if skins_dir.exists() and skins_dir.is_dir():
                try:
                    skins = sorted([s.name for s in skins_dir.iterdir() if s.is_dir()])
                except Exception:
                    pass
            
            if not skins:
                skins = ["default"]
                
            car_data["skins"] = skins
            car_data["default_skin"] = skins[0]
            car_data["badge_url"] = f"/api/img/badge/{car_id}"
            cars_list.append(car_data)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({
        "success": True,
        "demo_mode": False,
        "count": len(cars_list),
        "cars": cars_list
    })

@app.route('/api/tracks', methods=['GET'])
def get_tracks():
    ac_path, _ = get_resolved_paths()
    tracks_dir = ac_path / "content" / "tracks"
    
    if not tracks_dir.exists() or not tracks_dir.is_dir():
        return jsonify({
            "success": True,
            "demo_mode": True,
            "message": "Pistas não encontradas. A apresentar pistas de demonstração.",
            "tracks": DEMO_TRACKS
        })

    tracks_list = []
    try:
        track_folders = sorted([p for p in tracks_dir.iterdir() if p.is_dir()], key=lambda x: x.name.lower())
        for folder in track_folders:
            track_id = folder.name
            ui_dir = folder / "ui"
            
            if not ui_dir.exists() or not ui_dir.is_dir():
                continue

            # Detetar se há subpastas de layouts em ui/
            sub_layouts = []
            try:
                sub_layouts = [s for s in ui_dir.iterdir() if s.is_dir() and (s / "ui_track.json").exists()]
            except Exception:
                pass
            
            base_ui_json = ui_dir / "ui_track.json"
            
            # Se tiver subpastas com ui_track.json, cada uma é um layout
            if sub_layouts:
                for sub in sorted(sub_layouts, key=lambda x: x.name.lower()):
                    layout_name = sub.name
                    t_info = parse_track_json(sub / "ui_track.json", track_id, layout_name)
                    t_info["preview_url"] = f"/api/img/track/{track_id}?layout={layout_name}"
                    tracks_list.append(t_info)
            elif base_ui_json.exists():
                t_info = parse_track_json(base_ui_json, track_id, "")
                t_info["preview_url"] = f"/api/img/track/{track_id}"
                tracks_list.append(t_info)
            else:
                # Caso não tenha ui_track.json, cria entrada básica
                tracks_list.append({
                    "id": track_id,
                    "name": track_id.replace("_", " ").title(),
                    "layout": "",
                    "specs": {"length": "N/D", "pitboxes": "N/D", "country": "", "city": ""},
                    "preview_url": f"/api/img/track/{track_id}"
                })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({
        "success": True,
        "demo_mode": False,
        "count": len(tracks_list),
        "tracks": tracks_list
    })

def parse_track_json(json_path, track_id, layout):
    default_name = track_id.replace("_", " ").title()
    if layout:
        default_name += f" ({layout.replace('_', ' ').title()})"
        
    info = {
        "id": track_id,
        "name": default_name,
        "layout": layout,
        "specs": {"length": "N/D", "pitboxes": "N/D", "country": "", "city": ""}
    }
    
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                parsed = clean_and_parse_json(f.read())
            if parsed:
                if parsed.get("name"):
                    raw_n = str(parsed["name"]).strip()
                    info["name"] = raw_n if not layout else f"{raw_n} [{layout}]"
                info["specs"]["length"] = str(parsed.get("length", "N/D"))
                info["specs"]["pitboxes"] = str(parsed.get("pitboxes", "N/D"))
                info["specs"]["country"] = str(parsed.get("country", ""))
                info["specs"]["city"] = str(parsed.get("city", ""))
                if parsed.get("description"):
                    info["description"] = str(parsed["description"])[:200]
        except Exception:
            pass
            
    return info

# ----------------- ROTAS DE IMAGENS -----------------

@app.route('/api/img/car/<car_id>/<skin_id>', methods=['GET'])
def get_car_skin_image(car_id, skin_id):
    ac_path, _ = get_resolved_paths()
    skin_dir = ac_path / "content" / "cars" / car_id / "skins" / skin_id
    
    candidates = [
        skin_dir / "preview.jpg",
        skin_dir / "preview.png",
        skin_dir / "preview.jpeg",
        skin_dir / "Preview.jpg"
    ]
    
    for c in candidates:
        if c.exists() and c.is_file():
            mime = "image/jpeg" if c.suffix.lower() in [".jpg", ".jpeg"] else "image/png"
            return send_file(c, mimetype=mime)
            
    # Tenta qualquer preview em qualquer skin do carro
    car_skins_dir = ac_path / "content" / "cars" / car_id / "skins"
    if car_skins_dir.exists():
        try:
            for s in car_skins_dir.iterdir():
                if s.is_dir():
                    for f in ["preview.jpg", "preview.png"]:
                        p = s / f
                        if p.exists():
                            return send_file(p, mimetype="image/jpeg" if f.endswith(".jpg") else "image/png")
        except Exception:
            pass

    # Fallback SVG estilizado gaming com gradiente e design futurista
    return Response(generate_car_placeholder_svg(car_id, skin_id), mimetype='image/svg+xml')

@app.route('/api/img/badge/<car_id>', methods=['GET'])
def get_car_badge(car_id):
    ac_path, _ = get_resolved_paths()
    badge_path = ac_path / "content" / "cars" / car_id / "ui" / "badge.png"
    
    if badge_path.exists() and badge_path.is_file():
        return send_file(badge_path, mimetype='image/png')
        
    return Response(generate_badge_placeholder_svg(car_id), mimetype='image/svg+xml')

@app.route('/api/img/track/<track_id>', methods=['GET'])
@app.route('/api/img/track/<track_id>/<layout>', methods=['GET'])
def get_track_preview(track_id, layout=None):
    layout_arg = layout or request.args.get('layout', '')
    ac_path, _ = get_resolved_paths()
    
    track_ui = ac_path / "content" / "tracks" / track_id / "ui"
    
    candidates = []
    if layout_arg:
        candidates.extend([
            track_ui / layout_arg / "preview.png",
            track_ui / layout_arg / "preview.jpg",
            track_ui / layout_arg / "Preview.png"
        ])
        
    candidates.extend([
        track_ui / "preview.png",
        track_ui / "preview.jpg",
        track_ui / "Preview.png"
    ])
    
    for c in candidates:
        if c.exists() and c.is_file():
            mime = "image/png" if c.suffix.lower() == ".png" else "image/jpeg"
            return send_file(c, mimetype=mime)
            
    return Response(generate_track_placeholder_svg(track_id, layout_arg), mimetype='image/svg+xml')

# ----------------- GERADORES DE PLACEHOLDER SVG -----------------

def generate_car_placeholder_svg(car_id, skin_id):
    title = car_id.replace("_", " ").title()
    subtitle = f"Skin: {skin_id.replace('_', ' ')}"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0e17" />
      <stop offset="50%" stop-color="#141824" />
      <stop offset="100%" stop-color="#07090e" />
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff2a5f" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="800" height="450" fill="url(#bg)"/>
  <rect width="800" height="450" fill="url(#grid)"/>
  
  <!-- Linhas de velocidade esportivas -->
  <path d="M 100 320 L 700 320" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  <path d="M 180 320 L 620 320" stroke="url(#neon)" stroke-width="4" stroke-linecap="round"/>
  
  <!-- Silhueta GT estilizada -->
  <path d="M 220 300 C 260 250, 310 210, 420 205 C 500 200, 560 230, 600 280 L 630 295 C 640 300, 630 305, 600 305 L 220 305 Z" 
        fill="rgba(255,42,95,0.08)" stroke="#ff2a5f" stroke-width="2.5" stroke-dasharray="8 4"/>
  <circle cx="300" cy="305" r="24" fill="#141824" stroke="#06b6d4" stroke-width="3"/>
  <circle cx="540" cy="305" r="24" fill="#141824" stroke="#06b6d4" stroke-width="3"/>
  
  <!-- Ícone AC -->
  <rect x="50" y="40" width="90" height="28" rx="6" fill="rgba(255,42,95,0.2)" stroke="#ff2a5f" stroke-width="1.5"/>
  <text x="95" y="59" fill="#ff2a5f" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="2">ASSETTO</text>

  <!-- Nome do Carro e Skin -->
  <text x="400" y="150" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" text-anchor="middle" letter-spacing="1">{title}</text>
  <text x="400" y="180" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="15" font-weight="500" text-anchor="middle">{subtitle}</text>
  
  <text x="400" y="380" fill="rgba(255,255,255,0.3)" font-family="monospace" font-size="12" text-anchor="middle">PREVIEW CARRO / MOD</text>
</svg>"""

def generate_track_placeholder_svg(track_id, layout):
    title = track_id.replace("_", " ").title()
    if layout:
        title += f" ({layout})"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <defs>
    <linearGradient id="tbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a101d" />
      <stop offset="100%" stop-color="#05080e" />
    </linearGradient>
    <linearGradient id="tline" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#tbg)"/>
  
  <!-- Traçado de pista estilizado -->
  <path d="M 200 320 C 120 280, 140 180, 240 150 C 340 120, 480 140, 560 180 C 660 230, 680 320, 580 340 C 480 360, 360 300, 300 320 Z" 
        fill="none" stroke="url(#tline)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        
  <path d="M 200 320 C 120 280, 140 180, 240 150 C 340 120, 480 140, 560 180 C 660 230, 680 320, 580 340 C 480 360, 360 300, 300 320 Z" 
        fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="10 15"/>
        
  <!-- Checkered flag & title -->
  <text x="400" y="80" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="800" text-anchor="middle">{title}</text>
  <text x="400" y="110" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600" text-anchor="middle" letter-spacing="3">CIRCUITO / LAYOUT</text>
</svg>"""

def generate_badge_placeholder_svg(car_id):
    name = car_id.split('_')[0].upper()[:3]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="46" fill="#181c2a" stroke="#ff2a5f" stroke-width="4"/>
  <text x="50" y="60" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="900" text-anchor="middle">{name}</text>
</svg>"""

# ----------------- GESTÃO DE PROCESSOS DO ASSETTO CORSA -----------------

def is_game_running():
    """Verifica se o acs.exe ou acs_x86.exe está a correr no Windows."""
    if psutil:
        try:
            for proc in psutil.process_iter(['name']):
                pname = proc.info.get('name')
                if pname and pname.lower() in ['acs.exe', 'acs_x86.exe']:
                    return True
        except Exception:
            pass
            
    if sys.platform == 'win32':
        try:
            out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq acs.exe'], capture_output=True, text=True)
            if 'acs.exe' in out.stdout.lower():
                return True
        except Exception:
            pass
    return False

def kill_game_process():
    """Encerra o jogo forçadamente (botão de emergência / sair para o desktop)."""
    killed = False
    if psutil:
        try:
            for proc in psutil.process_iter(['name', 'pid']):
                pname = proc.info.get('name')
                if pname and pname.lower() in ['acs.exe', 'acs_x86.exe']:
                    proc.kill()
                    killed = True
        except Exception:
            pass

    if sys.platform == 'win32':
        try:
            subprocess.run(['taskkill', '/F', '/IM', 'acs.exe'], capture_output=True, shell=False)
            subprocess.run(['taskkill', '/F', '/IM', 'acs_x86.exe'], capture_output=True, shell=False)
            killed = True
        except Exception:
            pass
    return killed

# ----------------- ATUALIZAÇÃO SEGURA DO RACE.INI -----------------

def hour_to_sun_angle(time_str):
    """
    Converte horário 'HH:MM' (ex: '14:30') para o ângulo de sol SUN_ANGLE do Assetto Corsa.
    Em AC: 13:00 ~ 16.0 deg, 08:00 ~ -48.0 deg, 18:00 ~ 80.0 deg.
    """
    try:
        parts = time_str.split(':')
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        total_hours = h + (m / 60.0)
        angle = (total_hours - 13.0) * 12.8 + 16.0
        return round(angle, 1)
    except Exception:
        return 16.0

def update_race_ini_file(race_ini_path, updates):
    """
    Atualiza apenas as chaves necessárias no race.ini preservandomaiúsculas,
    comentários e a formatação exata que o simulador exige.
    Faz backup prévio para race.ini.bak.
    """
    race_ini_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Fazer cópia de segurança se o ficheiro existir
    if race_ini_path.exists() and race_ini_path.is_file():
        try:
            bak_path = race_ini_path.with_name(race_ini_path.name + ".bak")
            shutil.copyfile(race_ini_path, bak_path)
            print(f"[AC REMOTE] Backup criado: {bak_path}")
        except Exception as e:
            print(f"[AVISO] Falha ao criar backup do race.ini: {e}")

    # Se o ficheiro não existir, gera o template padrão completo
    if not race_ini_path.exists() or race_ini_path.stat().st_size == 0:
        car = updates.get("CAR_0", {}).get("MODEL", "ks_ferrari_488_gt3")
        skin = updates.get("CAR_0", {}).get("SKIN", "default")
        track = updates.get("RACE", {}).get("TRACK", "spa")
        layout = updates.get("RACE", {}).get("CONFIG_TRACK", "")
        mode_name = updates.get("SESSION_0", {}).get("NAME", "Practice")
        mode_type = updates.get("SESSION_0", {}).get("TYPE", "1")
        sun_angle = updates.get("LIGHTING", {}).get("SUN_ANGLE", "16.0")

        initial_content = f"""[RACE]
TRACK={track}
CONFIG_TRACK={layout}
CARS=1
AI_LEVEL=98
FIXED_SETUP=0
PENALTIES=1
MODEL={car}
MODEL_CONFIG=
SKIN={skin}

[GHOST_CAR]
RECORDING=1
PLAYING=1
SECONDS_ADVANTAGE=0
LOAD=1

[REPLAY]
FILENAME=
ACTIVE=0

[LIGHTING]
SUN_ANGLE={sun_angle}
TIME_MULT=1
CLOUD_SPEED=1

[WEATHER]
NAME=3_clear

[TEMPERATURE]
AMBIENT=22
ROAD=28

[DYNAMIC_TRACK]
SESSION_START=96
RANDOMNESS=1
LAP_GAIN=10
SESSION_TRANSFER=90

[SESSION_0]
NAME={mode_name}
TYPE={mode_type}
DURATION_MINUTES=0
SPAWN_SET=PIT

[CAR_0]
MODEL={car}
SKIN={skin}
DRIVER_NAME=AC Remote Driver
NATIONALITY=
NATION_CODE=
"""
        with open(race_ini_path, "w", encoding="utf-8") as f:
            f.write(initial_content)
        return True

    # 2. Ler linhas existentes e atualizar apenas as chaves necessárias preservando o resto
    with open(race_ini_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    updated_lines = []
    current_section = None
    applied_keys = {sec: set() for sec in updates}

    for line in lines:
        stripped = line.strip()
        # Verificar se é cabeçalho de secção
        if stripped.startswith("[") and stripped.endswith("]"):
            # Se tínhamos chaves por aplicar na secção anterior, insere-as antes de mudar de secção
            if current_section and current_section in updates:
                for k, v in updates[current_section].items():
                    if k not in applied_keys[current_section]:
                        updated_lines.append(f"{k}={v}\n")
                        applied_keys[current_section].add(k)
            
            current_section = stripped[1:-1].strip().upper()
            updated_lines.append(line)
            continue

        if current_section and current_section in updates and "=" in line:
            key_part = line.split("=", 1)[0].strip()
            key_upper = key_part.upper()
            if key_upper in updates[current_section]:
                val = updates[current_section][key_upper]
                updated_lines.append(f"{key_upper}={val}\n")
                applied_keys[current_section].add(key_upper)
                continue

        updated_lines.append(line)

    # Chaves pendentes da última secção
    if current_section and current_section in updates:
        for k, v in updates[current_section].items():
            if k not in applied_keys[current_section]:
                updated_lines.append(f"{k}={v}\n")
                applied_keys[current_section].add(k)

    # Se alguma secção inteira não existia no ficheiro original, acrescenta-a
    for sec, keys in updates.items():
        if not any(k in applied_keys[sec] for k in keys):
            updated_lines.append(f"\n[{sec}]\n")
            for k, v in keys.items():
                updated_lines.append(f"{k}={v}\n")

    with open(race_ini_path, "w", encoding="utf-8") as f:
        f.writelines(updated_lines)

    return True

# ----------------- ROTAS DE LANÇAMENTO E CONTROLO DE JOGO -----------------

@app.route('/api/launch', methods=['POST'])
def launch_race():
    payload = request.json or {}
    car = payload.get("car_id") or payload.get("car") or "ks_ferrari_488_gt3"
    skin = payload.get("skin_id") or payload.get("skin") or "default"
    track = payload.get("track_id") or payload.get("track") or "spa"
    layout = payload.get("track_layout") or payload.get("layout") or ""
    mode = (payload.get("mode") or "practice").lower()
    start_game = payload.get("start_game", True)

    # Cálculo do sun_angle
    if "sun_angle" in payload and payload["sun_angle"] is not None:
        try:
            sun_angle = float(payload["sun_angle"])
        except Exception:
            sun_angle = 16.0
    else:
        time_str = payload.get("time", "14:00")
        sun_angle = hour_to_sun_angle(time_str)

    mode_map = {
        "practice": ("Practice", 1),
        "trackday": ("Practice", 1),
        "race": ("Quick Race", 2),
        "drift": ("Drift", 3),
        "hotlap": ("Hotlap", 4)
    }
    session_name, session_type = mode_map.get(mode, ("Practice", 1))

    _, race_ini_path = get_resolved_paths()
    ac_path, _ = get_resolved_paths()

    # Se o jogo já estiver a correr, fecha-o primeiro com segurança
    was_running = is_game_running()
    if was_running:
        print("[AC REMOTE] O jogo já estava a correr. A encerrar sessão anterior...")
        kill_game_process()
        time.sleep(1.0)

    # Atualização precisa e segura do race.ini mantendo maiúsculas exigidas pelo Assetto Corsa
    ini_updates = {
        "RACE": {
            "MODEL": car,
            "MODEL_CONFIG": "",
            "SKIN": skin,
            "TRACK": track,
            "CONFIG_TRACK": layout
        },
        "CAR_0": {
            "MODEL": car,
            "SKIN": skin
        },
        "SESSION_0": {
            "NAME": session_name,
            "TYPE": str(session_type)
        },
        "LIGHTING": {
            "SUN_ANGLE": str(sun_angle)
        }
    }

    write_success = False
    try:
        write_success = update_race_ini_file(race_ini_path, ini_updates)
        print(f"[AC REMOTE] race.ini atualizado com sucesso em {race_ini_path} (backup .bak guardado).")
    except Exception as e:
        print(f"[ERRO] Falha ao atualizar race.ini: {e}")

    # Iniciar executável
    game_started = False
    game_msg = ""
    if start_game and write_success:
        acs_exe = ac_path / "acs.exe"
        acs_x86 = ac_path / "acs_x86.exe"
        cm_exe = ac_path / "Content Manager.exe"

        target_exe = None
        if acs_exe.exists():
            target_exe = acs_exe
        elif acs_x86.exists():
            target_exe = acs_x86

        if target_exe:
            try:
                subprocess.Popen([str(target_exe)], cwd=str(ac_path), shell=False)
                game_started = True
                game_msg = f"Jogo iniciado diretamente via {target_exe.name}!"
            except Exception as e:
                game_msg = f"Falha ao executar {target_exe.name}: {e}"
        elif cm_exe.exists():
            try:
                subprocess.Popen([str(cm_exe)], cwd=str(ac_path), shell=False)
                game_started = True
                game_msg = "Content Manager iniciado para correr a sessão configurada!"
            except Exception as e:
                game_msg = f"Falha ao abrir Content Manager: {e}"
        else:
            try:
                os.startfile("steam://rungameid/244210")
                game_started = True
                game_msg = "Comando enviado para o Assetto Corsa via Steam!"
            except Exception:
                game_msg = "race.ini e cópia .bak gravados com sucesso! Inicia o jogo no PC para entrar diretamente na corrida."

    return jsonify({
        "success": write_success,
        "ini_path": str(race_ini_path),
        "backup_created": (race_ini_path.parent / (race_ini_path.name + ".bak")).exists(),
        "was_running_restarted": was_running,
        "game_started": game_started,
        "message": game_msg or "Configuração de corrida gravada no race.ini com sucesso!",
        "details": {
            "car": car,
            "skin": skin,
            "track": track,
            "layout": layout,
            "mode": session_name,
            "sun_angle": sun_angle
        }
    })

@app.route('/api/kill_game', methods=['POST'])
def kill_game():
    """Botão de emergência para encerrar a corrida e sair para o desktop."""
    was_running = is_game_running()
    killed = kill_game_process()
    time.sleep(0.5)
    
    return jsonify({
        "success": True,
        "was_running": was_running,
        "message": "Corrida encerrada no PC com sucesso! A regressar ao Desktop." if (was_running or killed) else "O Assetto Corsa não estava em execução."
    })

@app.route('/api/join_server', methods=['POST'])
def join_server():
    """Abre o Content Manager automaticamente através do link acmanager://."""
    payload = request.json or {}
    url = payload.get("url", "")
    server_id = payload.get("server_id", "")

    if not url and server_id:
        cfg = load_config()
        for s in cfg.get("favorite_servers", []):
            if s.get("id") == server_id:
                url = s.get("url") or s.get("cm_link") or ""
                break

    if not url:
        return jsonify({"success": False, "message": "Nenhum link ou servidor fornecido."}), 400

    # Normalizar link para garantir que o Content Manager o abra pelo protocolo
    clean_url = url.strip()
    
    # Se for link https do acstuff, tentar converter para acmanager:// se preferido, ou abrir direto
    if clean_url.startswith("https://acstuff.ru/s/q:race/online/join?"):
        query = clean_url.split("?", 1)[1]
        acmanager_proto = f"acmanager://race/online/join?{query}"
    elif clean_url.startswith("acmanager://"):
        acmanager_proto = clean_url
    else:
        acmanager_proto = clean_url

    try:
        if sys.platform == 'win32':
            os.startfile(acmanager_proto)
        else:
            subprocess.Popen(['xdg-open', acmanager_proto])
            
        return jsonify({
            "success": True,
            "message": "A abrir servidor no Content Manager no PC...",
            "url": acmanager_proto
        })
    except Exception as e:
        # Fallback tentando abrir o link web caso o protocolo não esteja associado
        try:
            if sys.platform == 'win32':
                os.startfile(clean_url)
            return jsonify({
                "success": True,
                "message": "A abrir link do servidor no PC...",
                "url": clean_url
            })
        except Exception as e2:
            return jsonify({
                "success": False,
                "message": f"Erro ao invocar Content Manager: {e2}"
            }), 500

@app.route('/api/action', methods=['POST'])
def trigger_in_game_action():
    """
    Controlos em Pista: executa ações dentro do Assetto Corsa e controlos de sistema.
    Suporta:
    - drive: Simula clique no volante (Drive) no canto superior esquerdo (48, 48) e prime Enter para sair dos boxes sem rato
    - teleport_pits: Pressiona ESC para regressar aos boxes / abrir menu de teleport
    - restart_session: Atalho nativo Ctrl+R para reiniciar a corrida/sessao
    - camera_f1: F1 (Cockpit / Capô / Perseguição)
    - camera_f6: F6 (Câmaras de TV / Pista / Espetador)
    - change_camera: Alterna câmara F1 (ou tecla fornecida)
    - lights: Tecla L (Ligar/desligar faróis)
    - wipers: Alt+W (Ligar/desligar limpa-para-brisas no CSP RainFX)
    - volume_up: Aumenta o volume do Windows (+10%)
    - volume_down: Baixa o volume do Windows (-10%)
    - volume_mute: Ativa/desativa Mute no Windows
    """
    payload = request.json or {}
    action = payload.get("action", "").lower().strip()

    if not action:
        return jsonify({"success": False, "message": "Nenhuma ação especificada."}), 400

    print(f"[AC REMOTE] Ação em pista acionada: {action}")

    # Volume do Windows (global, não precisa de foco na janela do jogo)
    if action in ['volume_up', 'volume_down', 'volume_mute']:
        if sys.platform == 'win32':
            import ctypes
            if action == 'volume_up':
                VK_VOLUME_UP = 0xAF
                for _ in range(5):
                    ctypes.windll.user32.keybd_event(VK_VOLUME_UP, 0, 0, 0)
                    ctypes.windll.user32.keybd_event(VK_VOLUME_UP, 0, 2, 0)
                return jsonify({"success": True, "action": action, "message": "Volume aumentado (+10%)"})
            elif action == 'volume_down':
                VK_VOLUME_DOWN = 0xAE
                for _ in range(5):
                    ctypes.windll.user32.keybd_event(VK_VOLUME_DOWN, 0, 0, 0)
                    ctypes.windll.user32.keybd_event(VK_VOLUME_DOWN, 0, 2, 0)
                return jsonify({"success": True, "action": action, "message": "Volume reduzido (-10%)"})
            elif action == 'volume_mute':
                VK_VOLUME_MUTE = 0xAD
                ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 0, 0)
                ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 2, 0)
                return jsonify({"success": True, "action": action, "message": "Volume silenciado / restaurado (Mute)"})
        return jsonify({"success": True, "action": action, "message": "Volume simulado (sistema não-Windows)"})

    # Ações dentro do simulador: focar janela do AC
    focus_game_window()

    try:
        if action in ['drive', 'iniciar_conducao']:
            # Simula clique no botão de volante no canto superior esquerdo e Enter
            if pydirectinput:
                pydirectinput.click(48, 48)
                time.sleep(0.06)
                pydirectinput.press('enter')
            elif keyboard:
                keyboard.send('enter')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Iniciar Condução: clique nos boxes e Enter executados!"
            })

        elif action in ['teleport_pits', 'pits', 'boxes']:
            # No AC, a tecla ESC abre o menu de boxes / teleport
            if pydirectinput:
                pydirectinput.press('esc')
            elif keyboard:
                keyboard.send('esc')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Voltar aos Boxes / Teleport executado (ESC)!"
            })

        elif action in ['restart_session', 'restart']:
            # Ctrl+R no AC reinicia a sessão de corrida imediatamente
            if pydirectinput:
                pydirectinput.keyDown('ctrl')
                time.sleep(0.05)
                pydirectinput.press('r')
                time.sleep(0.05)
                pydirectinput.keyUp('ctrl')
            elif keyboard:
                keyboard.send('ctrl+r')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Sessão reiniciada (Ctrl + R)!"
            })

        elif action in ['camera_f1', 'cam_f1']:
            if pydirectinput:
                pydirectinput.press('f1')
            elif keyboard:
                keyboard.send('f1')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Câmara alterada (F1 - Cockpit / On-board)!"
            })

        elif action in ['camera_f6', 'cam_f6']:
            if pydirectinput:
                pydirectinput.press('f6')
            elif keyboard:
                keyboard.send('f6')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Câmara alterada (F6 - TV / Pista)!"
            })

        elif action in ['change_camera', 'cam_toggle']:
            cam_key = payload.get('key', 'f1').lower()
            if pydirectinput:
                pydirectinput.press(cam_key)
            elif keyboard:
                keyboard.send(cam_key)
            return jsonify({
                "success": True,
                "action": action,
                "message": f"Câmara alterada ({cam_key.upper()})!"
            })

        elif action in ['lights', 'farois']:
            if pydirectinput:
                pydirectinput.press('l')
            elif keyboard:
                keyboard.send('l')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Faróis alternados (Tecla L)!"
            })

        elif action in ['wipers', 'limpa_vidros']:
            # CSP RainFX wiper toggle = Alt + W
            if pydirectinput:
                pydirectinput.keyDown('alt')
                time.sleep(0.05)
                pydirectinput.press('w')
                time.sleep(0.05)
                pydirectinput.keyUp('alt')
            elif keyboard:
                keyboard.send('alt+w')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Limpa-para-brisas alternado (Alt + W)!"
            })

        elif action in ['esc', 'pause']:
            if pydirectinput:
                pydirectinput.press('esc')
            elif keyboard:
                keyboard.send('esc')
            return jsonify({
                "success": True,
                "action": action,
                "message": "Tecla ESC executada!"
            })

        else:
            return jsonify({"success": False, "message": f"Ação desconhecida: {action}"}), 400

    except Exception as e:
        print(f"[ERRO ACTION] {e}")
        return jsonify({"success": False, "message": f"Erro ao executar ação: {e}"}), 500


# ----------------- INICIALIZAÇÃO -----------------

if __name__ == '__main__':
    # Configurar UTF-8 seguro no terminal Windows
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    # Manter o PC sempre ligado (evita suspensão enquanto a app corre)
    prevent_pc_sleep()

    local_ip = get_local_ip()
    port = 5000
    
    print("\n" + "="*56)
    print("      A C   R E M O T E   -   A S S E T T O   C O R S A  ")
    print("="*56)
    print("  Servidor ativo e pronto a comunicar com o teu iPhone!")
    print("  [+] MODO KEEP-AWAKE ATIVADO: PC sempre acordado!")
    print("")
    print("  Abre no Safari do teu iPhone:")
    print(f"     👉  http://{local_ip}:{port}")
    print("")
    print("  Vercel: Tambem podes usar via Vercel configurando")
    print(f"     este IP nas Definicoes da tua app na Vercel.")
    print("="*56 + "\n")

    app.run(host='0.0.0.0', port=port, debug=False)
