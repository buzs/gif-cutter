import './style.css'

import { GIFEncoder, quantize, applyPalette } from 'https://unpkg.com/gifenc';

document.getElementById('processGIF').addEventListener('click', () => {
  processGIF()
})
document.getElementById('executeRender').addEventListener('click', () => {
  executeRender()
})


let generatedGIFs = [];
let gifs;

let combinedFrames = [];
const spacing = 10;


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
  console.log("GIF Original:", gif.width, gif.height);
  console.log("Partições:", rows, columns);
  console.log("Dimensões de cada parte:", partWidth, partHeight);

  gifs = Array.from({ length: columns * rows }, () =>
    GIFEncoder({
      initialCapacity: 20480,
    })
  );

  combinedFrames = Array.from({ length: gif.numFrames() }, () => []);

  // Para cada posição da divisão, criaremos um novo GIF separado
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const gifPart = gifs[r * columns + c];

      console.log(gifPart);

      // Para cada quadro do GIF original, recorta a parte e adiciona ao novo GIF
      for (let i = 0; i < gif.numFrames(); i++) {
        const frameInfo = gif.frameInfo(i);
        const delay = frameInfo.delay * 10; // Converter para milissegundos

        const frameImageData = new Uint8ClampedArray(
          gif.width * gif.height * 4
        );
        gif.decodeAndBlitFrameRGBA(i, frameImageData);

        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = gif.width;
        frameCanvas.height = gif.height;
        const ctx = frameCanvas.getContext("2d");
        const imgData = new ImageData(frameImageData, gif.width, gif.height);
        ctx.putImageData(imgData, 0, 0);

        const partCanvas = document.createElement("canvas");
        partCanvas.width = partWidth;
        partCanvas.height = partHeight;
        const partCtx = partCanvas.getContext("2d");

        // Verifica se o contexto foi obtido corretamente
        if (!partCtx) {
          console.error("Erro ao obter o contexto 2d para partCanvas.");
          continue;
        }

        // Log das coordenadas de recorte e tamanho do quadro
        console.log(
          `Desenhando quadro ${i} na posição [${r},${c}] com coordenadas e tamanho:`,
          c * partWidth,
          r * partHeight,
          partWidth,
          partHeight
        );

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

        // Adiciona o canvas da parte ao HTML para visualização
        /*             const container = document.getElementById('gifContainer');
        const partImage = document.createElement('img');
        partImage.src = partCanvas.toDataURL(); // Convertendo o canvas para uma imagem
        container.appendChild(partImage); */

        const {
          data,
          width: w,
          height: h,
        } = partCtx.getImageData(0, 0, partWidth, partHeight);

        // If necessary, quantize your colors to a reduced palette
        const palette = quantize(data, 256);

        // console.log("Palette ok");

        // // Apply palette to RGBA data to get an indexed bitmap
        const index = applyPalette(data, palette);

        // Adiciona o quadro recortado ao novo GIF
        gifPart.writeFrame(index, w, h, { delay, palette });

        console.log("Foi");

        await new Promise((resolve) => setTimeout(resolve, 0));

        combinedFrames[i][r * columns + c] = partCanvas.toDataURL();
      }

      gifPart.finish();

      const output = gifPart.bytes();

      console.log("Foi 2", output);

      // const container = document.getElementById("gifContainer");
      // const partImage = document.createElement("img");
      // partImage.src = URL.createObjectURL(new Blob([output], { type: 'image/gif' }));
      // container.appendChild(partImage);

      generatedGIFs.push(URL.createObjectURL(new Blob([output], { type: 'image/gif' })));

      download(output, `part_${r * columns + c}.gif`, { type: 'image/gif' });
    }
  }
}

function download(buf, filename, type) {
  const blob = buf instanceof Blob ? buf : new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
};


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
    imgElement.src = gifData;
    imgElement.alt = `GIF Part ${index + 1}`;
    imgElement.style.width = "100%"; // Ajusta a largura para caber na coluna

    output.appendChild(imgElement); // Adiciona a imagem ao contêiner
  });
}

async function downloadAll() {
  const zip = new JSZip();

  generatedGIFs.forEach((blob, index) => {
    zip.file(`gif_part_${index + 1}.gif`, blob);
  });

  const zipContent = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(zipContent);
  link.download = "gif_parts.zip";
  link.click();
}
