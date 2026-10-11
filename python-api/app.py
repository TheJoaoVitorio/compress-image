"""API Flask para conversão/compressão de imagens (porta 8001)."""
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

from converter import FORMATOS, converter

PASTA_FRONT = Path(__file__).resolve().parent.parent / "frontend"
app = Flask(__name__, static_folder=None)


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    resp.headers["Access-Control-Expose-Headers"] = "X-Original-Size, X-New-Size, X-Engine"
    return resp


@app.route("/api/convert", methods=["POST", "OPTIONS"])
def convert():
    if request.method == "OPTIONS":
        return "", 204
    arquivo = request.files.get("file")
    formato = request.form.get("format", "webp").lower()
    modo = request.form.get("mode", "lossless")
    qualidade = int(request.form.get("quality", 90))
    if not arquivo:
        return jsonify(error="Arquivo não enviado"), 400
    dados = arquivo.read()
    try:
        saida, mime = converter(dados, formato, modo, qualidade)
    except Exception as e:  # formato/arquivo inválido ou sem suporte no Pillow
        return jsonify(error=str(e)), 422
    resp = Response(saida, mimetype=mime)
    resp.headers["X-Original-Size"] = str(len(dados))
    resp.headers["X-New-Size"] = str(len(saida))
    resp.headers["X-Engine"] = "Python (Pillow)"
    return resp


@app.get("/api/formats")
def formats():
    return jsonify(list(FORMATOS))


@app.get("/")
def index():
    return send_from_directory(PASTA_FRONT, "index.html")


@app.get("/<path:nome>")
def estaticos(nome):
    return send_from_directory(PASTA_FRONT, nome)


if __name__ == "__main__":
    app.run(port=8001, debug=False)
