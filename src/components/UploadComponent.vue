<template>
  <div class="upload-container">
    <!-- Drag & Drop Zone -->
    <div
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent
      @dragleave="handleDragLeave"
      :class="[
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      ]"
    >
      <div class="space-y-4">
        <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <div>
          <p class="text-lg font-medium text-gray-700">Drop PDF files here</p>
          <p class="text-sm text-gray-500">or click to select files</p>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".pdf"
          @change="handleFileSelect"
          class="hidden"
        />
        <button
          @click="($refs.fileInput as HTMLInputElement)?.click()"
          class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Select PDF Files
        </button>
      </div>
    </div>

    <!-- File List -->
    <div v-if="files.length > 0" class="mt-6 space-y-3">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium">Selected Files ({{ files.length }})</h3>
        <div class="space-x-2">
          <button
            v-if="processingStatus === 'idle'"
            @click="startProcessing"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Start Processing
          </button>
          <button
            v-if="processingStatus === 'processing'"
            @click="pauseProcessing"
            class="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            Pause
          </button>
          <button
            v-if="processingStatus === 'paused'"
            @click="resumeProcessing"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Resume
          </button>
          <button
            @click="clearFiles"
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div v-if="processingStatus !== 'idle'" class="bg-gray-200 rounded-full h-2">
        <div
          :style="{ width: progressPercentage + '%' }"
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
        ></div>
      </div>

      <!-- Progress Stats -->
      <div v-if="processingStatus !== 'idle'" class="text-sm text-gray-600">
        <p>{{ progress.completed }} completed, {{ progress.failed }} failed of {{ progress.total }} total</p>
        <p v-if="progress.current">Currently processing: {{ progress.current }}</p>
      </div>

      <!-- File List -->
      <div class="max-h-64 overflow-y-auto space-y-2">
        <div
          v-for="(file, index) in files"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 rounded"
        >
          <div class="flex-1">
            <p class="font-medium">{{ file.name }}</p>
            <p class="text-sm text-gray-500">{{ formatFileSize(file.size) }}</p>
          </div>
          <div class="flex items-center space-x-2">
            <span
              v-if="processingStatus !== 'idle'"
              :class="[
                'px-2 py-1 text-xs rounded',
                getFileStatus(index) === 'completed' ? 'bg-green-100 text-green-800' :
                getFileStatus(index) === 'processing' ? 'bg-blue-100 text-blue-800' :
                getFileStatus(index) === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              ]"
            >
              {{ getFileStatus(index) }}
            </span>
            <button
              @click="removeFile(index)"
              :disabled="processingStatus === 'processing'"
              class="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db } from '@/stores/database';
import type { ProcessingProgress, WorkerMessage } from '@/types';

const emit = defineEmits<{
  uploadComplete: [];
}>();

const files = ref<File[]>([]);
const isDragging = ref(false);
const processingStatus = ref<'idle' | 'processing' | 'paused' | 'completed'>('idle');
const progress = ref<ProcessingProgress>({
  total: 0,
  completed: 0,
  failed: 0,
  status: 'idle'
});

let worker: Worker | null = null;

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0;
  return Math.round(((progress.value.completed + progress.value.failed) / progress.value.total) * 100);
});

onMounted(() => {
  setupWorker();
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
  }
});

function setupWorker() {
  try {
    worker = new Worker(new URL('@/workers/pdfProcessor.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'progress':
          progress.value = payload;
          processingStatus.value = payload.status;
          break;
        case 'complete':
          handleBatchComplete(payload.batch);
          break;
        case 'error':
          processingStatus.value = 'idle';
          break;
      }
    };

    worker.onerror = () => {
      processingStatus.value = 'idle';
    };
  } catch (error) {
    // Worker setup failed
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const droppedFiles = Array.from(event.dataTransfer?.files || [])
    .filter(file => file.type === 'application/pdf');

  if (droppedFiles.length > 0) {
    files.value.push(...droppedFiles);
  }
}

function handleDragLeave(event: DragEvent) {
  if (!event.relatedTarget) {
    isDragging.value = false;
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const selectedFiles = Array.from(target.files || []);
  files.value.push(...selectedFiles);
  target.value = '';
}

function removeFile(index: number) {
  files.value.splice(index, 1);
}

function clearFiles() {
  files.value = [];
  processingStatus.value = 'idle';
  progress.value = {
    total: 0,
    completed: 0,
    failed: 0,
    status: 'idle'
  };
}

async function startProcessing() {
  if (files.value.length === 0 || !worker) {
    return;
  }

  processingStatus.value = 'processing';
  progress.value = {
    total: files.value.length,
    completed: 0,
    failed: 0,
    status: 'processing'
  };

  try {
    // Convert files to transferable format
    const fileData = await Promise.all(
      files.value.map(async (file, index) => ({
        name: file.name,
        size: file.size,
        data: await file.arrayBuffer(),
        index
      }))
    );

    worker.postMessage({
      type: 'process-batch',
      payload: {
        files: fileData,
        startIndex: 0
      }
    });
  } catch (error) {
    processingStatus.value = 'idle';
  }
}

function pauseProcessing() {
  if (worker) {
    worker.postMessage({ type: 'pause' });
  }
}

function resumeProcessing() {
  if (worker) {
    worker.postMessage({ type: 'resume' });
  }
}

async function handleBatchComplete(batch: Array<{ document: any; searchIndex: any }>) {
  for (const item of batch) {
    try {
      if (item.searchIndex) {
        await db.addDocument(item.document);
        await db.addSearchIndex(item.searchIndex);
      } else {
        await db.addDocument(item.document);
      }
    } catch (error) {
      // Failed to save document
    }
  }

  if (progress.value.completed + progress.value.failed >= progress.value.total) {
    processingStatus.value = 'completed';
    
    // Refresh search engine after all documents are processed
    if (window.searchEngine) {
      try {
        await window.searchEngine.refresh();
      } catch (error) {
        // Failed to refresh search engine
      }
    }
    
    emit('uploadComplete');
  }
}

function getFileStatus(index: number): string {
  if (processingStatus.value === 'idle') return 'pending';
  if (index < progress.value.completed) return 'completed';
  if (index < progress.value.completed + progress.value.failed) return 'error';
  if (index === progress.value.completed + progress.value.failed && processingStatus.value === 'processing') {
    return 'processing';
  }
  return 'pending';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>