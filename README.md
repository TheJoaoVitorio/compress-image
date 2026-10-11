# Compressor de Imagens: Python × TypeScript

Projeto para comparar **a mesma rotina de compressão/conversão de imagens** em duas linguagens, com um frontend em estilo Google/Antigravity Light.

| Motor | Lib | Código | Porta |
|---|---|---|---|
| Python | Pillow | [`python-api/converter.py`](python-api/converter.py) | 8001 |
| TypeScript | sharp (libvips) | [`ts-api/src/converter.ts`](ts-api/src/converter.ts) | 8002 |

Ambos expõem `POST /api/convert` (multipart: `file`, `format` = png|webp|jpeg|avif, `mode` = lossless|lossy, `quality`) e respondem com a imagem + headers `X-Original-Size` / `X-New-Size`.

## Como rodar

```bash
# Python
cd python-api && pip install -r requirements.txt && python app.py   # http://localhost:8001

# TypeScript (outro terminal)
cd ts-api && npm install && npm start                               # http://localhost:8002
```

Abra `http://localhost:8001` ou `http://localhost:8002`. O frontend alterna entre os motores no topo.

## Compressão sem perda de qualidade

- **PNG**: sempre sem perdas. Ganho vem de recompressão (`optimize`/`compress_level 9` no Pillow, `compressionLevel 9` + `effort 10` no sharp).
- **WebP / AVIF lossless**: pixels idênticos ao original, normalmente bem menores que PNG.
- **JPEG**: não existe JPEG lossless prático; o modo "sem perdas" usa qualidade 95 sem subamostragem de cor (praticamente imperceptível).
- **Com perdas**: usa o controle de qualidade para tamanhos menores.
