import type { AppSettings, DoubaoTtsSettings, MinimaxTtsSettings, OpenAiTtsSettings, TtsProviderType } from '@/types/domain';
import { getResolvedOpenAiTtsConfig, normalizeAppSettings } from '@/utils/settings';

interface TtsAudioPayload {
  audioUrl: string;
  mimeType: string;
}

export interface TtsAudioResult extends TtsAudioPayload {
  provider: TtsProviderType;
  voiceId: string;
}

export interface TtsSynthesisOptions {
  minimaxVoiceId?: string;
}

const legacyOpenAiSpeechVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const defaultGeminiTtsVoice = 'Kore';
const geminiTtsVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede'];

function minimaxMimeTypeForFormat(format: MinimaxTtsSettings['audioFormat']) {
  if (format === 'wav') return 'audio/wav';
  if (format === 'pcm') return 'audio/pcm';
  return 'audio/mpeg';
}

function doubaoMimeTypeForFormat(format: DoubaoTtsSettings['encoding']) {
  if (format === 'wav') return 'audio/wav';
  if (format === 'pcm') return 'audio/pcm';
  if (format === 'ogg_opus') return 'audio/ogg; codecs=opus';
  return 'audio/mpeg';
}

function openAiMimeTypeForFormat(format: OpenAiTtsSettings['responseFormat']) {
  if (format === 'wav') return 'audio/wav';
  if (format === 'pcm') return 'audio/pcm';
  if (format === 'opus') return 'audio/ogg; codecs=opus';
  if (format === 'aac') return 'audio/aac';
  if (format === 'flac') return 'audio/flac';
  return 'audio/mpeg';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function pcmBytesToWavDataUrl(bytes: Uint8Array, mimeType: string) {
  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000) || 24000;
  const channelCount = Number(mimeType.match(/channels?=(\d+)/i)?.[1] ?? 1) || 1;
  const bitsPerSample = 16;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const blockAlign = channelCount * bitsPerSample / 8;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + bytes.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, bytes.byteLength, true);

  const wavBytes = new Uint8Array(header.byteLength + bytes.byteLength);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(bytes, header.byteLength);
  return `data:audio/wav;base64,${bytesToBase64(wavBytes)}`;
}

function hexToDataUrl(hex: string, mimeType: string) {
  const normalized = hex.replace(/\s+/g, '').trim();
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) return '';
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function base64ToDataUrl(base64: string, mimeType: string) {
  const normalized = base64.trim();
  if (!normalized) return '';
  try {
    atob(normalized);
    return `data:${mimeType};base64,${normalized}`;
  } catch {
    return '';
  }
}

function geminiBase64ToAudioPayload(base64: string, mimeType: string): TtsAudioPayload {
  const normalizedMimeType = mimeType.trim() || 'audio/L16;codec=pcm;rate=24000';
  if (/audio\/(?:l16|pcm)/i.test(normalizedMimeType)) {
    return {
      audioUrl: pcmBytesToWavDataUrl(base64ToBytes(base64), normalizedMimeType),
      mimeType: 'audio/wav'
    };
  }

  const audioUrl = base64ToDataUrl(base64, normalizedMimeType);
  if (!audioUrl) throw new Error('Gemini TTS 返回了无法解析的音频内容。');
  return { audioUrl, mimeType: normalizedMimeType };
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('TTS 音频读取失败。'));
    reader.readAsDataURL(blob);
  });
}

async function remoteAudioToDataUrl(audioUrl: string, fallbackMimeType: string) {
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`TTS 音频下载失败：${response.status}`);
  return readAudioResponse(response, fallbackMimeType);
}

async function readAudioResponse(response: Response, fallbackMimeType: string) {
  const blob = await response.blob();
  const mimeType = blob.type || fallbackMimeType;
  return {
    audioUrl: await readBlobAsDataUrl(blob.type ? blob : new Blob([blob], { type: mimeType })),
    mimeType
  };
}

