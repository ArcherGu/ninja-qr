<script setup lang="ts">
import { unrefElement, useDropZone, useFileDialog } from '@vueuse/core'
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import logo from '@src/assets/ninja_logo.png'
import '@leafer-in/editor'
import { App, ChildEvent, Image, ImageEvent, KeyEvent, Rect } from 'leafer-ui'
import QRCode from 'qrcode'
import { ElMessage } from 'element-plus'
import { createNinjaQRCodeImage } from './core'

const EDITOR_SIZE_LIMIT = {
  MAX_WIDTH: 1000,
  MAX_HEIGHT: 1000,
  MIN_WIDTH: 350,
  MIN_HEIGHT: 350,
}
const editorSize = ref({
  width: EDITOR_SIZE_LIMIT.MIN_WIDTH,
  height: EDITOR_SIZE_LIMIT.MIN_HEIGHT,
})
const editorSizeStyle = computed(() => `width: ${editorSize.value.width}px; height: ${editorSize.value.height}px`)

let app: App
let qr: Image
const img = shallowRef<Image>()
const bg = Rect.one({ fill: '#fff', editable: false, zIndex: 0 }, 0, 0, editorSize.value.width, editorSize.value.height)

const hasImage = computed(() => !!img.value)
const editorRef = ref<HTMLDivElement>()
watch(
  editorRef,
  () => {
    const el = unrefElement(editorRef)
    if (!el)
      return

    app = new App({
      view: el,
      ground: { type: 'draw' },
      tree: { type: 'draw' },
      sky: {
        usePartRender: false,
      },
      editor: {},
    })

    app.ground.add(bg)
    app.on(KeyEvent.UP, (e: KeyEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && app.editor.list.length > 0) {
        app.editor.list.forEach((item) => {
          item.remove()
        })

        app.editor.target = []
      }
    })
    app.tree.on(ChildEvent.REMOVE, () => {
      app.editor.target = []
    })
  },
  { flush: 'post' },
)
onUnmounted(() => {
  app && app.destroy()
})

function onImageLoad(image: Image, scale: number = 1) {
  const { width, height } = image
  const canvasWidth = width * scale
  const canvasHeight = height * scale
  editorSize.value.width = canvasWidth
  editorSize.value.height = canvasHeight
  bg.width = canvasWidth
  bg.height = canvasHeight
}

function uploadImage(imgFile: File) {
  if (!app)
    return

  img.value && img.value.remove()
  qr && qr.remove()

  img.value = new Image({
    url: URL.createObjectURL(imgFile),
    editable: false,
    zIndex: 1,
  })

  img.value.once(ImageEvent.LOADED, (_: ImageEvent) => {
    if (!img.value)
      return

    let scale = 1
    if (img.value.width > EDITOR_SIZE_LIMIT.MAX_WIDTH || img.value.height > EDITOR_SIZE_LIMIT.MAX_HEIGHT)
      scale = Math.min(EDITOR_SIZE_LIMIT.MAX_WIDTH / img.value.width, EDITOR_SIZE_LIMIT.MAX_HEIGHT / img.value.height)
    else if (img.value.width < EDITOR_SIZE_LIMIT.MIN_WIDTH || img.value.height < EDITOR_SIZE_LIMIT.MIN_HEIGHT)
      scale = Math.max(EDITOR_SIZE_LIMIT.MIN_WIDTH / img.value.width, EDITOR_SIZE_LIMIT.MIN_HEIGHT / img.value.height)

    img.value.scale = scale

    onImageLoad(img.value, scale)
  })

  app.ground.add(img.value)
}

function onDrop(files: File[] | null) {
  if (files) {
    const file = files[0]
    if (file.size > 500 * 1024) {
      ElMessage.warning('The image size should not exceed 500KB')
      return
    }
    uploadImage(file)
  }
}

const imgDropZone = ref<HTMLDivElement>()
useDropZone(imgDropZone, {
  onDrop,
  dataTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
})

const {
  open: openFile,
  reset,
  onChange,
} = useFileDialog({
  accept: 'image/*',
  directory: false,
})

