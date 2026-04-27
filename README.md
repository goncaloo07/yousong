# YouSong

**[Português](#português) | [English](#english)**

---

<a name="português"></a>
## Português

YouSong é uma aplicação web pessoal para gerir e reproduzir músicas MP3, construída com Flask. Inclui autenticação de utilizadores, leitor de áudio integrado e suporte a metadados ID3.

### Funcionalidades

- Registo e login de utilizadores
- Upload de ficheiros MP3 por drag-and-drop ou seleção (até 50 MB por ficheiro)
- Leitor de música com controlos de reprodução, anterior e próximo
- Extração automática de capa, título e artista a partir das tags ID3
- Edição de metadados diretamente na interface
- Tema claro/escuro
- API REST em `/api/musicas`

### Tecnologias

- **Backend:** Python, Flask, Flask-Login
- **Base de dados:** PostgreSQL
- **Áudio:** Mutagen
- **Servidor:** Gunicorn

### Instalação

```bash
git clone https://github.com/teu-utilizador/yousong.git
cd yousong
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://utilizador:password@localhost:5432/yousong"
python app.py
```

A aplicação fica disponível em `http://localhost:5000`.

### Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | URL de ligação PostgreSQL | Sim |
| `FLASK_DEBUG` | Modo debug (`1` ou `0`) | Não |

### Deploy

O projeto inclui um `Procfile` compatível com Heroku e Railway:

```
web: gunicorn app:app
```

---

<a name="english"></a>
## English

YouSong is a personal web application for managing and playing MP3 files, built with Flask. It includes user authentication, a built-in audio player and ID3 metadata support.

### Features

- User registration and login
- MP3 upload via drag-and-drop or file picker (up to 50 MB per file)
- Music player with play/pause, previous and next controls
- Automatic extraction of cover art, title and artist from ID3 tags
- In-place metadata editing
- Light/dark theme
- REST API at `/api/musicas`

### Tech Stack

- **Backend:** Python, Flask, Flask-Login
- **Database:** PostgreSQL
- **Audio:** Mutagen
- **Server:** Gunicorn

### Setup

```bash
git clone https://github.com/your-username/yousong.git
cd yousong
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://user:password@localhost:5432/yousong"
python app.py
```

The app will be available at `http://localhost:5000`.

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URL | Yes |
| `FLASK_DEBUG` | Enable debug mode (`1` or `0`) | No |

### Deployment

The project includes a `Procfile` compatible with Heroku and Railway:

```
web: gunicorn app:app
```