function buildMinimaxEndpoint(apiUrl: string, groupId: string) {
  const endpoint = apiUrl.trim().replace(/\s+/g, '');
  if (!endpoint) throw new Error('请先填写 MiniMax TTS API 地址。');
  if (!groupId.trim() || /[?&]GroupId=/i.test(endpoint)) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}GroupId=${encodeURIComponent(groupId.trim())}`;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `link-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractJsonErrorMessage(rawText: string, fallback: string) {
  try {
    const payload = JSON.parse(rawText) as Record<string, unknown>;
    const error = payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error)
      ? payload.error as Record<string, unknown>
      : null;
    return String(error?.message ?? payload.message ?? fallback).trim() || fallback;
  } catch {
    return rawText.trim() || fallback;
  }
}

function normalizeObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractGeminiInlineAudio(payload: unknown) {
  const record = normalizeObject(payload);
  const candidates = Array.isArray(record?.candidates) ? record.candidates : [];

  for (const candidate of candidates) {
    const content = normalizeObject(normalizeObject(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const partRecord = normalizeObject(part);
      const inlineData = normalizeObject(partRecord?.inlineData) ?? normalizeObject(partRecord?.inline_data);
      const data = String(inlineData?.data ?? '').trim();
      if (data) {
        return {
          data,
          mimeType: String(inlineData?.mimeType ?? inlineData?.mime_type ?? 'audio/L16;codec=pcm;rate=24000').trim()
        };
      }
    }
  }

  return null;
}

function isLegacyOpenAiSpeechModel(model: string) {
  return /^tts-1(?:-hd)?$/i.test(model.trim());
}

function getOpenAiSpeechVoice(model: string, voice: string) {
  const normalizedVoice = voice.trim();
  if (!isLegacyOpenAiSpeechModel(model)) return normalizedVoice;
  return legacyOpenAiSpeechVoices.includes(normalizedVoice) ? normalizedVoice : legacyOpenAiSpeechVoices[0];
}

function getGeminiTtsVoice(voice: string) {
  const normalizedVoice = voice.trim();
  return geminiTtsVoices.includes(normalizedVoice) ? normalizedVoice : defaultGeminiTtsVoice;
}

function normalizeGeminiTtsModel(model: string) {
  return model.trim().replace(/^models\//i, '');
}

function isGeminiTtsModel(model: string) {
  return /gemini.*tts/i.test(normalizeGeminiTtsModel(model));
}

function buildGeminiNativeTtsEndpoint(endpoint: string, model: string) {
  const url = new URL(endpoint, window.location.origin);
  const basePath = url.pathname
    .replace(/\/openai\/audio\/speech\/?$/i, '')
    .replace(/\/audio\/speech\/?$/i, '')
    .replace(/\/openai\/?$/i, '')
    .replace(/\/+$/, '') || '/v1beta';
  url.pathname = `${basePath}/models/${encodeURIComponent(normalizeGeminiTtsModel(model))}:generateContent`;
  url.search = '';
  return url.toString();
}

function extractAudioCandidate(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';

  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : {};
  const candidates = [
    data.audio,
    data.audioUrl,
    data.audio_url,
    data.audio_file,
    record.audio,
    record.audioUrl,
    record.audio_url,
    record.audio_file
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

function getMinimaxError(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const record = payload as Record<string, unknown>;
  const baseResp = record.base_resp && typeof record.base_resp === 'object' && !Array.isArray(record.base_resp)
    ? record.base_resp as Record<string, unknown>
    : null;
  const statusCode = Number(baseResp?.status_code ?? record.status_code ?? 0);
  if (!Number.isFinite(statusCode) || statusCode === 0) return '';
  return String(baseResp?.status_msg ?? record.status_msg ?? record.message ?? 'MiniMax TTS 生成失败。').trim();
}

function getDoubaoError(payload: unknown) {
  const record = normalizeObject(payload);
  if (!record) return '';
  const code = Number(record.code ?? 3000);
  if (!Number.isFinite(code) || code === 3000) return '';
  return String(record.message ?? '豆包 TTS 生成失败。').trim();
}

function extractDoubaoAudioCandidate(payload: unknown) {
  const record = normalizeObject(payload);
  const data = String(record?.data ?? '').trim();
  if (data) return data;
  return extractAudioCandidate(payload);
}

async function normalizeAudioPayload(candidate: string, mimeType: string, fallbackError = 'MiniMax TTS 没有返回可识别的音频内容。'): Promise<TtsAudioPayload> {
  if (candidate.startsWith('data:')) {
    const matchedMime = candidate.match(/^data:([^;,]+)/i)?.[1] || mimeType;
    return { audioUrl: candidate, mimeType: matchedMime };
  }
  if (/^https?:\/\//i.test(candidate)) return remoteAudioToDataUrl(candidate, mimeType);

  const hexAudioUrl = hexToDataUrl(candidate, mimeType);
  if (hexAudioUrl) return { audioUrl: hexAudioUrl, mimeType };

  const base64AudioUrl = base64ToDataUrl(candidate, mimeType);
  if (base64AudioUrl) return { audioUrl: base64AudioUrl, mimeType };

  throw new Error(fallbackError);
}

export async function synthesizeMinimaxSpeech(text: string, settings: MinimaxTtsSettings): Promise<TtsAudioResult> {
  const content = text.trim();
  if (!content) throw new Error('语音内容为空。');
  if (!settings.apiKey.trim()) throw new Error('请先填写 MiniMax API Key。');
  if (!settings.groupId.trim()) throw new Error('请先填写 MiniMax Group ID。');
  if (!settings.voiceId.trim()) throw new Error('请先填写 MiniMax Voice ID。');

  const mimeType = minimaxMimeTypeForFormat(settings.audioFormat);
  const response = await fetch(buildMinimaxEndpoint(settings.apiUrl, settings.groupId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.model,
      text: content,
      stream: false,
      voice_setting: {
        voice_id: settings.voiceId,
        speed: settings.speed,
        vol: settings.volume,
        pitch: settings.pitch
      },
      audio_setting: {
        sample_rate: settings.sampleRate,
        bitrate: settings.bitrate,
        format: settings.audioFormat,
        channel: settings.channel
      }
    })
  });

  const rawText = await response.text();
  let payload: unknown = rawText;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch {
    if (!response.ok) throw new Error(rawText.trim() || `MiniMax TTS 请求失败：${response.status}`);
  }

  if (!response.ok) {
    const message = getMinimaxError(payload) || rawText.trim() || `MiniMax TTS 请求失败：${response.status}`;
    throw new Error(message);
  }

  const apiError = getMinimaxError(payload);
  if (apiError) throw new Error(apiError);

  const audio = await normalizeAudioPayload(extractAudioCandidate(payload), mimeType);
  return { ...audio, provider: 'minimax', voiceId: settings.voiceId };
}

export async function synthesizeDoubaoSpeech(text: string, settings: DoubaoTtsSettings): Promise<TtsAudioResult> {
  const content = text.trim();
  if (!content) throw new Error('语音内容为空。');
  if (!settings.apiUrl.trim()) throw new Error('请先填写豆包 TTS API 地址。');
  if (!settings.appId.trim()) throw new Error('请先填写豆包 App ID。');
  if (!settings.token.trim()) throw new Error('请先填写豆包 Token。');
  if (!settings.cluster.trim()) throw new Error('请先填写豆包 Cluster。');
  if (!settings.voiceType.trim()) throw new Error('请先填写豆包 Voice Type 或克隆音色 ID。');

  const mimeType = doubaoMimeTypeForFormat(settings.encoding);
  const response = await fetch(settings.apiUrl.trim(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer;${settings.token.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app: {
        appid: settings.appId.trim(),
        token: settings.token.trim(),
        cluster: settings.cluster.trim()
      },
      user: {
        uid: settings.uid.trim() || 'link-user'
      },
      audio: {
        voice_type: settings.voiceType.trim(),
        encoding: settings.encoding,
        rate: settings.sampleRate,
        speed_ratio: settings.speedRatio,
        volume_ratio: settings.volumeRatio,
        pitch_ratio: settings.pitchRatio,
        ...(settings.emotion.trim() ? { emotion: settings.emotion.trim() } : {}),
        ...(settings.language.trim() ? { language: settings.language.trim() } : {})
      },
      request: {
        reqid: createRequestId(),
        text: content,
        text_type: settings.textType,
        operation: 'query',
        silence_duration: settings.silenceDuration,
        ...(settings.splitSentence ? { split_sentence: 1 } : {}),
        ...(settings.pureEnglishOpt ? { pure_english_opt: 1 } : {})
      }
    })
  });

  const rawText = await response.text();
  let payload: unknown = rawText;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch {
    if (!response.ok) throw new Error(rawText.trim() || `豆包 TTS 请求失败：${response.status}`);
  }

  if (!response.ok) {
    const message = getDoubaoError(payload) || extractJsonErrorMessage(rawText, `豆包 TTS 请求失败：${response.status}`);
    throw new Error(message);
  }

  const apiError = getDoubaoError(payload);
  if (apiError) throw new Error(apiError);

  const audio = await normalizeAudioPayload(extractDoubaoAudioCandidate(payload), mimeType, '豆包 TTS 没有返回可识别的音频内容。');
  return { ...audio, provider: 'doubao', voiceId: settings.voiceType };
}

async function synthesizeGeminiNativeSpeech(text: string, endpoint: string, apiKey: string, model: string, voice: string): Promise<TtsAudioResult> {
  const geminiVoice = getGeminiTtsVoice(voice);
  const response = await fetch(buildGeminiNativeTtsEndpoint(endpoint, model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-goog-api-key': apiKey } : {})
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: geminiVoice
            }
          }
        }
      }
    })
  });

  const rawText = await response.text();
  let payload: unknown = rawText;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch {
    if (!response.ok) throw new Error(rawText.trim() || `Gemini TTS 请求失败：${response.status}`);
  }

  if (!response.ok) {
    throw new Error(extractJsonErrorMessage(rawText, `Gemini TTS 请求失败：${response.status}`));
  }

  const inlineAudio = extractGeminiInlineAudio(payload);
  if (!inlineAudio) throw new Error('Gemini TTS 没有返回可播放的音频。');
  const audio = geminiBase64ToAudioPayload(inlineAudio.data, inlineAudio.mimeType);
  return { ...audio, provider: 'openai', voiceId: geminiVoice };
}

