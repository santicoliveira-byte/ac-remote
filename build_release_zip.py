import os
import zipfile
import shutil

ROOT_DIR = r"C:\Users\santi\Documents\REMOTE"
OUTPUT_ZIP = os.path.join(ROOT_DIR, "AC_Remote_PC.zip")

FILES_TO_INCLUDE = [
    "app.py",
    "config.json",
    "requirements.txt",
    "start_ac_remote.bat",
    "iniciar_em_segundo_plano.vbs",
    "parar_ac_remote.bat",
    "create_shortcut.bat",
    "run.bat",
    "COMO_USAR_NO_OUTRO_PC.txt",
    "README.md",
]

DIRS_TO_INCLUDE = [
    "static",
    "templates"
]

if os.path.exists(OUTPUT_ZIP):
    try:
        os.remove(OUTPUT_ZIP)
    except Exception as e:
        print(f"Warning removing old zip: {e}")

print("A criar arquivo ZIP...")
with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
    for filename in FILES_TO_INCLUDE:
        file_path = os.path.join(ROOT_DIR, filename)
        if os.path.exists(file_path):
            zipf.write(file_path, arcname=filename)
            print(f"  + Adicionado: {filename}")
        else:
            print(f"  - Aviso: {filename} nao encontrado")

    for dirname in DIRS_TO_INCLUDE:
        dir_path = os.path.join(ROOT_DIR, dirname)
        if os.path.exists(dir_path):
            for root, _, files in os.walk(dir_path):
                if "__pycache__" in root:
                    continue
                for file in files:
                    full_file = os.path.join(root, file)
                    rel_path = os.path.relpath(full_file, ROOT_DIR)
                    zipf.write(full_file, arcname=rel_path)
                    print(f"  + Adicionado: {rel_path}")

print(f"\n[SUCESSO] ZIP criado: {OUTPUT_ZIP} ({os.path.getsize(OUTPUT_ZIP):,} bytes)")
