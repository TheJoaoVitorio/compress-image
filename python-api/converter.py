"""Núcleo de conversão/compressão de imagens usando Pillow.

Estratégias:
- lossless: nenhum pixel é alterado (PNG otimizado, WebP/AVIF lossless).
- lossy: usa o parâmetro `quality` (0-100). JPEG não possui modo lossless real.
"""
from io import BytesIO

from PIL import Image

FORMATOS = {
    "png": ("PNG", "image/png"),
    "webp": ("WEBP", "image/webp"),
    "jpeg": ("JPEG", "image/jpeg"),
    "avif": ("AVIF", "image/avif"),
}


def converter(dados: bytes, formato: str, modo: str = "lossless", qualidade: int = 90):
    """Converte `dados` para `formato`. Retorna (bytes, mimetype)."""
    if formato not in FORMATOS:
        raise ValueError(f"Formato não suportado: {formato}")

    nome_pillow, mime = FORMATOS[formato]
    sem_perdas = modo == "lossless"
    img = Image.open(BytesIO(dados))
    img.load()

    # Preserva a orientação EXIF antes de descartar metadados.
    from PIL import ImageOps
    img = ImageOps.exif_transpose(img)

    # JPEG não suporta transparência: achata sobre fundo branco.
    if nome_pillow == "JPEG":
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            fundo = Image.new("RGB", img.size, (255, 255, 255))
            fundo.paste(img, mask=img.split()[-1])
            img = fundo
        else:
            img = img.convert("RGB")
    elif img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
        img = img.convert("RGBA")

    saida = BytesIO()
    opcoes = {}

    if nome_pillow == "PNG":
        # PNG é sempre sem perdas; optimize + compress_level 9 reduz o tamanho.
        opcoes = {"optimize": True, "compress_level": 9}
    elif nome_pillow == "WEBP":
        if sem_perdas:
            opcoes = {"lossless": True, "quality": 100, "method": 6}
        else:
            opcoes = {"quality": qualidade, "method": 6}
    elif nome_pillow == "JPEG":
        # Sem modo lossless: no modo "lossless" usamos qualidade 95 sem subsampling.
        q = 95 if sem_perdas else qualidade
        opcoes = {"quality": q, "optimize": True, "progressive": True,
                  "subsampling": 0 if sem_perdas else -1}
    elif nome_pillow == "AVIF":
        opcoes = {"quality": 100 if sem_perdas else qualidade, "speed": 6}
        if sem_perdas:
            opcoes["lossless"] = True

    img.save(saida, format=nome_pillow, **opcoes)
    return saida.getvalue(), mime
