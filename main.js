import './style.css'

import { GIFEncoder, quantize, applyPalette } from 'https://unpkg.com/gifenc';
import 'https://unpkg.com/@zip.js/zip.js@2.7.23/dist/zip.min.js';

document.getElementById('processGIF').addEventListener('click', () => {
  processGIF()
})
document.getElementById('executeRender').addEventListener('click', () => {
  executeRender()
})
document.getElementById('downloadAll').addEventListener('click', () => {
  downloadAll()
})

let generatedGIFs = [];
let gifs;
const spacing = 10;
const DEBUG = false;

async function processGIF() {
  const file = document.getElementById("gifInput").files[0];
  const rows = parseInt(document.getElementById("rows").value, 10) || 1;
  const columns = parseInt(document.getElementById("columns").value, 10) || 1;

  const arrayBuffer = await file.arrayBuffer();
  const gifData = new Uint8Array(arrayBuffer);

  const gif = new GifReader(gifData);

  const partWidth = Math.floor(gif.width / columns);
  const partHeight = Math.floor(gif.height / rows);

  // Garantir que as dimensões das partes sejam válidas
  if (partWidth <= 0 || partHeight <= 0) {
    console.error("Dimensões inválidas para as partes do GIF.");
    return;
  }

  // Log das dimensões
  if (DEBUG) {
    console.log("GIF Original:", gif.width, gif.height);
    console.log("Partições:", rows, columns);
    console.log("Dimensões de cada parte:", partWidth, partHeight);
  }

  gifs = Array.from({ length: columns * rows }, () =>
    GIFEncoder({
      initialCapacity: 20480,
    })
  );

  // Para cada posição da divisão, criaremos um novo GIF separado
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const gifPart = gifs[r * columns + c];

      // Para cada quadro do GIF original, recorta a parte e adiciona ao novo GIF
      for (let i = 0; i < gif.numFrames(); i++) {
        const frameInfo = gif.frameInfo(i);
        const delay = frameInfo.delay * 10; // Converter para milissegundos

        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = gif.width;
        frameCanvas.height = gif.height;
        const ctx = frameCanvas.getContext("2d");

        const frameImageData = ctx.getImageData(0, 0, gif.width, gif.height);
        gif.decodeAndBlitFrameRGBA(i, frameImageData.data);
        ctx.putImageData(frameImageData, 0, 0);

        const partCanvas = document.createElement("canvas");
        partCanvas.width = partWidth;
        partCanvas.height = partHeight;
        const partCtx = partCanvas.getContext("2d");

        // Verifica se o contexto foi obtido corretamente
        if (!partCtx) {
          console.error("Erro ao obter o contexto 2d para partCanvas.");
          continue;
        }

        if (DEBUG) {
          // Log das coordenadas de recorte e tamanho do quadro
          console.log(
            `Desenhando quadro ${i} na posição [${r},${c}] com coordenadas e tamanho:`,
            c * partWidth,
            r * partHeight,
            partWidth,
            partHeight
          );
        }

        // Desenha a parte específica do quadro, verificando coordenadas válidas
        partCtx.drawImage(
          frameCanvas,
          c * partWidth,
          r * partHeight,
          partWidth,
          partHeight,
          0,
          0,
          partWidth,
          partHeight
        );

        partCtx.save();
        partCtx.restore();

        const {
          data,
          width: w,
          height: h,
        } = partCtx.getImageData(0, 0, partWidth, partHeight);

        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gifPart.writeFrame(index, w, h, { delay, palette });

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      gifPart.finish();
      const output = gifPart.bytes();

      generatedGIFs.push(new Blob([output], { type: 'image/gif' }));
    }
  }

  console.log("GIFs gerados:", generatedGIFs.length);

  // Exibe o botão de download
  // document.getElementById("downloadButton").style.display = "block";
  executeRender();
}


async function executeRender() {
  // Limpa a área de saída antes de renderizar
  const output = document.getElementById("gifContainer");
  output.innerHTML = "";

  const rows = parseInt(document.getElementById("rows").value, 10) || 1;
  const columns = parseInt(document.getElementById("columns").value, 10) || 1;

  // Estilo do contêiner para layout em grade
  output.style.display = "grid";
  output.style.gridTemplateColumns = `repeat(${columns}, auto)`;
  output.style.gap = "5px"; // Espaçamento entre as imagens

  // Adiciona os GIFs como imagens <img> diretamente no contêiner
  generatedGIFs.forEach((gifData, index) => {
    const imgElement = document.createElement("img");
    imgElement.src = URL.createObjectURL(gifData);
    imgElement.alt = `GIF Part ${index + 1}`;
    imgElement.style.width = "100%"; // Ajusta a largura para caber na coluna

    output.appendChild(imgElement); // Adiciona a imagem ao contêiner
  });
}

async function downloadAll() {
  const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

  generatedGIFs.forEach(async (blob, index) => {
    await zipWriter.add(`part_${index + 1}.gif`, new zip.BlobReader(blob));
  });

  const zipBlob = await zipWriter.close();

  const zipUrl = URL.createObjectURL(zipBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = zipUrl;
  downloadLink.download = "generated_gifs.zip";
  downloadLink.click();

  // Limpa o objeto URL para liberar a memória
  URL.revokeObjectURL(zipUrl);
}
