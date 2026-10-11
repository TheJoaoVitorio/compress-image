import sharp from "sharp";

export type Formato = "png" | "webp" | "jpeg" | "avif";
export type Modo = "lossless" | "lossy";

export const FORMATOS: Record<Formato, string> = {
  png: "image/png",
  webp: "image/webp",
  jpeg: "image/jpeg",
  avif: "image/avif",
};

/**
 * Converte/comprime uma imagem com sharp (libvips).
 * - lossless: nenhum pixel é alterado (PNG otimizado, WebP/AVIF lossless).
 * - lossy: usa `qualidade` (1-100). JPEG não possui modo lossless real.
 */
export async function converter(
  dados: Buffer,
  formato: Formato,
  modo: Modo = "lossless",
  qualidade = 90,
): Promise<{ buffer: Buffer; mime: string }> {
  if (!(formato in FORMATOS)) throw new Error(`Formato não suportado: ${formato}`);

  const semPerdas = modo === "lossless";
  // .rotate() aplica a orientação EXIF antes de os metadados serem descartados.
  let img = sharp(dados).rotate();

  switch (formato) {
    case "png":
      // PNG é sempre sem perdas; nível 9 + effort alto reduzem o tamanho.
      img = img.png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true });
      break;
    case "webp":
      img = img.webp(
        semPerdas
          ? { lossless: true, effort: 6 }
          : { quality: qualidade, effort: 6 },
      );
      break;
    case "jpeg":
      // JPEG não suporta transparência: achata sobre fundo branco.
      img = img
        .flatten({ background: "#ffffff" })
        .jpeg({
          quality: semPerdas ? 95 : qualidade,
          mozjpeg: true,
          chromaSubsampling: semPerdas ? "4:4:4" : "4:2:0",
        });
      break;
    case "avif":
      img = img.avif(
        semPerdas
          ? { lossless: true, effort: 4 }
          : { quality: qualidade, effort: 4 },
      );
      break;
  }

  return { buffer: await img.toBuffer(), mime: FORMATOS[formato] };
}
