/* global google */
const API = 'https://www.googleapis.com/youtube/v3';
// captions.list is only available through youtube.force-ssl (not youtube.readonly).
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const VIDEO_PARTS = [
  'snippet', 'contentDetails', 'status', 'statistics', 'topicDetails', 'recordingDetails',
  'fileDetails', 'processingDetails', 'suggestions', 'liveStreamingDetails', 'localizations',
  'paidProductPlacementDetails'
].join(',');

const state = { token: null, channel: null, videos: [], selected: new Set(), tokenClient: null, clientId: null };
const $ = (id) => document.getElementById(id);
const els = {
  setup: $('setup-card'), workspace: $('workspace'), consent: $('policy-consent'),
  signIn: $('sign-in'), authStatus: $('auth-status'), channelName: $('channel-name'), channelStats: $('channel-stats'),
  channelAvatar: $('channel-avatar'), videos: $('video-list'), listStatus: $('list-status'), visibleCount: $('visible-count'),
  selectedCount: $('selected-count'), selectAll: $('select-all'), search: $('search'), exportJson: $('export-json'),
  exportCsv: $('export-csv'), includeCaptionText: $('include-caption-text'), dialog: $('metadata-dialog'), metadata: $('metadata-output')
};

function setAuthStatus(message, isError = false) { els.authStatus.textContent = message; els.authStatus.style.color = isError ? '#c3341f' : ''; }
function escapeHtml(value = '') { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value)) : 'Без даты'; }
function formatNumber(value) { return new Intl.NumberFormat('ru-RU').format(Number(value || 0)); }

async function api(path, params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API}/${path}?${query}`, { headers: { Authorization: `Bearer ${state.token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Не удалось получить данные YouTube.');
  return data;
}

function initialiseAuth() {
  els.signIn.disabled = !state.clientId || !els.consent.checked;
  if (!state.clientId || !window.google?.accounts?.oauth2) return;
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.clientId, scope: SCOPE,
    callback: async (response) => {
      if (response.error) return setAuthStatus(`Ошибка входа: ${response.error}`, true);
      state.token = response.access_token;
      setAuthStatus('Аккаунт подключён. Загружаю канал…');
      try { await loadChannel(); } catch (error) { setAuthStatus(error.message, true); }
    }
  });
}

async function loadChannel() {
  const data = await api('channels', { part: 'snippet,contentDetails,statistics', mine: 'true' });
  const channel = data.items?.[0];
  if (!channel) throw new Error('У этого аккаунта не найден YouTube-канал.');
  state.channel = channel;
  els.channelName.textContent = channel.snippet.title;
  els.channelAvatar.src = channel.snippet.thumbnails?.default?.url || '';
  els.channelAvatar.alt = `Аватар канала ${channel.snippet.title}`;
  els.channelStats.textContent = `${formatNumber(channel.statistics.videoCount)} видео · ${formatNumber(channel.statistics.subscriberCount)} подписчиков`;
  els.setup.classList.add('hidden'); els.workspace.classList.remove('hidden');
  await loadVideos(channel.contentDetails.relatedPlaylists.uploads);
}

async function loadVideos(playlistId, pageToken = '') {
  els.listStatus.textContent = state.videos.length ? 'Загружаю следующую страницу…' : 'Загружаю список роликов…';
  const data = await api('playlistItems', { part: 'snippet,contentDetails,status', playlistId, maxResults: '50', ...(pageToken && { pageToken }) });
  for (const item of data.items || []) {
    const id = item.contentDetails?.videoId;
    if (id && !state.videos.some((video) => video.id === id)) state.videos.push({ id, playlistItem: item });
  }
  renderVideos();
  if (data.nextPageToken) return loadVideos(playlistId, data.nextPageToken);
  els.listStatus.textContent = state.videos.length ? 'Все ролики загружены.' : 'На канале пока нет роликов.';
}

function filteredVideos() {
  const query = els.search.value.trim().toLocaleLowerCase('ru-RU');
  return query ? state.videos.filter((video) => video.playlistItem.snippet.title.toLocaleLowerCase('ru-RU').includes(query)) : state.videos;
}