export async function synthesizeOpenAiSpeech(text: string, settings: AppSettings): Promise<TtsAudioResult> {
  const content = text.trim();
  if (!content) throw new Error('语音内容为空。');
  const resolved = getResolvedOpenAiTtsConfig(settings);
  if (!resolved.endpoint.trim()) throw new Error('请先添加 OpenAI TTS 供应商。');
  if (!resolved.model.trim()) throw new Error('请先同步并选择 OpenAI TTS 模型。');

  if (isGeminiTtsModel(resolved.model)) {
    return synthesizeGeminiNativeSpeech(content, resolved.endpoint, resolved.apiKey, resolved.model, settings.ttsOpenAi.voice);
  }

  const voice = getOpenAiSpeechVoice(resolved.model, settings.ttsOpenAi.voice);
  if (!voice.trim()) throw new Error('请先填写 OpenAI TTS Voice。');

  const response = await fetch(resolved.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: resolved.model,
      input: content,
      voice,
      response_format: settings.ttsOpenAi.responseFormat,
      speed: settings.ttsOpenAi.speed,
      ...(settings.ttsOpenAi.instructions.trim() ? { instructions: settings.ttsOpenAi.instructions.trim() } : {})
    })
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(extractJsonErrorMessage(rawText, `OpenAI TTS 请求失败：${response.status}`));
  }

  const audio = await readAudioResponse(response, openAiMimeTypeForFormat(settings.ttsOpenAi.responseFormat));
  return { ...audio, provider: 'openai', voiceId: voice };
}

export async function synthesizeSpeech(text: string, settings: AppSettings, options: TtsSynthesisOptions = {}): Promise<TtsAudioResult> {
  const normalized = normalizeAppSettings(settings);

  if (normalized.ttsProvider === 'openai') return synthesizeOpenAiSpeech(text, normalized);
  if (normalized.ttsProvider === 'doubao') return synthesizeDoubaoSpeech(text, normalized.ttsDoubao);
  const minimaxVoiceId = String(options.minimaxVoiceId ?? '').trim();
  return synthesizeMinimaxSpeech(text, minimaxVoiceId
    ? { ...normalized.ttsMinimax, voiceId: minimaxVoiceId }
    : normalized.ttsMinimax);
}