onChange((files) => {
  if (files) {
    const file = files[0]
    if (file.size > 500 * 1024) {
      ElMessage.warning('The image size should not exceed 500KB')
      return
    }
    uploadImage(file)
    reset()
  }
})

const qrContent = ref('https://github.com/ArcherGu/ninja-qr')
function createQrCode() {
  if (!img.value)
    return

  QRCode.toDataURL(
    qrContent.value,
    {
      margin: 0,
      color: {
        dark: '#000',
        light: '#ffffff00',
      },
    },
    (err, url) => {
      if (err) {
        console.error(err)
        return
      }

      qr && qr.remove()

      qr = new Image({
        url,
        editable: true,
        zIndex: 2,
      })

      qr.once(ImageEvent.LOADED, (_: ImageEvent) => {
        if (!qr || !img.value)
          return

        // center the qr code
        qr.x = (editorSize.value.width - qr.width) / 2
        qr.y = (editorSize.value.height - qr.height) / 2
      })

      app.tree.add(qr)
    },
  )
}

const generateLoading = ref(false)
async function generateAndDownload() {
  generateLoading.value = true
  try {
    if (!app || !img.value || !qr)
      return

    const scale = img.value.scale as number
    const { x, y } = qr

    const qrScale = 1 / scale
    const qrExportResult = await qr.export('canvas', {
      scale: qrScale,
    })

    await createNinjaQRCodeImage(img.value.url, qrExportResult.data.view, {
      x: Math.round(x * qrScale),
      y: Math.round(y * qrScale),
    })
  }
  catch (error) {
    console.error(error)
  }
  finally {
    generateLoading.value = false
  }
}
</script>

<template>
  <div class="w-full flex flex-col items-center">
    <div class="flex items-center justify-center h-150px mt-100px">
      <img :src="logo" alt="ninja" class="w-80px">
      <div class="text-80px ml-10px logo-name">
        <span class="text-purple-600">Ninja</span>
        <span class="text-gray-300">QR</span>
      </div>
    </div>
    <div class="flex items-center justify-center text-white mb-20px -mt-10px">
      add a ninja QR code in the image
    </div>
    <div ref="imgDropZone" :style="editorSizeStyle" class="relative">
      <div v-show="!hasImage" class="img-select-zone" @click="() => openFile()">
        <i-fluent-add-12-regular class="text-60px" />
        <span class="text-24px">select or drop image here</span>
      </div>

      <div ref="editorRef" class="w-full h-full" />
    </div>

    <div class="mt-40px">
      <el-input
        v-model="qrContent" style="width: 350px" :autosize="{ minRows: 2, maxRows: 4 }" type="textarea"
        :maxlength="256" show-word-limit size="large" placeholder="Please input QR code content"
      />
    </div>

    <div class="flex items-center justify-center mt-40px">
      <el-button size="large" plain color="#722ae1" @click="() => openFile()">
        Upload Image
      </el-button>

      <el-button
        size="large" plain color="#722ae1" :disabled="!hasImage || qrContent.length === 0"
        @click="createQrCode"
      >
        Add QR Code
      </el-button>

      <el-button
        size="large" color="#722ae1" :disabled="!hasImage" :loading="generateLoading"
        @click="generateAndDownload"
      >
        Generate & Download
      </el-button>
    </div>

    <div class="foot">
      <span class="mr-5px">Made with</span>
      <i-ri-heart-2-fill class="heart" />
      <span class="mx-5px">by</span>
      <a target="_blank" href="https://archergu.me/">Archer Gu</a>
      <a target="_blank" href="https://github.com/ArcherGu/ninja-qr">
        <i-logos-github-icon class="ml-5px" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.logo-name {
  @apply transform -skew-x-12;
}

.img-select-zone {
  @apply w-full h-full border-dashed border-2 border-gray-400 rounded-lg text-gray-400 cursor-pointer box-border;
  @apply flex flex-col justify-center items-center;
  @apply hover:border-gray-500 hover:text-gray-500;
  @apply transition-all duration-300 ease-linear;
  @apply absolute top-0 left-0 z-10;
}

.foot {
  @apply w-full flex items-center justify-center text-white mt-40px;
}

.foot .heart {
  color: #f43f5e;
}
</style>