function renderVideos() {
  const visible = filteredVideos();
  els.videos.replaceChildren();
  const fragment = document.createDocumentFragment();
  const template = $('video-template');
  for (const video of visible) {
    const item = video.playlistItem; const snippet = item.snippet;
    const card = template.content.cloneNode(true);
    const checkbox = card.querySelector('.video-checkbox'); checkbox.checked = state.selected.has(video.id); checkbox.dataset.id = video.id;
    const thumb = card.querySelector('.thumbnail'); thumb.src = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || ''; thumb.alt = '';
    card.querySelector('.video-title').textContent = snippet.title;
    card.querySelector('.video-meta').textContent = `${formatDate(item.contentDetails?.videoPublishedAt || snippet.publishedAt)} · ${snippet.channelTitle || ''}`;
    card.querySelector('.video-id').textContent = video.id;
    card.querySelector('.details-button').dataset.id = video.id;
    fragment.append(card);
  }
  els.videos.append(fragment); els.visibleCount.textContent = visible.length; updateSelectionUi();
}

function updateSelectionUi() {
  els.selectedCount.textContent = state.selected.size;
  els.exportJson.disabled = els.exportCsv.disabled = state.selected.size === 0;
  const visible = filteredVideos(); const allVisible = visible.length > 0 && visible.every((video) => state.selected.has(video.id));
  els.selectAll.textContent = allVisible ? 'Снять выбор' : 'Выбрать все';
}

async function getMetadata(ids, includeCaptionText = true) {
  const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => ids.slice(i * 50, i * 50 + 50));
  const results = [];
  for (let index = 0; index < chunks.length; index += 1) {
    els.listStatus.textContent = `Получаю полную мету: ${Math.min((index + 1) * 50, ids.length)} из ${ids.length}…`;
    const response = await api('videos', { part: VIDEO_PARTS, id: chunks[index].join(',') });
    results.push(...(response.items || []));
  }
  const captionsByVideo = await getCaptionTracks(ids, includeCaptionText);
  els.listStatus.textContent = `Готово: получены данные и субтитры ${results.length} роликов.`;
  return results.map((video) => ({ ...video, captionTracks: captionsByVideo.get(video.id) || [] }));
}

async function getCaptionTracks(ids, includeCaptionText) {
  const captionsByVideo = new Map();
  for (let index = 0; index < ids.length; index += 1) {
    const videoId = ids[index];
    els.listStatus.textContent = `Получаю дорожки субтитров: ${index + 1} из ${ids.length}…`;
    try {
      const response = await api('captions', { part: 'snippet', videoId });
      const tracks = response.items || [];
      const tracksWithText = [];
      for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
        if (includeCaptionText) els.listStatus.textContent = `Скачиваю текст субтитров: ролик ${index + 1} из ${ids.length}, дорожка ${trackIndex + 1} из ${tracks.length}…`;
        tracksWithText.push(includeCaptionText ? await downloadCaptionText(tracks[trackIndex]) : tracks[trackIndex]);
      }
      captionsByVideo.set(videoId, tracksWithText);
    } catch (error) {
      if (/forbidden|permission|scope/i.test(error.message)) {
        throw new Error('Для загрузки субтитров войдите заново и подтвердите обновлённое разрешение Google.');
      }
      throw error;
    }
  }
  return captionsByVideo;
}

async function downloadCaptionText(track) {
  const response = await fetch(`${API}/captions/${encodeURIComponent(track.id)}?tfmt=srt`, {
    headers: { Authorization: `Bearer ${state.token}` }
  });
  if (!response.ok) {
    let message = 'Текст дорожки недоступен.';
    try { message = (await response.json()).error?.message || message; } catch { /* keep the fallback */ }
    return { ...track, subtitleFormat: 'srt', subtitleText: '', subtitleDownloadError: message };
  }
  return { ...track, subtitleFormat: 'srt', subtitleText: await response.text() };
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function flatten(value, prefix = '', target = {}) {
  if (value === null || value === undefined) { target[prefix] = ''; return target; }
  if (Array.isArray(value)) { target[prefix] = value.map((item) => typeof item === 'object' ? JSON.stringify(item) : item).join(' | '); return target; }
  if (typeof value === 'object') { Object.entries(value).forEach(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key, target)); return target; }
  target[prefix] = value; return target;
}

