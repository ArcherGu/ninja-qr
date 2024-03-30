const NINJA_CONTAINER_ID = 'ninja-container'
function createNinjaContainer(): HTMLDivElement {
  const existingContainer = document.getElementById(NINJA_CONTAINER_ID)
  if (existingContainer)
    return existingContainer as HTMLDivElement

  const container = document.createElement('div')
  container.id = NINJA_CONTAINER_ID
  container.style.width = '0px'
  container.style.height = '0px'
  container.style.overflow = 'hidden'
  document.body.appendChild(container)
  return container
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function createNinjaQRCodeImage(imgUrl: string, qrCodeCanvas: HTMLCanvasElement, qrPos: { x: number, y: number }) {
  const container = createNinjaContainer()
  const img = await loadImg(imgUrl)

  const imgCanvas = document.createElement('canvas')
  container.appendChild(imgCanvas)

  await nextTick()

  imgCanvas.width = img.width
  imgCanvas.height = img.height
  const imgCtx = imgCanvas.getContext('2d')!
  imgCtx.drawImage(img, 0, 0)
  const imgDataObj = imgCtx.getImageData(0, 0, img.width, img.height)
  const imgData = imgDataObj.data

  const qrCtx = qrCodeCanvas.getContext('2d')!
  const qrData = qrCtx.getImageData(0, 0, qrCodeCanvas.width, qrCodeCanvas.height).data

  for (let y = 0; y < qrCodeCanvas.height; y++) {
    for (let x = 0; x < qrCodeCanvas.width; x++) {
      const qrIdx = (y * qrCodeCanvas.width + x) * 4
      const imgIdx = ((y + qrPos.y) * img.width + x + qrPos.x) * 4
      if (imgData[imgIdx] === undefined)
        continue

      if (qrData[qrIdx + 3] > 0) {
        imgData[imgIdx] = (imgData[imgIdx] - 105) * 1.7
        imgData[imgIdx + 1] = (imgData[imgIdx + 1] - 105) * 1.7
        imgData[imgIdx + 2] = (imgData[imgIdx + 2] - 105) * 1.7
        imgData[imgIdx + 3] = 150
      }
    }
  }

  imgCtx.putImageData(imgDataObj, 0, 0)

  const a = document.createElement('a')
  a.href = imgCanvas.toDataURL('image/png')
  a.download = 'ninja.png'
  a.click()

  container.removeChild(imgCanvas)
}
