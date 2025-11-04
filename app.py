import os
import uuid
import urllib.parse
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify, flash, abort
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, TIT2, TPE1, APIC, error as ID3Error
import psycopg2

# Database connection
def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'], sslmode='require')

# Initialize DB
conn = get_db_connection()
cur = conn.cursor()
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL
);
""")
conn.commit()
cur.close()
conn.close()

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth'

class User(UserMixin):
    def __init__(self, id, username):
        self.id = id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if user:
        return User(user[0], user[1])
    return None

# Configurações
UPLOAD_FOLDER = os.path.join(app.root_path, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"mp3"}
app.config.update(
    UPLOAD_FOLDER=UPLOAD_FOLDER,
    MAX_CONTENT_LENGTH=50 * 1024 * 1024,  # Limite 50 MB
)
DEFAULT_COVER = "img/default_cover.png"


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_mp3_info(filepath):
    """Extrai título, artista e capa."""
    from re import sub

    def strip_uuid_prefix(name):
        base = os.path.basename(name)
        parts = base.split("_", 1)
        if len(parts) == 2 and len(parts[0]) == 32 and all(c in "0123456789abcdef" for c in parts[0].lower()):
            return parts[1]
        return base

    title, artist = "Sem título", "Desconhecido"
    cover = DEFAULT_COVER

    try:
        audio = MP3(filepath, ID3=ID3)
        if audio.tags:
            tags = audio.tags
            # Default para nome do arquivo sem prefixo UUID caso não haja tag
            default_title = os.path.splitext(strip_uuid_prefix(filepath))[0]
            title = tags.get('TIT2', None).text[0] if tags.get('TIT2', None) else default_title
            artist = tags.get('TPE1', None).text[0] if tags.get('TPE1', None) else "Desconhecido"

            # Extrair capa (APIC) apenas uma vez por arquivo
            apic_tags = tags.getall("APIC") if hasattr(tags, 'getall') else []
            if apic_tags:
                apic = apic_tags[0]
                mime = getattr(apic, "mime", "image/jpeg") or "image/jpeg"
                ext = "jpg"
                if "png" in mime:
                    ext = "png"
                elif "jpeg" in mime or "jpg" in mime:
                    ext = "jpg"
                base = os.path.splitext(os.path.basename(filepath))[0]
                cover_filename = f"{base}.cover.{ext}"
                cover_path = os.path.join(app.config["UPLOAD_FOLDER"], cover_filename)
                if not os.path.exists(cover_path):
                    try:
                        with open(cover_path, "wb") as img:
                            img.write(apic.data)
                    except Exception as _e:
                        print(f"[Erro salvando capa] {_e}")
                if os.path.exists(cover_path):
                    cover = f"uploads/{cover_filename}"
    except Exception as e:
        print(f"[Erro ao ler tags MP3] {e}")

    title = sub(r"[^a-zA-Z0-9À-ÿ\s\.\-]", "", title).strip() or "Sem título"
    if title.lower().endswith('.mp3'):
        title = title[:-4].strip()
    return title, artist, cover


@app.route("/auth", methods=["GET", "POST"])
def auth():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == "POST":
        action = request.form.get('action')
        username = request.form.get('username')
        password = request.form.get('password')
        if not username or not password:
            flash("Username e password são obrigatórios.", "error")
            return redirect(url_for('auth'))
        conn = get_db_connection()
        cur = conn.cursor()
        if action == 'register':
            try:
                cur.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                            (username, generate_password_hash(password)))
                conn.commit()
                flash("Registo bem-sucedido! Faça login.", "success")
                return redirect(url_for('auth'))
            except psycopg2.IntegrityError:
                flash("Username já existe.", "error")
            finally:
                cur.close()
                conn.close()
        elif action == 'login':
            cur.execute("SELECT id, password_hash FROM users WHERE username = %s", (username,))
            user = cur.fetchone()
            cur.close()
            conn.close()
            if user and check_password_hash(user[1], password):
                user_obj = User(user[0], username)
                login_user(user_obj)
                return redirect(url_for('index'))
            flash("Credenciais inválidas.", "error")
    return render_template("auth.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route("/", methods=["GET", "POST"])
@login_required
def index():
    """Página inicial (upload e lista). Supports multiple files upload."""
    if request.method == "POST":
        files = request.files.getlist("file")
        if not files:
            flash("Nenhum arquivo enviado.", "error")
            return redirect(url_for("index"))
        saved = []
        from mutagen.mp3 import HeaderNotFoundError
        for file in files:
            if not file or not allowed_file(file.filename):
                continue
            original = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{original}"
            temp_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
            file.save(temp_path)
            # Validação real: tenta abrir como MP3
            try:
                _ = MP3(temp_path)
                saved.append(original)
            except (HeaderNotFoundError, Exception):
                os.remove(temp_path)
                continue
        if not saved:
            flash("Nenhum arquivo válido foi enviado. Use apenas arquivos MP3 válidos.", "error")
        else:
            flash(f"{len(saved)} arquivo(s) enviados com sucesso!", "success")
        return redirect(url_for("index"))

    files_info = []
    for filename in sorted(os.listdir(app.config["UPLOAD_FOLDER"])):
        if filename.lower().endswith(".mp3"):
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            title, artist, cover = get_mp3_info(path)
            # make cover url
            if cover.startswith("uploads/"):
                cover_url = url_for("uploaded_file", filename=os.path.basename(cover))
            else:
                cover_url = url_for("static", filename=cover)
            files_info.append({
                "saved_name": filename,
                "title": title,
                "artist": artist,
                "cover": cover_url
            })

    return render_template("index.html", files=files_info)


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    """Serve apenas arquivos permitidos (MP3 ou imagens de capa) do diretório uploads."""
    filename = secure_filename(urllib.parse.unquote(filename))
    allowed_exts = {"mp3", "png", "jpg", "jpeg"}
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in allowed_exts:
        abort(403)
    # Só permite servir arquivos que realmente existem no uploads
    full_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if not os.path.isfile(full_path):
        abort(404)
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/delete/<path:filename>", methods=["POST"])
@login_required
def delete_file(filename):
    """Deleta música e capa relacionada."""
    filename = secure_filename(urllib.parse.unquote(filename))
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        finally:
            # também remove capas cacheadas associadas
            base = os.path.splitext(filename)[0]
            for ext in ("jpg", "jpeg", "png"):
                cover_candidate = os.path.join(app.config["UPLOAD_FOLDER"], f"{base}.cover.{ext}")
                try:
                    if os.path.exists(cover_candidate):
                        os.remove(cover_candidate)
                except Exception:
                    pass
        return jsonify({"success": True, "message": "Música removida com sucesso."})
    else:
        return jsonify({"success": False, "message": "Arquivo não encontrado."})


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    flash("Arquivo excede o limite máximo (50 MB).", "error")
    return redirect(url_for("index"))


@app.route("/api/musicas")
@login_required
def api_musicas():
    """Retorna lista JSON das músicas."""
    data = []
    for f in sorted(os.listdir(app.config["UPLOAD_FOLDER"])):
        if f.endswith(".mp3"):
            title, artist, cover = get_mp3_info(os.path.join(app.config["UPLOAD_FOLDER"], f))
            cover_url = url_for("uploaded_file", filename=os.path.basename(cover)) if cover.startswith("uploads/") else url_for("static", filename=cover)
            data.append({
                "file": f,
                "title": title,
                "artist": artist,
                "cover": cover_url
            })
    return jsonify(data)


@app.route("/edit_metadata", methods=["POST"])
@login_required
def edit_metadata():
    """
    Recebe FormData: file, title, artist, cover (opcional), remove_cover (opcional)
    Atualiza as tags ID3 do MP3 e salva nova capa se fornecida, ou remove capa se solicitado.
    """
    file = request.form.get("file")
    title = request.form.get("title", "").strip()
    artist = request.form.get("artist", "").strip()
    cover_file = request.files.get("cover")
    remove_cover = request.form.get("remove_cover") == "true"

    if not file or not (title or artist or cover_file or remove_cover):
        return jsonify({"error": "Parâmetros insuficientes."}), 400

    filename = secure_filename(file)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Arquivo não encontrado."}), 404

    try:
        # Load or create ID3 tags
        try:
            tags = ID3(filepath)
        except ID3Error:
            tags = ID3()

        if title:
            tags.delall("TIT2")
            tags.add(TIT2(encoding=3, text=[title]))
        if artist:
            tags.delall("TPE1")
            tags.add(TPE1(encoding=3, text=[artist]))

        # Handle cover image
        cover_url = None
        if remove_cover:
            # Remove existing cover files
            base = os.path.splitext(filename)[0]
            for ext in ("jpg", "jpeg", "png"):
                cover_candidate = os.path.join(app.config["UPLOAD_FOLDER"], f"{base}.cover.{ext}")
                try:
                    if os.path.exists(cover_candidate):
                        os.remove(cover_candidate)
                except Exception:
                    pass
            # Remove APIC from ID3
            tags.delall("APIC")
            cover_url = url_for("static", filename=DEFAULT_COVER)
        elif cover_file and cover_file.filename:
            # Validate image
            if not cover_file.content_type.startswith('image/'):
                return jsonify({"error": "Arquivo de capa deve ser uma imagem."}), 400
            # Remove existing cover files
            base = os.path.splitext(filename)[0]
            for ext in ("jpg", "jpeg", "png"):
                cover_candidate = os.path.join(app.config["UPLOAD_FOLDER"], f"{base}.cover.{ext}")
                try:
                    if os.path.exists(cover_candidate):
                        os.remove(cover_candidate)
                except Exception:
                    pass
            # Save new cover
            ext = os.path.splitext(cover_file.filename)[1].lower()
            if ext not in ['.jpg', '.jpeg', '.png']:
                ext = '.jpg'  # default
            cover_filename = f"{base}.cover{ext}"
            cover_path = os.path.join(app.config["UPLOAD_FOLDER"], cover_filename)
            cover_file.save(cover_path)
            # Add to ID3
            with open(cover_path, 'rb') as img:
                tags.delall("APIC")
                tags.add(APIC(encoding=3, mime=cover_file.content_type, type=3, desc='Cover', data=img.read()))
            cover_url = url_for("uploaded_file", filename=cover_filename)

        tags.save(filepath)
        return jsonify({"ok": True, "title": title, "artist": artist, "cover": cover_url})
    except Exception as e:
        print("Erro ao salvar tags:", e)
        return jsonify({"error": "Falha ao salvar metadados."}), 500


if __name__ == "__main__":
    # Só ativa debug se variável de ambiente FLASK_DEBUG=1
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug_mode, host="0.0.0.0", port=5000)