function toCsv(videos) {
  const rows = videos.map((video) => flatten(video)); const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `\uFEFF${headers.map(quote).join(',')}\n${rows.map((row) => headers.map((header) => quote(row[header])).join(',')).join('\n')}`;
}

async function exportMetadata(format) {
  const ids = [...state.selected];
  try {
    els.exportJson.disabled = els.exportCsv.disabled = true;
    const metadata = await getMetadata(ids, els.includeCaptionText.checked); const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') download(JSON.stringify(metadata, null, 2), `youtube-metadata-${date}.json`, 'application/json');
    else download(toCsv(metadata), `youtube-metadata-${date}.csv`, 'text/csv;charset=utf-8');
  } catch (error) { els.listStatus.textContent = `Ошибка экспорта: ${error.message}`; }
  finally { updateSelectionUi(); }
}

async function showDetails(id) {
  try { els.metadata.textContent = 'Загружаю…'; els.dialog.showModal(); const [video] = await getMetadata([id]); els.metadata.textContent = JSON.stringify(video || {}, null, 2); }
  catch (error) { els.metadata.textContent = `Ошибка: ${error.message}`; }
}

els.consent.addEventListener('change', initialiseAuth);
els.signIn.addEventListener('click', () => {
  if (!els.consent.checked) return setAuthStatus('Перед входом примите Условия использования и Политику конфиденциальности.', true);
  return state.tokenClient ? state.tokenClient.requestAccessToken({ prompt: 'consent' }) : setAuthStatus('Сервер ещё не передал OAuth-настройки. Обновите страницу через несколько секунд.', true);
});
els.search.addEventListener('input', renderVideos);
els.videos.addEventListener('change', (event) => { if (!event.target.matches('.video-checkbox')) return; event.target.checked ? state.selected.add(event.target.dataset.id) : state.selected.delete(event.target.dataset.id); updateSelectionUi(); });
els.videos.addEventListener('click', (event) => { if (event.target.matches('.details-button')) showDetails(event.target.dataset.id); });
els.selectAll.addEventListener('click', () => { const visible = filteredVideos(); const every = visible.length > 0 && visible.every((video) => state.selected.has(video.id)); visible.forEach((video) => every ? state.selected.delete(video.id) : state.selected.add(video.id)); renderVideos(); });
els.exportJson.addEventListener('click', () => exportMetadata('json')); els.exportCsv.addEventListener('click', () => exportMetadata('csv'));
$('close-dialog').addEventListener('click', () => els.dialog.close());
$('sign-out').addEventListener('click', () => {
  if (state.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(state.token, () => {});
  Object.assign(state, { token: null, channel: null, videos: [], selected: new Set() });
  els.consent.checked = false;
  els.workspace.classList.add('hidden'); els.setup.classList.remove('hidden');
  initialiseAuth();
  setAuthStatus('Доступ Google отозван. Данные этого сеанса удалены из приложения. Скачанные файлы остаются только на вашем устройстве.');
});
window.addEventListener('load', async () => {
  try {
    let config = window.APP_CONFIG;
    if (!config?.googleClientId) {
      const response = await fetch('/api/config', { cache: 'no-store' });
      config = await response.json();
      if (!response.ok) throw new Error(config.error || 'Не удалось получить настройки сервера.');
    }
    state.clientId = config.googleClientId;
    setAuthStatus('Настройки загружены. Примите политики, чтобы войти через Google.');
  } catch (error) {
    setAuthStatus(`Не удалось запустить приложение: ${error.message}`, true);
    return;
  }
  const waitForGoogle = setInterval(() => {
    if (window.google?.accounts?.oauth2) { clearInterval(waitForGoogle); initialiseAuth(); }
  }, 100);
});
